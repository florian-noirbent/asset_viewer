import uuid
from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.models import Asset, FileIndex, Lease, Tenant
from app.db.session import get_db_session
from app.storage.minio_client import ObjectStorage, get_object_storage, safe_filename

router = APIRouter(prefix="/api", tags=["assets"])

ASSET_FIELDS = [
    ("name", "Asset name", "asset_provenance", "asset_name"),
    ("address", "Address", "asset_provenance", "address"),
    ("city", "City", "asset_provenance", "city"),
    ("country", "Country", "asset_provenance", "country"),
    ("asset_type", "Asset type", "asset_provenance", "asset_type"),
    ("tenure", "Tenure", "asset_provenance", "tenure"),
    ("currency", "Currency", "asset_provenance", "currency"),
    ("property_type", "Property type", "logistics_provenance", "property_type"),
    ("project_type", "Project type", "logistics_provenance", "project_type"),
    ("building_area_sf", "Building area (sf)", "logistics_provenance", "area"),
    ("building_area_sm", "Building area (sm)", "logistics_provenance", "area"),
    ("area_site", "Site area", "logistics_provenance", "area_site"),
    ("building_occupancy", "Occupancy", "logistics_provenance", "occupancy"),
    ("height", "Height", "logistics_provenance", "height"),
    ("rent_gross", "Gross rent", "logistics_provenance", "rent_gross"),
    ("rent_pu", "Rent per unit", "logistics_provenance", "rent_pu"),
    ("walt", "WALT", None, None),
    ("walb", "WALB", None, None),
    ("erv", "ERV", "logistics_provenance", "erv"),
]

LEASE_FIELDS = [
    ("lease_type", "Lease type", None),
    ("area_sf", "Area (sf)", "area"),
    ("area_sm", "Area (sm)", "area"),
    ("area_warehouse", "Warehouse area", None),
    ("area_office", "Office area", None),
    ("date_start", "Start date", "date_start"),
    ("date_expire", "Expiry date", "date_expire"),
    ("date_break1", "Break date 1", "date_break1"),
    ("date_break2", "Break date 2", "date_break2"),
    ("next_indexation_date", "Next indexation date", None),
    ("contracted_indexation", "Contracted indexation", None),
    ("rent_gross", "Gross rent", "rent_gross"),
    ("rent_pu", "Rent per unit", "rent_pu"),
    ("currency", "Currency", None),
    ("rent_free_months", "Rent free months", None),
    ("non_recoverables", "Non recoverables", None),
    ("void_costs_pa", "Void costs pa", None),
    ("walt", "WALT", None),
    ("walb", "WALB", None),
    ("erv", "ERV", "erv"),
    ("lessee_name_verbatim", "Lessee verbatim", None),
    ("signing_entity", "Signing entity", None),
]


@router.get("/assets")
async def list_assets(session: AsyncSession = Depends(get_db_session)) -> list[dict[str, Any]]:
    result = await session.execute(select(Asset).order_by(Asset.name))
    return [serialize_asset_summary(asset) for asset in result.scalars().all()]


@router.get("/assets/{asset_id}")
async def get_asset(
    asset_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    storage: ObjectStorage = Depends(get_object_storage),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    result = await session.execute(select(Lease, Tenant).join(Tenant, Tenant.id == Lease.tenant_id).where(Lease.asset_id == asset_id).order_by(Lease.id))
    file_indexes = await load_file_indexes(session)

    return {
        **serialize_asset_summary(asset),
        "fields": serialize_asset_fields(asset, request, file_indexes, storage, settings),
        "leases": [serialize_lease(lease, tenant, request, file_indexes, storage, settings) for lease, tenant in result.all()],
    }


@router.get("/resources/{filename}/url", name="get_resource_url")
async def get_resource_pdf_url(
    filename: str,
    storage: ObjectStorage = Depends(get_object_storage),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    requested_filename = Path(filename).name
    if requested_filename != filename or Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="Resource not found")

    index_filename = safe_filename(requested_filename)
    result = await session.execute(select(FileIndex).where(FileIndex.filename == index_filename))
    file_index = result.scalars().first()
    if file_index is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    try:
        if not storage.object_exists(file_index.object_key):
            raise FileNotFoundError(file_index.object_key)
        url = storage.presigned_get_url(file_index.object_key, settings.minio_presigned_url_expires_seconds)
    except Exception as error:
        raise HTTPException(status_code=404, detail="Resource not found") from error

    return {
        "url": url,
        "expires_in_seconds": settings.minio_presigned_url_expires_seconds,
    }


async def load_file_indexes(session: AsyncSession) -> dict[str, FileIndex]:
    result = await session.execute(select(FileIndex))
    return {file_index.filename: file_index for file_index in result.scalars().all()}


def serialize_asset_summary(asset: Asset) -> dict[str, Any]:
    return {
        "id": str(asset.id),
        "name": asset.name,
        "address": asset.address,
        "city": asset.city,
        "country": asset.country,
        "assetType": asset.asset_type,
        "propertyType": asset.property_type,
        "currency": asset.currency,
    }


def serialize_asset_fields(
    asset: Asset,
    request: Request,
    file_indexes: dict[str, FileIndex],
    storage: ObjectStorage,
    settings: Settings,
) -> list[dict[str, Any]]:
    fields = []

    for attr, label, provenance_source, provenance_key in ASSET_FIELDS:
        provenance = []
        if provenance_source and provenance_key:
            provenance_blob = getattr(asset, provenance_source) or {}
            provenance = normalize_provenance(provenance_blob.get(provenance_key, []), request, file_indexes, storage, settings)

        fields.append(
            {
                "fieldPath": f"asset.{attr}",
                "label": label,
                "value": serialize_value(getattr(asset, attr)),
                "provenance": provenance,
            }
        )

    return fields


def serialize_lease(
    lease: Lease,
    tenant: Tenant,
    request: Request,
    file_indexes: dict[str, FileIndex],
    storage: ObjectStorage,
    settings: Settings,
) -> dict[str, Any]:
    return {
        "id": lease.id,
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "industry": tenant.industry,
        },
        "fields": [
            {
                "fieldPath": f"lease.{attr}",
                "label": label,
                "value": serialize_value(getattr(lease, attr)),
                "provenance": (
                    normalize_provenance(
                        (lease.lease_provenance or {}).get(provenance_key, []),
                        request,
                        file_indexes,
                        storage,
                        settings,
                    )
                    if provenance_key
                    else []
                ),
            }
            for attr, label, provenance_key in LEASE_FIELDS
        ],
    }


def normalize_provenance(
    raw_items: Any,
    request: Request,
    file_indexes: dict[str, FileIndex],
    storage: ObjectStorage,
    settings: Settings,
) -> list[dict[str, Any]]:
    if isinstance(raw_items, dict):
        items: Iterable[Any] = [raw_items]
    elif isinstance(raw_items, list):
        items = raw_items
    else:
        items = []

    normalized = []
    for item in items:
        if not isinstance(item, dict):
            continue

        document = item.get("document")
        source_type = item.get("source_type")
        source_url = None
        refresh_url = None
        if document and source_type == "pdf":
            refresh_url = f"{str(request.base_url).rstrip('/')}/api/resources/{quote(document)}/url"
            file_index = file_indexes.get(safe_filename(document))
            if file_index:
                try:
                    if storage.object_exists(file_index.object_key):
                        source_url = storage.presigned_get_url(file_index.object_key, settings.minio_presigned_url_expires_seconds)
                except Exception:
                    source_url = None

        normalized.append(
            {
                "document": document,
                "quote": item.get("quote"),
                "page": item.get("page"),
                "sheet": item.get("sheet"),
                "sourceType": source_type,
                "url": source_url,
                "refreshUrl": refresh_url,
                "expiresInSeconds": settings.minio_presigned_url_expires_seconds if source_url else None,
            }
        )

    return normalized


def serialize_value(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, Decimal):
        return str(value.normalize())

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)

import uuid
from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, Lease, Tenant
from app.db.session import get_db_session

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
) -> dict[str, Any]:
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    result = await session.execute(
        select(Lease, Tenant)
        .join(Tenant, Tenant.id == Lease.tenant_id)
        .where(Lease.asset_id == asset_id)
        .order_by(Lease.id)
    )

    return {
        **serialize_asset_summary(asset),
        "fields": serialize_asset_fields(asset, request),
        "leases": [
            serialize_lease(lease, tenant, request)
            for lease, tenant in result.all()
        ],
    }


@router.get("/resources/{filename:path}", name="get_resource")
async def get_resource_pdf(filename: str) -> FileResponse:
    safe_filename = Path(filename).name
    if safe_filename != filename or Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="Resource not found")

    for root in (Path("/app/ressources"), Path(__file__).resolve().parents[4] / "ressources"):
        resource_path = root / safe_filename
        if resource_path.is_file():
            return FileResponse(
                resource_path,
                media_type="application/pdf",
                filename=safe_filename,
            )

    raise HTTPException(status_code=404, detail="Resource not found")


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


def serialize_asset_fields(asset: Asset, request: Request) -> list[dict[str, Any]]:
    fields = []

    for attr, label, provenance_source, provenance_key in ASSET_FIELDS:
        provenance = []
        if provenance_source and provenance_key:
            provenance_blob = getattr(asset, provenance_source) or {}
            provenance = normalize_provenance(provenance_blob.get(provenance_key, []), request)

        fields.append(
            {
                "fieldPath": f"asset.{attr}",
                "label": label,
                "value": serialize_value(getattr(asset, attr)),
                "provenance": provenance,
            }
        )

    return fields


def serialize_lease(lease: Lease, tenant: Tenant, request: Request) -> dict[str, Any]:
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
                "provenance": normalize_provenance(
                    (lease.lease_provenance or {}).get(provenance_key, []),
                    request,
                )
                if provenance_key
                else [],
            }
            for attr, label, provenance_key in LEASE_FIELDS
        ],
    }


def normalize_provenance(raw_items: Any, request: Request) -> list[dict[str, Any]]:
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
        normalized.append(
            {
                "document": document,
                "quote": item.get("quote"),
                "page": item.get("page"),
                "sheet": item.get("sheet"),
                "sourceType": item.get("source_type"),
                "pdfUrl": f"{str(request.base_url).rstrip('/')}/api/resources/{quote(document)}"
                if document and item.get("source_type") == "pdf"
                else None,
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

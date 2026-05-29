from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal
from typing import TypeAlias
from urllib.parse import quote

from app.api.dto import AssetFieldDTO, ProvenanceDTO
from app.core.config import Settings
from app.db.models import Asset, FileIndex, Lease
from app.storage.minio_client import safe_filename
from app.storage.ports import StoragePort

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
ProvenanceItem: TypeAlias = dict[str, JsonValue]
SerializableValue: TypeAlias = str | int | float | bool | Decimal | datetime | None

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


class ProvenanceService:
    def __init__(self, storage: StoragePort, settings: Settings) -> None:
        self.storage = storage
        self.settings = settings

    def serialize_asset_fields(self, asset: Asset, base_url: str, file_indexes: dict[str, FileIndex]) -> list[AssetFieldDTO]:
        fields = []

        for attr, label, provenance_source, provenance_key in ASSET_FIELDS:
            provenance = []
            if provenance_source and provenance_key:
                provenance_blob = getattr(asset, provenance_source) or {}
                provenance = self.normalize_provenance(provenance_blob.get(provenance_key, []), base_url, file_indexes)

            fields.append(
                AssetFieldDTO(
                    fieldPath=f"asset.{attr}",
                    label=label,
                    value=serialize_value(getattr(asset, attr)),
                    provenance=provenance,
                )
            )

        return fields

    def serialize_lease_fields(self, lease: Lease, base_url: str, file_indexes: dict[str, FileIndex]) -> list[AssetFieldDTO]:
        fields = []

        for attr, label, provenance_key in LEASE_FIELDS:
            provenance = (
                self.normalize_provenance(
                    (lease.lease_provenance or {}).get(provenance_key, []),
                    base_url,
                    file_indexes,
                )
                if provenance_key
                else []
            )
            fields.append(
                AssetFieldDTO(
                    fieldPath=f"lease.{attr}",
                    label=label,
                    value=serialize_value(getattr(lease, attr)),
                    provenance=provenance,
                )
            )

        return fields

    def normalize_provenance(self, raw_items: JsonValue, base_url: str, file_indexes: dict[str, FileIndex]) -> list[ProvenanceDTO]:
        if isinstance(raw_items, dict):
            items: Iterable[ProvenanceItem] = [raw_items]
        elif isinstance(raw_items, list):
            items = [item for item in raw_items if isinstance(item, dict)]
        else:
            items = []

        normalized = []
        for item in items:
            document = string_or_none(item.get("document"))
            source_type = string_or_none(item.get("source_type"))
            source_url = None
            refresh_url = None
            if document and source_type == "pdf":
                refresh_url = f"{base_url.rstrip('/')}/api/resources/{quote(document)}/url"
                file_index = file_indexes.get(safe_filename(document))
                if file_index:
                    try:
                        if self.storage.object_exists(file_index.object_key):
                            source_url = self.storage.presigned_get_url(file_index.object_key, self.settings.minio_presigned_url_expires_seconds)
                    except Exception:
                        source_url = None

            normalized.append(
                ProvenanceDTO(
                    document=document,
                    quote=string_or_none(item.get("quote")),
                    page=item.get("page"),
                    sheet=item.get("sheet"),
                    sourceType=source_type,
                    url=source_url,
                    refreshUrl=refresh_url,
                    expiresInSeconds=self.settings.minio_presigned_url_expires_seconds if source_url else None,
                )
            )

        return normalized


def string_or_none(value: JsonValue) -> str | None:
    return value if isinstance(value, str) else None


def serialize_value(value: SerializableValue) -> str | None:
    if value is None:
        return None

    if isinstance(value, Decimal):
        return str(value.normalize())

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)

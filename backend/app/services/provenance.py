from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal
from typing import TypeAlias
from urllib.parse import quote

from app.api.dto import AssetFieldDTO, CompositeProvenanceDTO, CsvProvenanceDTO, ExcelCellProvenanceDTO, ExcelRangeProvenanceDTO, PdfProvenanceDTO, ProvenanceDTO
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
    ("walt", "WALT", "logistics_provenance", "walt"),
    ("walb", "WALB", "logistics_provenance", "walb"),
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
    ("walt", "WALT", "walt"),
    ("walb", "WALB", "walb"),
    ("erv", "ERV", "erv"),
    ("lessee_name_verbatim", "Lessee verbatim", None),
    ("signing_entity", "Signing entity", None),
]

TENANT_FIELDS = [
    ("name", "Tenant name", "name"),
    ("industry", "Tenant industry", "industry"),
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

    def serialize_tenant_fields(self, tenant: object, base_url: str, file_indexes: dict[str, FileIndex]) -> list[AssetFieldDTO]:
        fields = []
        provenance_blob = getattr(tenant, "tenant_provenance") or {}

        for attr, label, provenance_key in TENANT_FIELDS:
            fields.append(
                AssetFieldDTO(
                    fieldPath=f"tenant.{attr}",
                    label=label,
                    value=serialize_value(getattr(tenant, attr)),
                    provenance=self.normalize_provenance(provenance_blob.get(provenance_key, []), base_url, file_indexes),
                )
            )

        return fields

    def normalize_provenance(self, raw_items: JsonValue, base_url: str, file_indexes: dict[str, FileIndex]) -> list[ProvenanceDTO]:
        factory = ProvenanceFactory(
            storage=self.storage,
            expires_seconds=self.settings.minio_presigned_url_expires_seconds,
            external_base_url=(self.settings.public_base_url or base_url).rstrip("/"),
            file_indexes=file_indexes,
        )
        return factory.from_raw_items(raw_items)


class ProvenanceFactory:
    def __init__(
        self,
        storage: StoragePort,
        expires_seconds: int,
        external_base_url: str,
        file_indexes: dict[str, FileIndex],
    ) -> None:
        self.storage = storage
        self.expires_seconds = expires_seconds
        self.external_base_url = external_base_url
        self.file_indexes = file_indexes

    def from_raw_items(self, raw_items: JsonValue) -> list[ProvenanceDTO]:
        if isinstance(raw_items, dict):
            items: Iterable[ProvenanceItem] = [raw_items]
        elif isinstance(raw_items, list):
            items = [item for item in raw_items if isinstance(item, dict)]
        else:
            items = []

        return [source for item in items if (source := self.from_raw_item(item)) is not None]

    def from_raw_item(self, item: ProvenanceItem) -> ProvenanceDTO | None:
        quote_text = string_or_none(item.get("quote"))
        source_type = string_or_none(item.get("source_type"))
        if not quote_text or not source_type:
            return None

        match source_type.lower():
            case "pdf":
                return self.build_pdf(item, quote_text)
            case "csv":
                return self.build_csv(item, quote_text)
            case "excel":
                return self.build_excel(item, quote_text)
            case "composite":
                return CompositeProvenanceDTO(
                    quote=quote_text,
                    sourceType="composite",
                    sources=self.from_raw_items(item.get("sources", [])),
                )
            case _:
                return None

    def build_pdf(self, item: ProvenanceItem, quote_text: str) -> PdfProvenanceDTO | None:
        document, url, refresh_url = self.resolve_document(item)
        page = int_or_none(item.get("page"))
        if not document or not url or not refresh_url or page is None:
            return None

        return PdfProvenanceDTO(
            quote=quote_text,
            sourceType="pdf",
            document=document,
            url=url,
            refreshUrl=refresh_url,
            expiresInSeconds=self.expires_seconds,
            page=page,
        )

    def build_csv(self, item: ProvenanceItem, quote_text: str) -> CsvProvenanceDTO | None:
        document, url, refresh_url = self.resolve_document(item)
        row = item.get("row")
        column = string_or_none(item.get("column"))
        if not document or not url or not refresh_url or not isinstance(row, str | int) or not column:
            return None

        return CsvProvenanceDTO(
            quote=quote_text,
            sourceType="csv",
            document=document,
            url=url,
            refreshUrl=refresh_url,
            expiresInSeconds=self.expires_seconds,
            row=row,
            column=column,
        )

    def build_excel(self, item: ProvenanceItem, quote_text: str) -> ExcelCellProvenanceDTO | ExcelRangeProvenanceDTO | None:
        document, url, refresh_url = self.resolve_document(item)
        sheet = string_or_none(item.get("sheet"))
        cell = string_or_none(item.get("cell"))
        cell_range = string_or_none(item.get("range"))
        if not document or not url or not refresh_url or not sheet:
            return None

        if cell and not cell_range:
            return ExcelCellProvenanceDTO(
                quote=quote_text,
                sourceType="excel",
                document=document,
                url=url,
                refreshUrl=refresh_url,
                expiresInSeconds=self.expires_seconds,
                sheet=sheet,
                cell=cell,
            )

        if cell_range and not cell:
            return ExcelRangeProvenanceDTO(
                quote=quote_text,
                sourceType="excel",
                document=document,
                url=url,
                refreshUrl=refresh_url,
                expiresInSeconds=self.expires_seconds,
                sheet=sheet,
                range=cell_range,
            )

        return None

    def resolve_document(self, item: ProvenanceItem) -> tuple[str | None, str | None, str | None]:
        document = string_or_none(item.get("document"))
        if not document:
            return None, None, None

        refresh_url = f"{self.external_base_url}/api/resources/{quote(document)}/url"
        file_index = self.file_indexes.get(safe_filename(document))
        if not file_index:
            return document, None, refresh_url

        try:
            if not self.storage.object_exists(file_index.object_key):
                return document, None, refresh_url
            return document, self.storage.presigned_get_url(file_index.object_key, self.expires_seconds), refresh_url
        except Exception:
            return document, None, refresh_url


def string_or_none(value: JsonValue) -> str | None:
    return value if isinstance(value, str) else None


def int_or_none(value: JsonValue) -> int | None:
    return value if isinstance(value, int) else None


def serialize_value(value: SerializableValue) -> str | None:
    if value is None:
        return None

    if isinstance(value, Decimal):
        return str(value.normalize())

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)

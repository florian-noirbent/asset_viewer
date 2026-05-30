import uuid
from typing import Any, cast

from app.api.dto import CompositeProvenanceDTO, CsvProvenanceDTO, ExcelCellProvenanceDTO, ExcelRangeProvenanceDTO, PdfProvenanceDTO
from app.core.config import Settings
from app.db.models import Asset, FileIndex, Lease, Tenant
from app.services.assets import AssetService
from app.services.provenance import ProvenanceService

ASSET_ID = uuid.UUID("3f38f6d2-8b53-4c5d-ae39-0de46104da52")
BASE_URL = "http://testserver.local/"


class FakeStorage:
    def ensure_bucket(self, retries: int = 10, delay_seconds: float = 1.0) -> None:
        return None

    def object_exists(self, object_key: str) -> bool:
        return True

    def presigned_get_url(self, object_key: str, expires_seconds: int) -> str:
        return f"http://storage.local/{object_key}?expires={expires_seconds}"

    def upload_local_resource(self, path: object, object_prefix: str = "resources") -> object:
        raise NotImplementedError


class FakeAssetRepository:
    def __init__(self, asset: Asset, rows: list[tuple[Lease, Tenant]]) -> None:
        self.asset = asset
        self.rows = rows

    async def list_assets(self) -> list[Asset]:
        return [self.asset]

    async def get_asset(self, asset_id: uuid.UUID) -> Asset | None:
        return self.asset if asset_id == self.asset.id else None

    async def list_lease_tenant_rows(self, asset_id: uuid.UUID) -> list[tuple[Lease, Tenant]]:
        return self.rows


class FakeFileIndexRepository:
    def __init__(self, indexes: dict[str, FileIndex]) -> None:
        self.indexes = indexes

    async def list_file_indexes(self) -> dict[str, FileIndex]:
        return self.indexes


def make_file_index(filename: str, content_type: str) -> FileIndex:
    object_key = f"resources/{filename}"
    return FileIndex(
        id=uuid.uuid5(uuid.NAMESPACE_URL, object_key),
        filename=filename,
        content_type=content_type,
        size_bytes=100,
        bucket="assets",
        object_key=object_key,
        status="uploaded",
    )


def make_service(indexes: dict[str, FileIndex]) -> ProvenanceService:
    return ProvenanceService(
        cast(Any, FakeStorage()),
        Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            minio_bucket="assets",
            public_base_url="http://api.local",
            skip_startup_checks=True,
        ),
    )


def test_normalize_provenance_builds_concrete_polymorphic_sources() -> None:
    indexes = {
        "source_viewer_demo.csv": make_file_index("source_viewer_demo.csv", "text/csv"),
        "source_viewer_demo.xlsx": make_file_index("source_viewer_demo.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "source_viewer_demo.pdf": make_file_index("source_viewer_demo.pdf", "application/pdf"),
    }
    service = make_service(indexes)

    provenance = service.normalize_provenance(
        [
            {
                "source_type": "composite",
                "quote": "Weighted rent = total rent / total area",
                "sources": [
                    {
                        "document": "source_viewer_demo.csv",
                        "source_type": "csv",
                        "quote": "96000",
                        "row": 2,
                        "column": "annual_rent_gbp",
                    },
                    {
                        "document": "source_viewer_demo.xlsx",
                        "source_type": "excel",
                        "quote": "Gross rent divided by total area cell",
                        "sheet": "Valuation Inputs",
                        "cell": "B4",
                    },
                    {
                        "document": "source_viewer_demo.xlsx",
                        "source_type": "excel",
                        "quote": "Gross rent divided by total area range",
                        "sheet": "Valuation Inputs",
                        "range": "B2:B4",
                    },
                    {
                        "document": "source_viewer_demo.pdf",
                        "source_type": "pdf",
                        "quote": "Average rent: GBP 8.60 per sq ft",
                        "page": 1,
                    },
                ],
            }
        ],
        BASE_URL,
        indexes,
    )

    composite = provenance[0]
    assert isinstance(composite, CompositeProvenanceDTO)
    assert composite.sourceType == "composite"
    assert not hasattr(composite, "url")
    assert len(composite.sources) == 4

    csv_source = composite.sources[0]
    assert isinstance(csv_source, CsvProvenanceDTO)
    assert csv_source.sourceType == "csv"
    assert csv_source.row == 2
    assert csv_source.column == "annual_rent_gbp"
    assert csv_source.url == "http://storage.local/resources/source_viewer_demo.csv?expires=900"
    assert csv_source.refreshUrl == "http://api.local/api/resources/source_viewer_demo.csv/url"
    assert not hasattr(csv_source, "page")

    excel_cell_source = composite.sources[1]
    assert isinstance(excel_cell_source, ExcelCellProvenanceDTO)
    assert excel_cell_source.sourceType == "excel"
    assert excel_cell_source.sheet == "Valuation Inputs"
    assert excel_cell_source.cell == "B4"
    assert not hasattr(excel_cell_source, "range")

    excel_range_source = composite.sources[2]
    assert isinstance(excel_range_source, ExcelRangeProvenanceDTO)
    assert excel_range_source.sourceType == "excel"
    assert excel_range_source.sheet == "Valuation Inputs"
    assert excel_range_source.range == "B2:B4"
    assert excel_range_source.refreshUrl == "http://api.local/api/resources/source_viewer_demo.xlsx/url"
    assert not hasattr(excel_range_source, "cell")

    pdf_source = composite.sources[3]
    assert isinstance(pdf_source, PdfProvenanceDTO)
    assert pdf_source.sourceType == "pdf"
    assert pdf_source.page == 1
    assert not hasattr(pdf_source, "sheet")


def test_normalize_provenance_skips_incomplete_sources() -> None:
    service = make_service({"source_viewer_demo.csv": make_file_index("source_viewer_demo.csv", "text/csv")})

    provenance = service.normalize_provenance(
        [
            {"document": "source_viewer_demo.csv", "source_type": "csv", "quote": "96000", "row": 2},
            {"document": "missing.pdf", "source_type": "pdf", "quote": "96000", "page": 1},
            {"source_type": "composite", "quote": "A calculation", "sources": [{"source_type": "csv", "quote": "missing document", "row": 1, "column": "rent"}]},
        ],
        BASE_URL,
        {"source_viewer_demo.csv": make_file_index("source_viewer_demo.csv", "text/csv")},
    )

    assert len(provenance) == 1
    composite = provenance[0]
    assert isinstance(composite, CompositeProvenanceDTO)
    assert composite.sources == []


async def test_asset_detail_exposes_walt_walb_and_tenant_provenance() -> None:
    asset = Asset(
        id=ASSET_ID,
        name="Meridian Trade Park",
        asset_provenance={},
        logistics_provenance={
            "walt": [{"source_type": "composite", "quote": "Weighted average lease term", "sources": []}],
            "walb": [{"source_type": "composite", "quote": "Weighted average lease break", "sources": []}],
        },
    )
    tenant = Tenant(
        id="MTP-T-001",
        name="Northstar Components Ltd",
        industry="Precision components distribution",
        tenant_provenance={
            "name": [{"document": "source_viewer_demo.csv", "source_type": "csv", "quote": "Northstar Components Ltd", "row": 2, "column": "tenant_name"}],
            "industry": [{"document": "source_viewer_demo.xlsx", "source_type": "excel", "quote": "Precision components distribution", "sheet": "Rent Roll", "cell": "B2"}],
        },
    )
    lease = Lease(
        id="MTP-L-001",
        asset_id=ASSET_ID,
        tenant_id=tenant.id,
        lease_provenance={
            "walt": [{"source_type": "composite", "quote": "Lease WALT calculation", "sources": []}],
            "walb": [{"source_type": "composite", "quote": "Lease WALB calculation", "sources": []}],
        },
    )
    indexes = {
        "source_viewer_demo.csv": make_file_index("source_viewer_demo.csv", "text/csv"),
        "source_viewer_demo.xlsx": make_file_index("source_viewer_demo.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    provenance_service = make_service(indexes)
    asset_service = AssetService(
        cast(Any, FakeAssetRepository(asset, [(lease, tenant)])),
        cast(Any, FakeFileIndexRepository(indexes)),
        provenance_service,
    )

    detail = await asset_service.get_asset_detail(ASSET_ID, BASE_URL)

    asset_walt = next(field for field in detail.fields if field.fieldPath == "asset.walt")
    asset_walb = next(field for field in detail.fields if field.fieldPath == "asset.walb")
    lease_walt = next(field for field in detail.leases[0].fields if field.fieldPath == "lease.walt")
    lease_walb = next(field for field in detail.leases[0].fields if field.fieldPath == "lease.walb")
    tenant_name = next(field for field in detail.leases[0].tenantFields if field.fieldPath == "tenant.name")
    tenant_industry = next(field for field in detail.leases[0].tenantFields if field.fieldPath == "tenant.industry")

    assert asset_walt.provenance[0].quote == "Weighted average lease term"
    assert asset_walb.provenance[0].quote == "Weighted average lease break"
    assert lease_walt.provenance[0].quote == "Lease WALT calculation"
    assert lease_walb.provenance[0].quote == "Lease WALB calculation"
    assert isinstance(tenant_name.provenance[0], CsvProvenanceDTO)
    assert tenant_name.provenance[0].row == 2
    assert isinstance(tenant_industry.provenance[0], ExcelCellProvenanceDTO)
    assert tenant_industry.provenance[0].cell == "B2"

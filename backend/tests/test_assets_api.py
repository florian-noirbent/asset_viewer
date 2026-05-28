import os
import uuid
from collections.abc import AsyncGenerator
from decimal import Decimal
from typing import Any, cast

os.environ["GOCANOPY_SKIP_STARTUP"] = "true"

from fastapi.testclient import TestClient

from app.db.models import Asset, FileIndex, Lease, Tenant
from app.db.session import get_db_session
from app.main import app
from app.storage.minio_client import get_object_storage, safe_filename

ASSET_ID = uuid.UUID("d1994ec3-e121-4d5e-adec-014907116986")
PDF_FILENAME = "Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01 (1).pdf"
SAFE_PDF_FILENAME = safe_filename(PDF_FILENAME)


class FakeScalarResult:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows

    def all(self) -> list[Any]:
        return self.rows

    def first(self) -> Any | None:
        return self.rows[0] if self.rows else None


class FakeResult:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self.rows)

    def all(self) -> list[Any]:
        return self.rows


class FakeSession:
    def __init__(self, asset: Asset | None = None, lease_rows: list[tuple[Lease, Tenant]] | None = None, file_index: FileIndex | None = None) -> None:
        self.asset = asset
        self.lease_rows = lease_rows or []
        self.file_index = file_index

    async def get(self, model: type[object], row_id: object) -> Asset | None:
        if model is Asset and row_id == ASSET_ID:
            return self.asset
        return None

    async def execute(self, statement: Any) -> FakeResult:
        entity = statement.column_descriptions[0].get("entity")
        if entity is FileIndex:
            return FakeResult([self.file_index] if self.file_index else [])
        if entity is Lease and self.asset and self.lease_rows:
            return FakeResult(self.lease_rows)
        if entity is Asset and self.asset:
            return FakeResult([self.asset])
        return FakeResult([])


class FakeStorage:
    def __init__(self, fail: bool = False, missing: bool = False) -> None:
        self.fail = fail
        self.missing = missing

    def object_exists(self, object_key: str) -> bool:
        return not self.missing and bool(object_key)

    def presigned_get_url(self, object_key: str, expires_seconds: int) -> str:
        if self.fail:
            raise FileNotFoundError(object_key)
        return f"http://localhost:9000/assets/{object_key}?X-Amz-Expires={expires_seconds}"


def make_asset() -> Asset:
    return Asset(
        id=ASSET_ID,
        name="Causeway Park",
        address="Wilderspool Causeway, Warrington WA4 6RF",
        city="Warrington",
        country="United Kingdom",
        asset_type="Logistics",
        tenure="Freehold",
        currency="GBP",
        property_type="Multi-let industrial estate",
        project_type="Value Add",
        building_area_sf=Decimal("143277.8"),
        building_area_sm=Decimal("13310.95606610987"),
        area_site=Decimal("5.81"),
        area_vacant=Decimal("0"),
        building_occupancy=Decimal("1.0"),
        height="5m",
        rent_gross=Decimal("443400.0"),
        rent_pu=Decimal("3.0946873835304562"),
        walt=Decimal("4.818366792098418"),
        walb=Decimal("2.884549032692581"),
        erv=Decimal("572481.0"),
        asset_provenance={
            "asset_name": [
                {
                    "page": 2,
                    "quote": "Causeway Park",
                    "document": PDF_FILENAME,
                    "source_type": "pdf",
                }
            ]
        },
        logistics_provenance={
            "area": [
                {
                    "page": 3,
                    "quote": "143,277.8 sq ft",
                    "document": PDF_FILENAME,
                    "source_type": "pdf",
                }
            ]
        },
    )


def make_lease_rows() -> list[tuple[Lease, Tenant]]:
    tenant = Tenant(
        id="3316146",
        name="Chiu Wah Ltd",
        industry="Food Wholesaler",
        tenant_provenance={"name": [{"quote": "Chiu Wah Ltd"}]},
    )
    lease = Lease(
        id="24421",
        asset_id=ASSET_ID,
        tenant_id=tenant.id,
        area_sf=Decimal("56239"),
        date_start=None,
        date_expire=None,
        rent_gross=Decimal("150000.0"),
        currency="GBP",
        erv=Decimal("196837.0"),
        lease_provenance={
            "rent_gross": [
                {
                    "page": 12,
                    "quote": "150,000",
                    "document": PDF_FILENAME,
                    "source_type": "pdf",
                }
            ]
        },
    )
    return [(lease, tenant)]


def override_session(fake_session: FakeSession) -> None:
    async def _override() -> AsyncGenerator[FakeSession, None]:
        yield fake_session

    app.dependency_overrides[get_db_session] = cast(Any, _override)


def override_storage(fake_storage: FakeStorage) -> None:
    app.dependency_overrides[get_object_storage] = lambda: fake_storage


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_list_assets_returns_asset_summary() -> None:
    override_session(FakeSession(asset=make_asset()))

    with TestClient(app) as client:
        response = client.get("/api/assets")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["name"] == "Causeway Park"
    assert body[0]["assetType"] == "Logistics"


def test_asset_detail_returns_fields_leases_and_provenance() -> None:
    file_index = FileIndex(
        id=uuid.uuid4(),
        filename=SAFE_PDF_FILENAME,
        content_type="application/pdf",
        size_bytes=13,
        bucket="assets",
        object_key=f"resources/{SAFE_PDF_FILENAME}",
        status="uploaded",
    )
    override_session(FakeSession(asset=make_asset(), lease_rows=make_lease_rows(), file_index=file_index))
    override_storage(FakeStorage())

    with TestClient(app) as client:
        response = client.get(f"/api/assets/{ASSET_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Causeway Park"
    assert len(body["leases"]) == 1
    assert body["leases"][0]["tenant"]["name"] == "Chiu Wah Ltd"
    asset_source = next(field for field in body["fields"] if field["fieldPath"] == "asset.name")["provenance"][0]
    assert asset_source["url"] == f"http://localhost:9000/assets/{file_index.object_key}?X-Amz-Expires=900"
    assert asset_source["refreshUrl"].endswith(f"{PDF_FILENAME.replace(' ', '%20').replace('(', '%28').replace(')', '%29')}/url")
    assert "pdfUrl" not in asset_source
    assert next(field for field in body["leases"][0]["fields"] if field["fieldPath"] == "lease.rent_gross")["provenance"][0]["quote"] == "150,000"


def test_missing_asset_returns_404() -> None:
    override_session(FakeSession(asset=None))

    with TestClient(app) as client:
        response = client.get(f"/api/assets/{ASSET_ID}")

    assert response.status_code == 404


def test_resource_pdf_url_endpoint_returns_presigned_url() -> None:
    file_index = FileIndex(
        id=uuid.uuid4(),
        filename=SAFE_PDF_FILENAME,
        content_type="application/pdf",
        size_bytes=13,
        bucket="assets",
        object_key=f"resources/{SAFE_PDF_FILENAME}",
        status="uploaded",
    )
    override_session(FakeSession(file_index=file_index))
    override_storage(FakeStorage())

    with TestClient(app) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}/url")

    assert response.status_code == 200
    assert response.json() == {
        "url": f"http://localhost:9000/assets/{file_index.object_key}?X-Amz-Expires=900",
        "expires_in_seconds": 900,
    }


def test_resource_pdf_endpoint_without_url_is_not_registered() -> None:
    with TestClient(app) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}")

    assert response.status_code == 404


def test_missing_resource_returns_404() -> None:
    override_session(FakeSession(file_index=None))
    override_storage(FakeStorage())

    with TestClient(app) as client:
        response = client.get("/api/resources/missing.pdf/url")

    assert response.status_code == 404


def test_resource_presign_failure_returns_404() -> None:
    file_index = FileIndex(
        id=uuid.uuid4(),
        filename=SAFE_PDF_FILENAME,
        content_type="application/pdf",
        size_bytes=13,
        bucket="assets",
        object_key=f"resources/{SAFE_PDF_FILENAME}",
        status="uploaded",
    )
    override_session(FakeSession(file_index=file_index))
    override_storage(FakeStorage(fail=True))

    with TestClient(app) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}/url")

    assert response.status_code == 404


def test_resource_missing_minio_object_returns_404() -> None:
    file_index = FileIndex(
        id=uuid.uuid4(),
        filename=SAFE_PDF_FILENAME,
        content_type="application/pdf",
        size_bytes=13,
        bucket="assets",
        object_key=f"resources/{SAFE_PDF_FILENAME}",
        status="uploaded",
    )
    override_session(FakeSession(file_index=file_index))
    override_storage(FakeStorage(missing=True))

    with TestClient(app) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}/url")

    assert response.status_code == 404


def test_resource_rejects_unsafe_filename() -> None:
    with TestClient(app) as client:
        response = client.get("/api/resources/../secret.pdf/url")

    assert response.status_code == 404


def test_upload_route_is_not_registered() -> None:
    with TestClient(app) as client:
        response = client.post("/api/uploads")

    assert response.status_code == 404

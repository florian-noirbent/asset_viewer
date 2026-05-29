import os
import uuid
from pathlib import Path

os.environ["GOCANOPY_SKIP_STARTUP"] = "true"

from litestar import Litestar
from litestar.testing import TestClient

from app.api.dto import AssetDetailDTO, AssetFieldDTO, AssetSummaryDTO, LeaseDTO, ProvenanceDTO, ResourceUrlDTO, TenantSummaryDTO
from app.core.config import Settings
from app.main import create_app
from app.services.assets import AssetService
from app.services.exceptions import AssetNotFoundError, ResourceNotFoundError
from app.services.resources import ResourceService
from app.storage.minio_client import UploadedObject, safe_filename

ASSET_ID = uuid.UUID("d1994ec3-e121-4d5e-adec-014907116986")
PDF_FILENAME = "Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01 (1).pdf"
SAFE_PDF_FILENAME = safe_filename(PDF_FILENAME)
RESOURCE_OBJECT_KEY = f"resources/{SAFE_PDF_FILENAME}"
PRESIGNED_URL = f"http://localhost:9000/assets/{RESOURCE_OBJECT_KEY}?X-Amz-Expires=900"


class FakeAssetService(AssetService):
    def __init__(
        self,
        summaries: list[AssetSummaryDTO] | None = None,
        detail: AssetDetailDTO | None = None,
        missing: bool = False,
    ) -> None:
        self.summaries = summaries or []
        self.detail = detail
        self.missing = missing

    async def list_assets(self) -> list[AssetSummaryDTO]:
        return self.summaries

    async def get_asset_detail(self, asset_id: uuid.UUID, base_url: str) -> AssetDetailDTO:
        if self.missing or self.detail is None:
            raise AssetNotFoundError
        return self.detail


class FakeResourceService(ResourceService):
    def __init__(self, response: ResourceUrlDTO | None = None, missing: bool = False) -> None:
        self.response = response
        self.missing = missing

    async def get_resource_pdf_url(self, filename: str) -> ResourceUrlDTO:
        if self.missing or self.response is None:
            raise ResourceNotFoundError
        return self.response


class FakeStorage:
    def ensure_bucket(self, retries: int = 10, delay_seconds: float = 1.0) -> None:
        return None

    def object_exists(self, object_key: str) -> bool:
        return True

    def presigned_get_url(self, object_key: str, expires_seconds: int) -> str:
        return PRESIGNED_URL

    def upload_local_pdf(self, path: Path, object_prefix: str = "resources") -> UploadedObject:
        raise NotImplementedError


def make_test_app(
    asset_service: AssetService | None = None,
    resource_service: ResourceService | None = None,
) -> Litestar:
    return create_app(
        settings=Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            minio_bucket="assets",
            skip_startup_checks=True,
        ),
        storage=FakeStorage(),
        asset_service_provider=lambda: asset_service or FakeAssetService(),
        resource_service_provider=lambda: resource_service or FakeResourceService(),
    )


def make_asset_summary() -> AssetSummaryDTO:
    return AssetSummaryDTO(
        id=str(ASSET_ID),
        name="Causeway Park",
        address="Wilderspool Causeway, Warrington WA4 6RF",
        city="Warrington",
        country="United Kingdom",
        assetType="Logistics",
        propertyType="Multi-let industrial estate",
        currency="GBP",
    )


def make_asset_detail() -> AssetDetailDTO:
    summary = make_asset_summary()
    return AssetDetailDTO(
        id=summary.id,
        name=summary.name,
        address=summary.address,
        city=summary.city,
        country=summary.country,
        assetType=summary.assetType,
        propertyType=summary.propertyType,
        currency=summary.currency,
        fields=[
            AssetFieldDTO(
                fieldPath="asset.name",
                label="Asset name",
                value="Causeway Park",
                provenance=[
                    ProvenanceDTO(
                        document=PDF_FILENAME,
                        quote="Causeway Park",
                        page=2,
                        sheet=None,
                        sourceType="pdf",
                        url=PRESIGNED_URL,
                        refreshUrl=f"http://testserver.local/api/resources/{PDF_FILENAME.replace(' ', '%20').replace('(', '%28').replace(')', '%29')}/url",
                        expiresInSeconds=900,
                    )
                ],
            )
        ],
        leases=[
            LeaseDTO(
                id="24421",
                tenant=TenantSummaryDTO(id="3316146", name="Chiu Wah Ltd", industry="Food Wholesaler"),
                fields=[
                    AssetFieldDTO(
                        fieldPath="lease.rent_gross",
                        label="Gross rent",
                        value="150000",
                        provenance=[
                            ProvenanceDTO(
                                document=PDF_FILENAME,
                                quote="150,000",
                                page=12,
                                sheet=None,
                                sourceType="pdf",
                                url=PRESIGNED_URL,
                                refreshUrl=f"http://testserver.local/api/resources/{PDF_FILENAME.replace(' ', '%20').replace('(', '%28').replace(')', '%29')}/url",
                                expiresInSeconds=900,
                            )
                        ],
                    )
                ],
            )
        ],
    )


def test_list_assets_returns_asset_summary() -> None:
    asset_service = FakeAssetService(summaries=[make_asset_summary()])

    with TestClient(make_test_app(asset_service=asset_service)) as client:
        response = client.get("/api/assets")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["name"] == "Causeway Park"
    assert body[0]["assetType"] == "Logistics"


def test_asset_detail_returns_fields_leases_and_provenance() -> None:
    asset_service = FakeAssetService(detail=make_asset_detail())

    with TestClient(make_test_app(asset_service=asset_service)) as client:
        response = client.get(f"/api/assets/{ASSET_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Causeway Park"
    assert len(body["leases"]) == 1
    assert body["leases"][0]["tenant"]["name"] == "Chiu Wah Ltd"
    asset_source = next(field for field in body["fields"] if field["fieldPath"] == "asset.name")["provenance"][0]
    assert asset_source["url"] == PRESIGNED_URL
    assert asset_source["refreshUrl"].endswith(f"{PDF_FILENAME.replace(' ', '%20').replace('(', '%28').replace(')', '%29')}/url")
    assert "pdfUrl" not in asset_source
    assert next(field for field in body["leases"][0]["fields"] if field["fieldPath"] == "lease.rent_gross")["provenance"][0]["quote"] == "150,000"


def test_missing_asset_returns_404() -> None:
    asset_service = FakeAssetService(missing=True)

    with TestClient(make_test_app(asset_service=asset_service)) as client:
        response = client.get(f"/api/assets/{ASSET_ID}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Asset not found"}


def test_resource_pdf_url_endpoint_returns_presigned_url() -> None:
    resource_service = FakeResourceService(response=ResourceUrlDTO(url=PRESIGNED_URL, expires_in_seconds=900))

    with TestClient(make_test_app(resource_service=resource_service)) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}/url")

    assert response.status_code == 200
    assert response.json() == {
        "url": PRESIGNED_URL,
        "expires_in_seconds": 900,
    }


def test_resource_pdf_endpoint_without_url_is_not_registered() -> None:
    with TestClient(make_test_app()) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}")

    assert response.status_code == 404


def test_missing_resource_returns_404() -> None:
    resource_service = FakeResourceService(missing=True)

    with TestClient(make_test_app(resource_service=resource_service)) as client:
        response = client.get("/api/resources/missing.pdf/url")

    assert response.status_code == 404
    assert response.json() == {"detail": "Resource not found"}


def test_resource_presign_failure_returns_404() -> None:
    resource_service = FakeResourceService(missing=True)

    with TestClient(make_test_app(resource_service=resource_service)) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}/url")

    assert response.status_code == 404


def test_resource_missing_minio_object_returns_404() -> None:
    resource_service = FakeResourceService(missing=True)

    with TestClient(make_test_app(resource_service=resource_service)) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}/url")

    assert response.status_code == 404


def test_resource_rejects_unsafe_filename() -> None:
    with TestClient(make_test_app()) as client:
        response = client.get("/api/resources/../secret.pdf/url")

    assert response.status_code == 404


def test_upload_route_is_not_registered() -> None:
    with TestClient(make_test_app()) as client:
        response = client.post("/api/uploads")

    assert response.status_code == 404


def test_invalid_asset_uuid_returns_client_error() -> None:
    with TestClient(make_test_app()) as client:
        response = client.get("/api/assets/not-a-uuid")

    assert response.status_code in {400, 404}


def test_docs_are_available() -> None:
    with TestClient(make_test_app()) as client:
        response = client.get("/docs")

    assert response.status_code == 200


def test_health_works_with_startup_skipped_and_otel_disabled() -> None:
    with TestClient(make_test_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

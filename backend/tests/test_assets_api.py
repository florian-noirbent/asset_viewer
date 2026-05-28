import os
import uuid
from collections.abc import AsyncGenerator
from decimal import Decimal

os.environ["GOCANOPY_SKIP_STARTUP"] = "true"

from fastapi.testclient import TestClient

from app.db.models import Asset, Lease, Tenant
from app.db.session import get_db_session
from app.main import app

ASSET_ID = uuid.UUID("d1994ec3-e121-4d5e-adec-014907116986")
PDF_FILENAME = "Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01 (1).pdf"


class FakeScalarResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return FakeScalarResult(self.rows)

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, asset: Asset | None = None, lease_rows=None):
        self.asset = asset
        self.lease_rows = lease_rows or []

    async def get(self, model, row_id):
        if model is Asset and row_id == ASSET_ID:
            return self.asset
        return None

    async def execute(self, statement):
        if self.asset and self.lease_rows:
            return FakeResult(self.lease_rows)
        if self.asset:
            return FakeResult([self.asset])
        return FakeResult([])


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


def make_lease_rows():
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


def override_session(fake_session: FakeSession):
    async def _override() -> AsyncGenerator[FakeSession, None]:
        yield fake_session

    app.dependency_overrides[get_db_session] = _override


def teardown_function():
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
    override_session(FakeSession(asset=make_asset(), lease_rows=make_lease_rows()))

    with TestClient(app) as client:
        response = client.get(f"/api/assets/{ASSET_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Causeway Park"
    assert len(body["leases"]) == 1
    assert body["leases"][0]["tenant"]["name"] == "Chiu Wah Ltd"
    assert next(field for field in body["fields"] if field["fieldPath"] == "asset.name")[
        "provenance"
    ][0]["pdfUrl"].endswith(PDF_FILENAME.replace(" ", "%20").replace("(", "%28").replace(")", "%29"))
    assert next(
        field for field in body["leases"][0]["fields"] if field["fieldPath"] == "lease.rent_gross"
    )["provenance"][0]["quote"] == "150,000"


def test_missing_asset_returns_404() -> None:
    override_session(FakeSession(asset=None))

    with TestClient(app) as client:
        response = client.get(f"/api/assets/{ASSET_ID}")

    assert response.status_code == 404


def test_resource_pdf_endpoint_serves_pdf() -> None:
    with TestClient(app) as client:
        response = client.get(f"/api/resources/{PDF_FILENAME}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"


def test_missing_resource_returns_404() -> None:
    with TestClient(app) as client:
        response = client.get("/api/resources/missing.pdf")

    assert response.status_code == 404

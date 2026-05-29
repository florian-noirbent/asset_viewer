from collections.abc import Sequence
from datetime import timezone
from decimal import Decimal
from pathlib import Path
import uuid


import pytest
from sqlalchemy.orm.interfaces import ORMOption

from app.db import init_from_json
from app.db.init_from_json import (
    DEFAULT_PDF_FILENAME,
    build_seed_records,
    load_json_rows,
    parse_datetime,
    parse_decimal,
    parse_nullable_string,
    resolve_pdf_path,
    resource_file_id,
    seed_database_from_json,
    seed_resource_pdf,
    seed_session,
)
from app.db.models import Asset, FileIndex, Lease, Tenant
from app.storage.minio_client import UploadedObject, safe_filename

RESOURCE_JSON = Path(__file__).resolve().parents[2] / "ressources" / "warrington_test_data.json"
RESOURCE_PDF = Path(__file__).resolve().parents[2] / "ressources" / DEFAULT_PDF_FILENAME


class FakeSeedSession:
    def __init__(self) -> None:
        self.assets: dict[uuid.UUID, Asset] = {}
        self.tenants: dict[str, Tenant] = {}
        self.leases: dict[str, Lease] = {}
        self.files: dict[uuid.UUID, FileIndex] = {}
        self.commits = 0

    async def merge(self, instance: object, *, load: bool = True, options: Sequence[ORMOption] | None = None) -> object:
        if isinstance(instance, Asset):
            self.assets[instance.id] = instance
        elif isinstance(instance, Tenant):
            self.tenants[instance.id] = instance
        elif isinstance(instance, Lease):
            self.leases[instance.id] = instance
        elif isinstance(instance, FileIndex):
            self.files[instance.id] = instance
        else:
            raise TypeError(f"Unexpected row type {type(instance)!r}")

        return instance

    async def commit(self) -> None:
        self.commits += 1


class FakeSettings:
    def __init__(self, bucket: str) -> None:
        self.minio_bucket = bucket


class FakeStorage:
    def __init__(self, bucket: str = "assets") -> None:
        self.settings = FakeSettings(bucket)
        self.objects: dict[str, bytes] = {}

    def upload_local_pdf(self, path: Path, object_prefix: str = "resources") -> UploadedObject:
        data = path.read_bytes()
        filename = safe_filename(path.name)
        object_key = f"{object_prefix}/{filename}"
        self.objects[object_key] = data
        return UploadedObject(
            filename=filename,
            content_type="application/pdf",
            size_bytes=len(data),
            bucket=self.settings.minio_bucket,
            object_key=object_key,
        )


class FakeSessionContext:
    def __init__(self, session: FakeSeedSession) -> None:
        self.session = session

    async def __aenter__(self) -> FakeSeedSession:
        return self.session

    async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
        return None


class FakeSessionMaker:
    def __init__(self, session: FakeSeedSession) -> None:
        self.session = session

    def __call__(self) -> FakeSessionContext:
        return FakeSessionContext(self.session)


def test_parse_empty_string_to_none() -> None:
    assert parse_nullable_string("") is None
    assert parse_nullable_string("  ") is None


def test_parse_numeric_string_to_decimal() -> None:
    assert parse_decimal("143277.8") == Decimal("143277.8")


def test_parse_iso_date_string_to_datetime() -> None:
    parsed = parse_datetime("2025-05-29T00:00:00Z")

    assert parsed is not None
    assert parsed.year == 2025
    assert parsed.tzinfo == timezone.utc


def test_build_seed_records_from_resource_json() -> None:
    rows = load_json_rows(RESOURCE_JSON)
    records = build_seed_records(rows)

    assert len(rows) == 6
    assert len(records.assets) == 1
    assert len(records.tenants) == 6
    assert len(records.leases) == 6
    assert records.assets[0].asset_provenance
    assert records.assets[0].logistics_provenance
    assert all(tenant.tenant_provenance for tenant in records.tenants)
    assert all(lease.lease_provenance for lease in records.leases)


@pytest.mark.asyncio
async def test_seed_session_is_idempotent_for_resource_json() -> None:
    rows = load_json_rows(RESOURCE_JSON)
    session = FakeSeedSession()

    await seed_session(session, rows)
    await seed_session(session, rows)

    assert len(session.assets) == 1
    assert len(session.tenants) == 6
    assert len(session.leases) == 6
    assert session.commits == 2


def test_resolve_pdf_path_finds_bundled_pdf_next_to_json() -> None:
    assert resolve_pdf_path(RESOURCE_JSON) == RESOURCE_PDF


@pytest.mark.asyncio
async def test_seed_resource_pdf_uploads_and_upserts_file_index() -> None:
    session = FakeSeedSession()
    storage = FakeStorage()

    first = await seed_resource_pdf(session, storage, RESOURCE_PDF)
    second = await seed_resource_pdf(session, storage, RESOURCE_PDF)

    assert first.id == second.id
    assert len(session.files) == 1
    assert first.filename == "Warrington_Portfolio_Warrington_Central_TE_and_Causeway_Park_IE_iBRO.01_1.pdf"
    assert first.object_key == f"resources/{first.filename}"
    assert first.id == resource_file_id(first.object_key)
    assert storage.objects[first.object_key].startswith(b"%PDF")
    assert session.commits == 2


@pytest.mark.asyncio
async def test_seed_database_from_json_seeds_content_only(monkeypatch: pytest.MonkeyPatch) -> None:
    session = FakeSeedSession()
    storage = FakeStorage()

    monkeypatch.setattr(init_from_json, "get_sessionmaker", lambda: FakeSessionMaker(session))
    monkeypatch.setattr(init_from_json, "get_object_storage", lambda: storage)
    monkeypatch.setattr(init_from_json, "resolve_pdf_path", lambda path: RESOURCE_PDF)

    records = await seed_database_from_json(RESOURCE_JSON)

    assert len(records.assets) == 1
    assert len(session.assets) == 1
    assert len(session.files) == 1

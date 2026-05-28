from collections.abc import AsyncGenerator
from datetime import UTC, datetime
import os
from uuid import UUID

os.environ["GOCANOPY_SKIP_STARTUP"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.api.routes.uploads import safe_filename
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.main import app
from app.storage.minio_client import get_object_storage


class FakeSession:
    def __init__(self) -> None:
        self.rows = []

    def add(self, row) -> None:
        row.created_at = datetime.now(UTC)
        self.rows.append(row)

    async def commit(self) -> None:
        return None

    async def refresh(self, row) -> None:
        return None


class FakeStorage:
    def __init__(self) -> None:
        self.objects = {}

    def upload_bytes(self, object_key: str, data: bytes, content_type: str) -> None:
        self.objects[object_key] = {"data": data, "content_type": content_type}


@pytest.fixture()
def fake_dependencies():
    session = FakeSession()
    storage = FakeStorage()
    settings = Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        minio_bucket="assets",
        skip_startup_checks=True,
    )

    async def override_session() -> AsyncGenerator[FakeSession, None]:
        yield session

    app.dependency_overrides[get_db_session] = override_session
    app.dependency_overrides[get_object_storage] = lambda: storage
    app.dependency_overrides[get_settings] = lambda: settings
    yield session, storage
    app.dependency_overrides.clear()


def test_safe_filename_removes_unsafe_characters() -> None:
    assert safe_filename("../asset report.pdf") == "asset_report.pdf"


def test_upload_requires_file(fake_dependencies) -> None:
    with TestClient(app) as client:
        response = client.post("/api/uploads")

    assert response.status_code == 422


def test_upload_stores_object_and_metadata(fake_dependencies) -> None:
    session, storage = fake_dependencies

    with TestClient(app) as client:
        response = client.post(
            "/api/uploads",
            files={"file": ("asset.pdf", b"hello pdf", "application/pdf")},
        )

    assert response.status_code == 201
    body = response.json()
    UUID(body["id"])
    assert body["filename"] == "asset.pdf"
    assert body["content_type"] == "application/pdf"
    assert body["size_bytes"] == 9
    assert body["bucket"] == "assets"
    assert body["status"] == "uploaded"
    assert body["object_key"].endswith("/original/asset.pdf")
    assert storage.objects[body["object_key"]]["data"] == b"hello pdf"
    assert len(session.rows) == 1
    assert session.rows[0].object_key == body["object_key"]

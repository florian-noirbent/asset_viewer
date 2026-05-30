import uuid
from pathlib import Path
from typing import Any, cast

import pytest

from app.core.config import Settings
from app.db.models import FileIndex
from app.services.exceptions import ResourceNotFoundError
from app.services.resources import ResourceService
from app.storage.minio_client import UploadedObject


class FakeFileIndexRepository:
    def __init__(self, indexes: dict[str, FileIndex]) -> None:
        self.indexes = indexes

    async def get_by_filename(self, filename: str) -> FileIndex | None:
        return self.indexes.get(filename)


class FakeStorage:
    def __init__(self, missing_objects: set[str] | None = None) -> None:
        self.missing_objects = missing_objects or set()

    def ensure_bucket(self, retries: int = 10, delay_seconds: float = 1.0) -> None:
        return None

    def object_exists(self, object_key: str) -> bool:
        return object_key not in self.missing_objects

    def presigned_get_url(self, object_key: str, expires_seconds: int) -> str:
        return f"http://storage.local/{object_key}?expires={expires_seconds}"

    def upload_local_resource(self, path: Path, object_prefix: str = "resources") -> UploadedObject:
        raise NotImplementedError


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


def make_service(indexes: dict[str, FileIndex], storage: FakeStorage | None = None) -> ResourceService:
    return ResourceService(
        cast(Any, FakeFileIndexRepository(indexes)),
        storage or FakeStorage(),
        Settings(
            database_url="postgresql+asyncpg://test:test@localhost/test",
            minio_bucket="assets",
            skip_startup_checks=True,
        ),
    )


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("source_viewer_demo.pdf", "application/pdf"),
        ("source_viewer_demo.csv", "text/csv"),
        ("source_viewer_demo.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ],
)
async def test_get_resource_url_returns_presigned_url_for_supported_indexed_resources(filename: str, content_type: str) -> None:
    service = make_service({filename: make_file_index(filename, content_type)})

    response = await service.get_resource_url(filename)

    assert response.url == f"http://storage.local/resources/{filename}?expires=900"
    assert response.expires_in_seconds == 900


@pytest.mark.parametrize("filename", ["../source_viewer_demo.pdf", "missing.pdf", "notes.txt"])
async def test_get_resource_url_rejects_unsafe_unindexed_or_unsupported_resources(filename: str) -> None:
    service = make_service({})

    with pytest.raises(ResourceNotFoundError):
        await service.get_resource_url(filename)


async def test_get_resource_url_rejects_missing_storage_object() -> None:
    filename = "source_viewer_demo.csv"
    service = make_service(
        {filename: make_file_index(filename, "text/csv")},
        FakeStorage(missing_objects={f"resources/{filename}"}),
    )

    with pytest.raises(ResourceNotFoundError):
        await service.get_resource_url(filename)

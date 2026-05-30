from pathlib import Path
from typing import Any, BinaryIO, TypedDict, cast

import pytest

from app.core.config import Settings
from app.storage.minio_client import ObjectStorage, safe_filename


class StoredObject(TypedDict):
    data: bytes
    length: int
    content_type: str


class FakeResponse:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.closed = False
        self.released = False

    def read(self) -> bytes:
        return self.data

    def close(self) -> None:
        self.closed = True

    def release_conn(self) -> None:
        self.released = True


class FakeMinioClient:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], StoredObject] = {}
        self.last_response: FakeResponse | None = None

    def put_object(self, bucket: str, object_key: str, data: BinaryIO, length: int, content_type: str) -> None:
        self.objects[(bucket, object_key)] = {
            "data": data.read(),
            "length": length,
            "content_type": content_type,
        }

    def get_object(self, bucket: str, object_key: str) -> FakeResponse:
        stored = self.objects[(bucket, object_key)]
        self.last_response = FakeResponse(stored["data"])
        return self.last_response

    def stat_object(self, bucket: str, object_key: str) -> object:
        if (bucket, object_key) not in self.objects:
            raise FileNotFoundError(object_key)
        return object()

    def presigned_get_object(self, bucket: str, object_key: str, expires: object) -> str:
        return f"http://localhost:9000/{bucket}/{object_key}?expires={expires}"


def make_storage() -> ObjectStorage:
    storage = cast(Any, ObjectStorage.__new__(ObjectStorage))
    storage.settings = Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        minio_bucket="assets",
        skip_startup_checks=True,
    )
    storage.client = FakeMinioClient()
    storage.public_client = FakeMinioClient()
    return cast(ObjectStorage, storage)


def fake_client(storage: ObjectStorage) -> FakeMinioClient:
    return cast(FakeMinioClient, storage.client)


def test_safe_filename_removes_unsafe_characters() -> None:
    assert safe_filename("../asset report.pdf") == "asset_report.pdf"
    assert safe_filename("Warrington (1).pdf") == "Warrington_1.pdf"


def test_upload_local_resource_uses_idempotent_resource_key(tmp_path: Path) -> None:
    pdf_path = tmp_path / "Asset Report (1).pdf"
    pdf_path.write_bytes(b"%PDF-1.4")
    storage = make_storage()

    first = storage.upload_local_resource(pdf_path)
    second = storage.upload_local_resource(pdf_path)

    assert first == second
    assert first.filename == "Asset_Report_1.pdf"
    assert first.object_key == "resources/Asset_Report_1.pdf"
    client = fake_client(storage)
    assert client.objects[("assets", first.object_key)]["data"] == b"%PDF-1.4"
    assert client.objects[("assets", first.object_key)]["content_type"] == "application/pdf"


def test_upload_local_resource_supports_csv_and_xlsx(tmp_path: Path) -> None:
    csv_path = tmp_path / "rent roll.csv"
    csv_path.write_text("lease_id,tenant\n1,Northstar\n", encoding="utf-8")
    xlsx_path = tmp_path / "model.xlsx"
    xlsx_path.write_bytes(b"PK\x03\x04")
    storage = make_storage()

    csv_upload = storage.upload_local_resource(csv_path)
    xlsx_upload = storage.upload_local_resource(xlsx_path)

    client = fake_client(storage)
    assert csv_upload.object_key == "resources/rent_roll.csv"
    assert xlsx_upload.object_key == "resources/model.xlsx"
    assert client.objects[("assets", csv_upload.object_key)]["content_type"] == "text/csv"
    assert client.objects[("assets", xlsx_upload.object_key)]["content_type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_upload_local_resource_rejects_unsupported_file(tmp_path: Path) -> None:
    storage = make_storage()
    path = tmp_path / "notes.txt"
    path.write_text("hello", encoding="utf-8")

    with pytest.raises(ValueError):
        storage.upload_local_resource(path)


def test_read_bytes_closes_minio_response() -> None:
    storage = make_storage()
    storage.upload_bytes("resources/report.pdf", b"%PDF", "application/pdf")

    assert storage.read_bytes("resources/report.pdf") == b"%PDF"
    response = fake_client(storage).last_response
    assert response is not None
    assert response.closed
    assert response.released


def test_presigned_get_url_uses_public_client_endpoint() -> None:
    storage = make_storage()

    assert storage.presigned_get_url("resources/report.pdf", 900).startswith("http://localhost:9000/assets/resources/report.pdf?")


def test_object_exists_checks_minio_object() -> None:
    storage = make_storage()
    storage.upload_bytes("resources/report.pdf", b"%PDF", "application/pdf")

    assert storage.object_exists("resources/report.pdf")
    assert not storage.object_exists("resources/missing.pdf")

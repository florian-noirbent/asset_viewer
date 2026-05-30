from dataclasses import dataclass
from datetime import timedelta
from io import BytesIO
from pathlib import Path
import re
from time import sleep

from app.core.config import Settings, get_settings

PDF_CONTENT_TYPE = "application/pdf"
CSV_CONTENT_TYPE = "text/csv"
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
RESOURCE_CONTENT_TYPES = {
    ".csv": CSV_CONTENT_TYPE,
    ".pdf": PDF_CONTENT_TYPE,
    ".xlsx": XLSX_CONTENT_TYPE,
}


@dataclass(frozen=True)
class UploadedObject:
    filename: str
    content_type: str
    size_bytes: int
    bucket: str
    object_key: str


def safe_filename(filename: str) -> str:
    name = Path(filename or "upload").name
    path = Path(name)
    suffix = path.suffix if path.suffix else ""
    stem = path.stem if suffix else name
    cleaned_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._")
    cleaned_suffix = re.sub(r"[^A-Za-z0-9.]+", "", suffix)
    return f"{cleaned_stem or 'upload'}{cleaned_suffix}"


class ObjectStorage:
    def __init__(self, settings: Settings | None = None) -> None:
        from minio import Minio

        self.settings = settings or get_settings()
        self.client = Minio(
            self.settings.minio_endpoint,
            access_key=self.settings.minio_access_key,
            secret_key=self.settings.minio_secret_key,
            secure=self.settings.minio_secure,
            region=self.settings.minio_region,
        )
        self.public_client = Minio(
            self.settings.minio_public_endpoint,
            access_key=self.settings.minio_access_key,
            secret_key=self.settings.minio_secret_key,
            secure=self.settings.resolved_minio_public_secure,
            region=self.settings.minio_region,
        )

    def ensure_bucket(self, retries: int = 10, delay_seconds: float = 1.0) -> None:
        for attempt in range(1, retries + 1):
            try:
                if not self.client.bucket_exists(self.settings.minio_bucket):
                    self.client.make_bucket(self.settings.minio_bucket)
                return
            except Exception:
                if attempt == retries:
                    raise
                sleep(delay_seconds)

    def upload_bytes(
        self,
        object_key: str,
        data: bytes,
        content_type: str,
    ) -> None:
        self.client.put_object(
            self.settings.minio_bucket,
            object_key,
            BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    def read_bytes(self, object_key: str) -> bytes:
        response = self.client.get_object(self.settings.minio_bucket, object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def download_bytes(self, object_key: str) -> bytes:
        return self.read_bytes(object_key)

    def object_exists(self, object_key: str) -> bool:
        try:
            self.client.stat_object(self.settings.minio_bucket, object_key)
            return True
        except Exception:
            return False

    def presigned_get_url(self, object_key: str, expires_seconds: int) -> str:
        return self.public_client.presigned_get_object(
            self.settings.minio_bucket,
            object_key,
            expires=timedelta(seconds=expires_seconds),
        )

    def upload_local_resource(self, path: Path, object_prefix: str = "resources") -> UploadedObject:
        filename = safe_filename(path.name)
        content_type = content_type_for_resource(path)

        data = path.read_bytes()
        object_key = f"{object_prefix.rstrip('/')}/{filename}"
        self.upload_bytes(object_key, data, content_type)
        return UploadedObject(
            filename=filename,
            content_type=content_type,
            size_bytes=len(data),
            bucket=self.settings.minio_bucket,
            object_key=object_key,
        )


def content_type_for_resource(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in RESOURCE_CONTENT_TYPES:
        return RESOURCE_CONTENT_TYPES[suffix]

    raise ValueError(f"Unsupported resource file type: {path}")


def get_object_storage() -> ObjectStorage:
    return ObjectStorage()

from pathlib import Path
from typing import Protocol, runtime_checkable

from app.storage.minio_client import UploadedObject


@runtime_checkable
class StoragePort(Protocol):
    def ensure_bucket(self, retries: int = 10, delay_seconds: float = 1.0) -> None: ...

    def object_exists(self, object_key: str) -> bool: ...

    def presigned_get_url(self, object_key: str, expires_seconds: int) -> str: ...

    def upload_local_pdf(self, path: Path, object_prefix: str = "resources") -> UploadedObject: ...

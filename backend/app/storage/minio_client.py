from io import BytesIO
from time import sleep

from app.core.config import Settings, get_settings


class ObjectStorage:
    def __init__(self, settings: Settings | None = None) -> None:
        from minio import Minio

        self.settings = settings or get_settings()
        self.client = Minio(
            self.settings.minio_endpoint,
            access_key=self.settings.minio_access_key,
            secret_key=self.settings.minio_secret_key,
            secure=self.settings.minio_secure,
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


def get_object_storage() -> ObjectStorage:
    return ObjectStorage()

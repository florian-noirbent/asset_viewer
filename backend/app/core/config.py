from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+asyncpg://gocanopy:gocanopy@localhost:5432/gocanopy",
        validation_alias="DATABASE_URL",
    )
    minio_endpoint: str = Field(default="localhost:9000", validation_alias="MINIO_ENDPOINT")
    minio_public_endpoint: str = Field(default="localhost:9000", validation_alias="MINIO_PUBLIC_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", validation_alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", validation_alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="assets", validation_alias="MINIO_BUCKET")
    minio_secure: bool = Field(default=False, validation_alias="MINIO_SECURE")
    minio_region: str = Field(default="us-east-1", validation_alias="MINIO_REGION")
    minio_presigned_url_expires_seconds: int = Field(default=900, validation_alias="MINIO_PRESIGNED_URL_EXPIRES_SECONDS")
    backend_cors_origins: str = Field(default="http://localhost:5173", validation_alias="BACKEND_CORS_ORIGINS")
    skip_startup_checks: bool = Field(default=False, validation_alias="GOCANOPY_SKIP_STARTUP")
    otel_enabled: bool = Field(default=False, validation_alias="GOCANOPY_OTEL_ENABLED")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

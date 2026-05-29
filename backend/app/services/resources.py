from pathlib import Path

from app.api.dto import ResourceUrlDTO
from app.core.config import Settings
from app.db.repositories import FileIndexRepository
from app.services.exceptions import ResourceNotFoundError
from app.storage.minio_client import safe_filename
from app.storage.ports import StoragePort


class ResourceService:
    def __init__(self, file_index_repository: FileIndexRepository, storage: StoragePort, settings: Settings) -> None:
        self.file_index_repository = file_index_repository
        self.storage = storage
        self.settings = settings

    async def get_resource_pdf_url(self, filename: str) -> ResourceUrlDTO:
        requested_filename = Path(filename).name
        if requested_filename != filename or Path(filename).suffix.lower() != ".pdf":
            raise ResourceNotFoundError

        index_filename = safe_filename(requested_filename)
        file_index = await self.file_index_repository.get_by_filename(index_filename)
        if file_index is None:
            raise ResourceNotFoundError

        try:
            if not self.storage.object_exists(file_index.object_key):
                raise FileNotFoundError(file_index.object_key)
            url = self.storage.presigned_get_url(file_index.object_key, self.settings.minio_presigned_url_expires_seconds)
        except Exception as error:
            raise ResourceNotFoundError from error

        return ResourceUrlDTO(
            url=url,
            expires_in_seconds=self.settings.minio_presigned_url_expires_seconds,
        )

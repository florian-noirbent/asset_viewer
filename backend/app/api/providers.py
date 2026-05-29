from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.repositories import AssetRepository, FileIndexRepository
from app.services.assets import AssetService
from app.services.provenance import ProvenanceService
from app.services.resources import ResourceService
from app.storage.ports import StoragePort


def provide_asset_service(db_session: AsyncSession, storage: StoragePort, settings: Settings) -> AssetService:
    return AssetService(
        asset_repository=AssetRepository(db_session),
        file_index_repository=FileIndexRepository(db_session),
        provenance_service=ProvenanceService(storage, settings),
    )


def provide_resource_service(db_session: AsyncSession, storage: StoragePort, settings: Settings) -> ResourceService:
    return ResourceService(
        file_index_repository=FileIndexRepository(db_session),
        storage=storage,
        settings=settings,
    )

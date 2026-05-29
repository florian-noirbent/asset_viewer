import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, FileIndex, Lease, Tenant


class AssetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_assets(self) -> list[Asset]:
        result = await self.session.execute(select(Asset).order_by(Asset.name))
        return list(result.scalars().all())

    async def get_asset(self, asset_id: uuid.UUID) -> Asset | None:
        return await self.session.get(Asset, asset_id)

    async def list_lease_tenant_rows(self, asset_id: uuid.UUID) -> list[tuple[Lease, Tenant]]:
        result = await self.session.execute(select(Lease, Tenant).join(Tenant, Tenant.id == Lease.tenant_id).where(Lease.asset_id == asset_id).order_by(Lease.id))
        return [(lease, tenant) for lease, tenant in result.all()]


class FileIndexRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_file_indexes(self) -> dict[str, FileIndex]:
        result = await self.session.execute(select(FileIndex))
        return {file_index.filename: file_index for file_index in result.scalars().all()}

    async def get_by_filename(self, filename: str) -> FileIndex | None:
        result = await self.session.execute(select(FileIndex).where(FileIndex.filename == filename))
        return result.scalars().first()

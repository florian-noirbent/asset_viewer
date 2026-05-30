import uuid

from app.api.dto import AssetDetailDTO, AssetSummaryDTO, LeaseDTO, TenantSummaryDTO
from app.db.models import Asset
from app.db.repositories import AssetRepository, FileIndexRepository
from app.services.exceptions import AssetNotFoundError
from app.services.provenance import ProvenanceService


class AssetService:
    def __init__(
        self,
        asset_repository: AssetRepository,
        file_index_repository: FileIndexRepository,
        provenance_service: ProvenanceService,
    ) -> None:
        self.asset_repository = asset_repository
        self.file_index_repository = file_index_repository
        self.provenance_service = provenance_service

    async def list_assets(self) -> list[AssetSummaryDTO]:
        assets = await self.asset_repository.list_assets()
        return [serialize_asset_summary(asset) for asset in assets]

    async def get_asset_detail(self, asset_id: uuid.UUID, base_url: str) -> AssetDetailDTO:
        asset = await self.asset_repository.get_asset(asset_id)
        if asset is None:
            raise AssetNotFoundError

        lease_rows = await self.asset_repository.list_lease_tenant_rows(asset_id)
        file_indexes = await self.file_index_repository.list_file_indexes()
        summary = serialize_asset_summary(asset)

        return AssetDetailDTO(
            id=summary.id,
            name=summary.name,
            address=summary.address,
            city=summary.city,
            country=summary.country,
            assetType=summary.assetType,
            propertyType=summary.propertyType,
            currency=summary.currency,
            fields=self.provenance_service.serialize_asset_fields(asset, base_url, file_indexes),
            leases=[
                LeaseDTO(
                    id=lease.id,
                    tenant=TenantSummaryDTO(
                        id=tenant.id,
                        name=tenant.name,
                        industry=tenant.industry,
                    ),
                    fields=self.provenance_service.serialize_lease_fields(lease, base_url, file_indexes),
                    tenantFields=self.provenance_service.serialize_tenant_fields(tenant, base_url, file_indexes),
                )
                for lease, tenant in lease_rows
            ],
        )


def serialize_asset_summary(asset: Asset) -> AssetSummaryDTO:
    return AssetSummaryDTO(
        id=str(asset.id),
        name=asset.name,
        address=asset.address,
        city=asset.city,
        country=asset.country,
        assetType=asset.asset_type,
        propertyType=asset.property_type,
        currency=asset.currency,
    )

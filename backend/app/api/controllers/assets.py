import uuid

from litestar import Controller, Request, get
from litestar.datastructures import State
from litestar.exceptions import NotFoundException
from litestar.params import FromPath

from app.api.dto import AssetDetailDTO, AssetSummaryDTO, ResourceUrlDTO
from app.services.assets import AssetService
from app.services.exceptions import AssetNotFoundError, ResourceNotFoundError
from app.services.resources import ResourceService

type AppRequest = Request[object, object, State]


class AssetController(Controller):
    path = "/api"
    tags = ["assets"]

    @get("/assets")
    async def list_assets(self, asset_service: AssetService) -> list[AssetSummaryDTO]:
        return await asset_service.list_assets()

    @get("/assets/{asset_id:uuid}")
    async def get_asset(self, asset_id: FromPath[uuid.UUID], request: AppRequest, asset_service: AssetService) -> AssetDetailDTO:
        try:
            return await asset_service.get_asset_detail(asset_id, str(request.base_url))
        except AssetNotFoundError as error:
            raise NotFoundException(detail="Asset not found") from error

    @get("/resources/{filename:str}/url", name="get_resource_url")
    async def get_resource_url(self, filename: FromPath[str], resource_service: ResourceService) -> ResourceUrlDTO:
        try:
            return await resource_service.get_resource_url(filename)
        except ResourceNotFoundError as error:
            raise NotFoundException(detail="Resource not found") from error

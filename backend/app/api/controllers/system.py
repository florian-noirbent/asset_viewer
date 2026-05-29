from litestar import get

from app.api.dto import HealthDTO


@get("/health", tags=["system"])
async def health() -> HealthDTO:
    return HealthDTO(status="ok")

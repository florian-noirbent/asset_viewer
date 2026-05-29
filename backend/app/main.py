from collections.abc import Callable
import os

from advanced_alchemy.extensions.litestar import AsyncSessionConfig, EngineConfig, SQLAlchemyAsyncConfig, SQLAlchemyPlugin
from litestar import Litestar, Request
from litestar.config.cors import CORSConfig
from litestar.datastructures import State
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.openapi import OpenAPIConfig
from litestar.openapi.plugins import SwaggerRenderPlugin
from litestar.plugins import PluginProtocol
from litestar.plugins.opentelemetry import OpenTelemetryConfig, OpenTelemetryPlugin
from litestar.response import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.api.controllers.assets import AssetController
from app.api.controllers.system import health
from app.api.providers import provide_asset_service, provide_resource_service
from app.core.config import Settings, get_settings
from app.db.models import Base
from app.services.assets import AssetService
from app.services.resources import ResourceService
from app.storage.minio_client import ObjectStorage
from app.storage.ports import StoragePort

from anyio.to_thread import run_sync

type AppRequest = Request[object, object, State]


def create_app(
    settings: Settings | None = None,
    storage: StoragePort | None = None,
    asset_service_provider: Callable[[], AssetService] | None = None,
    resource_service_provider: Callable[[], ResourceService] | None = None,
) -> Litestar:
    resolved_settings = settings or get_settings()
    resolved_storage = storage or ObjectStorage(resolved_settings)

    dependencies = {
        "settings": Provide(lambda: resolved_settings, sync_to_thread=False),
        "storage": Provide(lambda: resolved_storage, sync_to_thread=False),
        "asset_service": Provide(asset_service_provider or provide_asset_service, sync_to_thread=False),
        "resource_service": Provide(resource_service_provider or provide_resource_service, sync_to_thread=False),
    }

    plugins: list[PluginProtocol] = []
    if asset_service_provider is None or resource_service_provider is None:
        plugins.append(create_sqlalchemy_plugin(resolved_settings))

    if should_enable_opentelemetry(resolved_settings):
        plugins.append(OpenTelemetryPlugin(OpenTelemetryConfig(exclude=["/health"])))

    return Litestar(
        route_handlers=[health, AssetController],
        dependencies=dependencies,
        plugins=plugins,
        cors_config=CORSConfig(
            allow_origins=resolved_settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        ),
        openapi_config=OpenAPIConfig(
            title="GoCanopy API",
            version="0.1.0",
            path="/docs",
            render_plugins=[SwaggerRenderPlugin()],
        ),
        exception_handlers={HTTPException: http_exception_handler},
        on_startup=[startup_checks],
        state=State({"settings": resolved_settings, "storage": resolved_storage}),
    )


def create_sqlalchemy_plugin(settings: Settings) -> SQLAlchemyPlugin:
    config = SQLAlchemyAsyncConfig(
        connection_string=settings.database_url,
        metadata=Base.metadata,
        engine_config=EngineConfig(pool_pre_ping=True),
        session_config=AsyncSessionConfig(expire_on_commit=False),
    )
    return SQLAlchemyPlugin(config=config)


def should_enable_opentelemetry(settings: Settings) -> bool:
    return settings.otel_enabled or bool(os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))


async def startup_checks(app: Litestar) -> None:
    settings = app.state.settings
    storage = app.state.storage
    if settings.skip_startup_checks:
        return

    engine = getattr(app.state, "db_engine", None)
    if isinstance(engine, AsyncEngine):
        async with engine.connect() as connection:
            await connection.execute(text("select 1"))

    await run_sync(storage.ensure_bucket)


def http_exception_handler(request: AppRequest, exc: HTTPException) -> Response[dict[str, str]]:
    return Response(content={"detail": exc.detail}, status_code=exc.status_code)


app = create_app()

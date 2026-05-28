import argparse
import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, Lease, Tenant
from app.db.session import get_sessionmaker, init_db

DEFAULT_JSON_PATH = Path("/app/ressources/warrington_test_data.json")


@dataclass(frozen=True)
class SeedRecords:
    assets: list[Asset]
    tenants: list[Tenant]
    leases: list[Lease]


def parse_nullable_string(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None

    return str(value)


def parse_decimal(value: Any) -> Decimal | None:
    nullable = parse_nullable_string(value)

    if nullable is None:
        return None

    try:
        return Decimal(nullable)
    except InvalidOperation as error:
        raise ValueError(f"Expected numeric value, got {value!r}") from error


def parse_datetime(value: Any) -> datetime | None:
    nullable = parse_nullable_string(value)

    if nullable is None:
        return None

    return datetime.fromisoformat(nullable.replace("Z", "+00:00"))


def load_json_rows(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError(f"Expected {path} to contain a JSON list")

    return data


def build_seed_records(rows: list[dict[str, Any]]) -> SeedRecords:
    assets: dict[uuid.UUID, Asset] = {}
    tenants: dict[str, Tenant] = {}
    leases: dict[str, Lease] = {}

    for row in rows:
        asset = build_asset(row)
        tenant = build_tenant(row)
        lease = build_lease(row)

        assets[asset.id] = asset
        tenants[tenant.id] = tenant
        leases[lease.id] = lease

    return SeedRecords(
        assets=list(assets.values()),
        tenants=list(tenants.values()),
        leases=list(leases.values()),
    )


def build_asset(row: dict[str, Any]) -> Asset:
    return Asset(
        id=uuid.UUID(required(row, "asset_id")),
        name=required(row, "asset_name"),
        address=parse_nullable_string(row.get("address")),
        city=parse_nullable_string(row.get("city")),
        country=parse_nullable_string(row.get("country")),
        asset_type=parse_nullable_string(row.get("asset_type")),
        tenure=parse_nullable_string(row.get("tenure")),
        current_owner=parse_nullable_string(row.get("current_owner")),
        construction_completed_in=parse_nullable_string(row.get("construction_completed_in")),
        currency=parse_nullable_string(row.get("asset_currency")),
        customer_asset_code=parse_nullable_string(row.get("customer_asset_code")),
        property_type=parse_nullable_string(row.get("property_type")),
        project_type=parse_nullable_string(row.get("project_type")),
        building_area_sf=parse_decimal(row.get("building_area_sf")),
        building_area_sm=parse_decimal(row.get("building_area_sm")),
        area_site=parse_decimal(row.get("area_site")),
        area_vacant=parse_decimal(row.get("area_vacant")),
        building_occupancy=parse_decimal(row.get("building_occupancy")),
        no_of_floors=parse_nullable_string(row.get("no_of_floors")),
        height=parse_nullable_string(row.get("height")),
        doors_dock=parse_nullable_string(row.get("doors_dock")),
        doors_overhead=parse_nullable_string(row.get("doors_overhead")),
        parking_spaces_cars=parse_nullable_string(row.get("parking_spaces_cars")),
        parking_spaces_trucks=parse_nullable_string(row.get("parking_spaces_trucks")),
        sprinkler=parse_nullable_string(row.get("sprinkler")),
        environmental_rating=parse_nullable_string(row.get("environmental_rating")),
        rent_gross=parse_decimal(row.get("asset_rent_gross")),
        rent_pu=parse_decimal(row.get("asset_rent_pu")),
        rent_roll_date=parse_datetime(row.get("rent_roll_date")),
        walt=parse_decimal(row.get("asset_walt")),
        walb=parse_decimal(row.get("asset_walb")),
        erv=parse_decimal(row.get("asset_erv")),
        asset_provenance=row.get("asset_provenance") or {},
        logistics_provenance=row.get("logistics_provenance") or {},
    )


def build_tenant(row: dict[str, Any]) -> Tenant:
    return Tenant(
        id=required(row, "tenant_id"),
        name=required(row, "tenant_name"),
        industry=parse_nullable_string(row.get("tenant_industry")),
        tenant_provenance=row.get("tenant_provenance") or {},
    )


def build_lease(row: dict[str, Any]) -> Lease:
    return Lease(
        id=required(row, "lease_id"),
        asset_id=uuid.UUID(required(row, "asset_id")),
        tenant_id=required(row, "tenant_id"),
        lease_type=parse_nullable_string(row.get("lease_type")),
        area_sf=parse_decimal(row.get("lease_area_sf")),
        area_sm=parse_decimal(row.get("lease_area_sm")),
        area_warehouse=parse_decimal(row.get("area_warehouse")),
        area_office=parse_decimal(row.get("area_office")),
        date_start=parse_datetime(row.get("date_start")),
        date_expire=parse_datetime(row.get("date_expire")),
        date_break1=parse_datetime(row.get("date_break1")),
        date_break2=parse_datetime(row.get("date_break2")),
        next_indexation_date=parse_datetime(row.get("next_indexation_date")),
        contracted_indexation=parse_nullable_string(row.get("contracted_indexation")),
        rent_gross=parse_decimal(row.get("lease_rent_gross")),
        rent_pu=parse_decimal(row.get("lease_rent_pu")),
        currency=parse_nullable_string(row.get("lease_currency")),
        rent_free_months=parse_decimal(row.get("rent_free_months")),
        non_recoverables=parse_decimal(row.get("non_recoverables")),
        void_costs_pa=parse_decimal(row.get("void_costs_pa")),
        walt=parse_decimal(row.get("lease_walt")),
        walb=parse_decimal(row.get("lease_walb")),
        erv=parse_decimal(row.get("lease_erv")),
        lessee_name_verbatim=parse_nullable_string(row.get("lessee_name_verbatim")),
        signing_entity=parse_nullable_string(row.get("signing_entity")),
        lease_provenance=row.get("lease_provenance") or {},
    )


async def seed_session(session: AsyncSession, rows: list[dict[str, Any]]) -> SeedRecords:
    records = build_seed_records(rows)

    for asset in records.assets:
        await session.merge(asset)

    for tenant in records.tenants:
        await session.merge(tenant)

    for lease in records.leases:
        await session.merge(lease)

    await session.commit()
    return records


async def initialize_database_from_json(path: Path) -> SeedRecords:
    await init_db()
    rows = load_json_rows(path)

    async with get_sessionmaker()() as session:
        return await seed_session(session, rows)


def required(row: dict[str, Any], key: str) -> str:
    value = parse_nullable_string(row.get(key))

    if value is None:
        raise ValueError(f"Missing required field {key!r}")

    return value


def resolve_default_path() -> Path:
    if DEFAULT_JSON_PATH.exists():
        return DEFAULT_JSON_PATH

    repo_path = Path(__file__).resolve().parents[3] / "ressources" / "warrington_test_data.json"
    return repo_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initialize GoCanopy DB from a lease JSON export")
    parser.add_argument(
        "json_path",
        nargs="?",
        type=Path,
        default=resolve_default_path(),
        help="Path to the lease JSON file",
    )
    return parser.parse_args()


async def async_main() -> None:
    args = parse_args()
    records = await initialize_database_from_json(args.json_path)
    print(
        "Initialized database from JSON: "
        f"{len(records.assets)} assets, {len(records.tenants)} tenants, {len(records.leases)} leases"
    )


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()

from datetime import timezone
from decimal import Decimal
from pathlib import Path

import pytest

from app.db.init_from_json import (
    build_seed_records,
    load_json_rows,
    parse_datetime,
    parse_decimal,
    parse_nullable_string,
    seed_session,
)
from app.db.models import Asset, Lease, Tenant

RESOURCE_JSON = Path(__file__).resolve().parents[2] / "ressources" / "warrington_test_data.json"


class FakeSeedSession:
    def __init__(self) -> None:
        self.assets: dict[object, Asset] = {}
        self.tenants: dict[str, Tenant] = {}
        self.leases: dict[str, Lease] = {}
        self.commits = 0

    async def merge(self, row):
        if isinstance(row, Asset):
            self.assets[row.id] = row
        elif isinstance(row, Tenant):
            self.tenants[row.id] = row
        elif isinstance(row, Lease):
            self.leases[row.id] = row
        else:
            raise TypeError(f"Unexpected row type {type(row)!r}")

        return row

    async def commit(self) -> None:
        self.commits += 1


def test_parse_empty_string_to_none() -> None:
    assert parse_nullable_string("") is None
    assert parse_nullable_string("  ") is None


def test_parse_numeric_string_to_decimal() -> None:
    assert parse_decimal("143277.8") == Decimal("143277.8")


def test_parse_iso_date_string_to_datetime() -> None:
    parsed = parse_datetime("2025-05-29T00:00:00Z")

    assert parsed is not None
    assert parsed.year == 2025
    assert parsed.tzinfo == timezone.utc


def test_build_seed_records_from_resource_json() -> None:
    rows = load_json_rows(RESOURCE_JSON)
    records = build_seed_records(rows)

    assert len(rows) == 6
    assert len(records.assets) == 1
    assert len(records.tenants) == 6
    assert len(records.leases) == 6
    assert records.assets[0].asset_provenance
    assert records.assets[0].logistics_provenance
    assert all(tenant.tenant_provenance for tenant in records.tenants)
    assert all(lease.lease_provenance for lease in records.leases)


@pytest.mark.asyncio
async def test_seed_session_is_idempotent_for_resource_json() -> None:
    rows = load_json_rows(RESOURCE_JSON)
    session = FakeSeedSession()

    await seed_session(session, rows)
    await seed_session(session, rows)

    assert len(session.assets) == 1
    assert len(session.tenants) == 6
    assert len(session.leases) == 6
    assert session.commits == 2

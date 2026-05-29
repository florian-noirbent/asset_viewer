"""initial schema

Revision ID: 20260529_0001
Revises:
Create Date: 2026-05-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260529_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "file_index",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("bucket", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=1024), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("address", sa.String(length=1024), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("country", sa.String(length=255), nullable=True),
        sa.Column("asset_type", sa.String(length=255), nullable=True),
        sa.Column("tenure", sa.String(length=255), nullable=True),
        sa.Column("current_owner", sa.String(length=512), nullable=True),
        sa.Column("construction_completed_in", sa.String(length=255), nullable=True),
        sa.Column("currency", sa.String(length=16), nullable=True),
        sa.Column("customer_asset_code", sa.String(length=255), nullable=True),
        sa.Column("property_type", sa.String(length=255), nullable=True),
        sa.Column("project_type", sa.String(length=255), nullable=True),
        sa.Column("building_area_sf", sa.Numeric(), nullable=True),
        sa.Column("building_area_sm", sa.Numeric(), nullable=True),
        sa.Column("area_site", sa.Numeric(), nullable=True),
        sa.Column("area_vacant", sa.Numeric(), nullable=True),
        sa.Column("building_occupancy", sa.Numeric(), nullable=True),
        sa.Column("no_of_floors", sa.String(length=255), nullable=True),
        sa.Column("height", sa.String(length=255), nullable=True),
        sa.Column("doors_dock", sa.String(length=255), nullable=True),
        sa.Column("doors_overhead", sa.String(length=255), nullable=True),
        sa.Column("parking_spaces_cars", sa.String(length=255), nullable=True),
        sa.Column("parking_spaces_trucks", sa.String(length=255), nullable=True),
        sa.Column("sprinkler", sa.String(length=255), nullable=True),
        sa.Column("environmental_rating", sa.String(length=255), nullable=True),
        sa.Column("rent_gross", sa.Numeric(), nullable=True),
        sa.Column("rent_pu", sa.Numeric(), nullable=True),
        sa.Column("rent_roll_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("walt", sa.Numeric(), nullable=True),
        sa.Column("walb", sa.Numeric(), nullable=True),
        sa.Column("erv", sa.Numeric(), nullable=True),
        sa.Column("asset_provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("logistics_provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("industry", sa.String(length=255), nullable=True),
        sa.Column("tenant_provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "leases",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("lease_type", sa.String(length=255), nullable=True),
        sa.Column("area_sf", sa.Numeric(), nullable=True),
        sa.Column("area_sm", sa.Numeric(), nullable=True),
        sa.Column("area_warehouse", sa.Numeric(), nullable=True),
        sa.Column("area_office", sa.Numeric(), nullable=True),
        sa.Column("date_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("date_expire", sa.DateTime(timezone=True), nullable=True),
        sa.Column("date_break1", sa.DateTime(timezone=True), nullable=True),
        sa.Column("date_break2", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_indexation_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contracted_indexation", sa.String(length=255), nullable=True),
        sa.Column("rent_gross", sa.Numeric(), nullable=True),
        sa.Column("rent_pu", sa.Numeric(), nullable=True),
        sa.Column("currency", sa.String(length=16), nullable=True),
        sa.Column("rent_free_months", sa.Numeric(), nullable=True),
        sa.Column("non_recoverables", sa.Numeric(), nullable=True),
        sa.Column("void_costs_pa", sa.Numeric(), nullable=True),
        sa.Column("walt", sa.Numeric(), nullable=True),
        sa.Column("walb", sa.Numeric(), nullable=True),
        sa.Column("erv", sa.Numeric(), nullable=True),
        sa.Column("lessee_name_verbatim", sa.String(length=512), nullable=True),
        sa.Column("signing_entity", sa.String(length=512), nullable=True),
        sa.Column("lease_provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("leases")
    op.drop_table("tenants")
    op.drop_table("assets")
    op.drop_table("file_index")

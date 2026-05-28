import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class FileIndex(Base):
    __tablename__ = "file_index"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="uploaded")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    address: Mapped[str | None] = mapped_column(String(1024))
    city: Mapped[str | None] = mapped_column(String(255))
    country: Mapped[str | None] = mapped_column(String(255))
    asset_type: Mapped[str | None] = mapped_column(String(255))
    tenure: Mapped[str | None] = mapped_column(String(255))
    current_owner: Mapped[str | None] = mapped_column(String(512))
    construction_completed_in: Mapped[str | None] = mapped_column(String(255))
    currency: Mapped[str | None] = mapped_column(String(16))
    customer_asset_code: Mapped[str | None] = mapped_column(String(255))
    property_type: Mapped[str | None] = mapped_column(String(255))
    project_type: Mapped[str | None] = mapped_column(String(255))
    building_area_sf: Mapped[Decimal | None] = mapped_column(Numeric)
    building_area_sm: Mapped[Decimal | None] = mapped_column(Numeric)
    area_site: Mapped[Decimal | None] = mapped_column(Numeric)
    area_vacant: Mapped[Decimal | None] = mapped_column(Numeric)
    building_occupancy: Mapped[Decimal | None] = mapped_column(Numeric)
    no_of_floors: Mapped[str | None] = mapped_column(String(255))
    height: Mapped[str | None] = mapped_column(String(255))
    doors_dock: Mapped[str | None] = mapped_column(String(255))
    doors_overhead: Mapped[str | None] = mapped_column(String(255))
    parking_spaces_cars: Mapped[str | None] = mapped_column(String(255))
    parking_spaces_trucks: Mapped[str | None] = mapped_column(String(255))
    sprinkler: Mapped[str | None] = mapped_column(String(255))
    environmental_rating: Mapped[str | None] = mapped_column(String(255))
    rent_gross: Mapped[Decimal | None] = mapped_column(Numeric)
    rent_pu: Mapped[Decimal | None] = mapped_column(Numeric)
    rent_roll_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    walt: Mapped[Decimal | None] = mapped_column(Numeric)
    walb: Mapped[Decimal | None] = mapped_column(Numeric)
    erv: Mapped[Decimal | None] = mapped_column(Numeric)
    asset_provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    logistics_provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(255))
    tenant_provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Lease(Base):
    __tablename__ = "leases"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(255), ForeignKey("tenants.id"), nullable=False)
    lease_type: Mapped[str | None] = mapped_column(String(255))
    area_sf: Mapped[Decimal | None] = mapped_column(Numeric)
    area_sm: Mapped[Decimal | None] = mapped_column(Numeric)
    area_warehouse: Mapped[Decimal | None] = mapped_column(Numeric)
    area_office: Mapped[Decimal | None] = mapped_column(Numeric)
    date_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    date_expire: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    date_break1: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    date_break2: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_indexation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    contracted_indexation: Mapped[str | None] = mapped_column(String(255))
    rent_gross: Mapped[Decimal | None] = mapped_column(Numeric)
    rent_pu: Mapped[Decimal | None] = mapped_column(Numeric)
    currency: Mapped[str | None] = mapped_column(String(16))
    rent_free_months: Mapped[Decimal | None] = mapped_column(Numeric)
    non_recoverables: Mapped[Decimal | None] = mapped_column(Numeric)
    void_costs_pa: Mapped[Decimal | None] = mapped_column(Numeric)
    walt: Mapped[Decimal | None] = mapped_column(Numeric)
    walb: Mapped[Decimal | None] = mapped_column(Numeric)
    erv: Mapped[Decimal | None] = mapped_column(Numeric)
    lessee_name_verbatim: Mapped[str | None] = mapped_column(String(512))
    signing_entity: Mapped[str | None] = mapped_column(String(512))
    lease_provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

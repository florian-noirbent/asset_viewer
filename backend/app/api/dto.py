from dataclasses import dataclass


@dataclass(frozen=True)
class HealthDTO:
    status: str


@dataclass(frozen=True)
class ProvenanceDTO:
    document: str | None
    quote: str | None
    page: object | None
    sheet: object | None
    sourceType: object | None
    url: str | None
    refreshUrl: str | None
    expiresInSeconds: int | None


@dataclass(frozen=True)
class AssetFieldDTO:
    fieldPath: str
    label: str
    value: str | None
    provenance: list[ProvenanceDTO]


@dataclass(frozen=True)
class TenantSummaryDTO:
    id: str
    name: str
    industry: str | None


@dataclass(frozen=True)
class LeaseDTO:
    id: str
    tenant: TenantSummaryDTO
    fields: list[AssetFieldDTO]


@dataclass(frozen=True)
class AssetSummaryDTO:
    id: str
    name: str
    address: str | None
    city: str | None
    country: str | None
    assetType: str | None
    propertyType: str | None
    currency: str | None


@dataclass(frozen=True)
class AssetDetailDTO:
    id: str
    name: str
    address: str | None
    city: str | None
    country: str | None
    assetType: str | None
    propertyType: str | None
    currency: str | None
    fields: list[AssetFieldDTO]
    leases: list[LeaseDTO]


@dataclass(frozen=True)
class ResourceUrlDTO:
    url: str
    expires_in_seconds: int

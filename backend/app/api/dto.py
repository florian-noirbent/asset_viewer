from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, TypeAlias


@dataclass(frozen=True)
class HealthDTO:
    status: str


@dataclass(frozen=True)
class BaseProvenanceDTO:
    quote: str
    sourceType: str


@dataclass(frozen=True)
class DocumentProvenanceDTO(BaseProvenanceDTO):
    document: str
    url: str
    refreshUrl: str
    expiresInSeconds: int


@dataclass(frozen=True)
class PdfProvenanceDTO(DocumentProvenanceDTO):
    sourceType: Literal["pdf"]
    page: int


@dataclass(frozen=True)
class CsvProvenanceDTO(DocumentProvenanceDTO):
    sourceType: Literal["csv"]
    row: int | str
    column: str


@dataclass(frozen=True)
class ExcelCellProvenanceDTO(DocumentProvenanceDTO):
    sourceType: Literal["excel"]
    sheet: str
    cell: str


@dataclass(frozen=True)
class ExcelRangeProvenanceDTO(DocumentProvenanceDTO):
    sourceType: Literal["excel"]
    sheet: str
    range: str


@dataclass(frozen=True)
class CompositeProvenanceDTO(BaseProvenanceDTO):
    sourceType: Literal["composite"]
    sources: list[ProvenanceDTO] = field(default_factory=list)


ProvenanceDTO: TypeAlias = PdfProvenanceDTO | CsvProvenanceDTO | ExcelCellProvenanceDTO | ExcelRangeProvenanceDTO | CompositeProvenanceDTO


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
    tenantFields: list[AssetFieldDTO] = field(default_factory=list)


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

export type BaseProvenanceSource = {
  quote: string;
  sourceType: "pdf" | "csv" | "excel" | "composite";
};

export type DocumentProvenanceSource = BaseProvenanceSource & {
  document: string;
  url: string;
  refreshUrl: string;
  expiresInSeconds: number;
};

export type PdfProvenanceSource = DocumentProvenanceSource & {
  sourceType: "pdf";
  page: number;
};

export type CsvProvenanceSource = DocumentProvenanceSource & {
  sourceType: "csv";
  row: number | string;
  column: string;
};

export type ExcelCellProvenanceSource = DocumentProvenanceSource & {
  sourceType: "excel";
  sheet: string;
  cell: string;
};

export type ExcelRangeProvenanceSource = DocumentProvenanceSource & {
  sourceType: "excel";
  sheet: string;
  range: string;
};

export type CompositeProvenanceSource = BaseProvenanceSource & {
  sourceType: "composite";
  sources: ProvenanceSource[];
};

export type ProvenanceSource = PdfProvenanceSource | CsvProvenanceSource | ExcelCellProvenanceSource | ExcelRangeProvenanceSource | CompositeProvenanceSource;

export type ProvenanceMap = Record<string, ProvenanceSource[] | ProvenanceSource | undefined>;

export type AssetSummary = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  assetType?: string | null;
  propertyType?: string | null;
  asset_type?: string | null;
  property_type?: string | null;
  address?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type FieldDatum = {
  fieldPath: string;
  label: string;
  value: string | null;
  provenance: ProvenanceSource[];
};

export type TenantSummary = {
  id: string;
  name: string;
  industry?: string | null;
};

export type AssetLease = {
  id: string;
  tenant: TenantSummary;
  fields: FieldDatum[];
  tenantFields?: FieldDatum[];
  tenant_id?: string | null;
  tenant_name?: string | null;
  lease_type?: string | null;
  lease_provenance?: ProvenanceMap;
  [key: string]: unknown;
};

export type AssetDetail = AssetSummary & {
  fields?: FieldDatum[];
  leases?: AssetLease[];
  asset_provenance?: ProvenanceMap;
  logistics_provenance?: ProvenanceMap;
  [key: string]: unknown;
};

export type Lease = AssetLease;

export type EvidenceEntityType = "asset" | "lease" | "tenant";

export type SourceViewerTarget = {
  entityType: EvidenceEntityType;
  fieldPath: string;
  label: string;
  value: string;
  source: ProvenanceSource;
  sources: ProvenanceSource[];
};

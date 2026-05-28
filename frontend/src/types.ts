export type UploadedAsset = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  bucket: string;
  object_key: string;
  status: "uploaded";
  created_at: string;
};

export type ProvenanceSource = {
  page?: number;
  sourcePage?: number;
  quote?: string;
  document?: string;
  filename?: string;
  pdfUrl?: string;
  pdf_url?: string;
  url?: string;
  source_type?: string;
  sourceType?: string;
  sheet?: string | null;
};

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

export type UploadStatus = "queued" | "uploading" | "uploaded" | "error";

export type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
  asset?: UploadedAsset;
};

export type EvidenceEntityType = "asset" | "lease";

export type EvidenceTarget = {
  entityType: EvidenceEntityType;
  fieldPath: string;
  label: string;
  value: string;
  pdfUrl: string;
  filename: string;
  quote: string;
  sourcePage?: number;
};

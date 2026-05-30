import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ChevronDown, ChevronLeft, Loader2 } from "lucide-react";

import { getAsset } from "../api";
import { FieldValue } from "../components/FieldValue";
import { PdfEvidencePanel } from "../components/evidence";
import type { AssetDetail, AssetLease, EvidenceTarget, FieldDatum, ProvenanceMap } from "../types";

const hiddenAssetKeys = new Set(["id", "fields", "leases", "asset_provenance", "logistics_provenance", "created_at", "updated_at"]);
const hiddenLeaseKeys = new Set(["fields", "tenant", "lease_provenance", "created_at", "updated_at"]);

export function AssetDetailPage() {
  const { assetId } = useParams();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);

  useEffect(() => {
    if (!assetId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getAsset(assetId)
      .then((result) => {
        if (!cancelled) setAsset(result);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load asset");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canopy-cream px-4 py-8 text-sm text-canopy-fern">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading asset
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="rounded-lg border border-line bg-canopy-cream p-4">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error ?? "Asset not found"}
        </div>
        <BackLink />
      </div>
    );
  }

  const assetProvenance = mergeProvenance(asset.asset_provenance, asset.logistics_provenance);
  const assetFields = asset.fields?.length ? asset.fields : fieldsFromRecord(asset, "asset", hiddenAssetKeys, assetProvenance);

  return (
    <>
      <div className="space-y-4">
        <BackLink />

        <section className="rounded-lg border border-line bg-canopy-cream p-4 shadow-panel">
          <div className="text-xs font-semibold uppercase tracking-normal text-moss">Asset</div>
          <h2 className="mt-1 text-2xl font-semibold">{asset.name}</h2>
          <p className="mt-1 text-sm text-canopy-fern">{[asset.address, asset.city, asset.country].filter(Boolean).join(", ")}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-canopy-fern">
            {asset.assetType || asset.asset_type ? <span className="rounded-md border border-line bg-white px-2 py-1">{asset.assetType ?? asset.asset_type}</span> : null}
            {asset.propertyType || asset.property_type ? (
              <span className="rounded-md border border-line bg-white px-2 py-1">{asset.propertyType ?? asset.property_type}</span>
            ) : null}
            {isDisplayablePrimitive(asset.currency) ? <span className="rounded-md border border-line bg-white px-2 py-1">{String(asset.currency)}</span> : null}
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-semibold">Asset Fields</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assetFields.map((field) => (
              <FieldValue
                key={field.fieldPath}
                entityType="asset"
                fieldPath={field.fieldPath}
                label={field.label}
                value={field.value}
                provenance={field.provenance.length ? field.provenance : assetProvenance}
                onOpenEvidence={setEvidence}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-semibold">Leases</h3>
          {asset.leases?.length ? (
            <div className="space-y-3">
              {asset.leases.map((lease, index) => (
                <LeasePanel key={lease.id} lease={lease} index={index} onOpenEvidence={setEvidence} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-canopy-cream px-4 py-8 text-sm text-canopy-fern">No leases returned for this asset.</div>
          )}
        </section>
      </div>

      <PdfEvidencePanel evidence={evidence} isOpen={Boolean(evidence)} onClose={() => setEvidence(null)} />
    </>
  );
}

function BackLink() {
  return (
    <Link to="/assets" className="inline-flex items-center gap-2 text-sm font-medium text-moss hover:text-canopy-ink">
      <ChevronLeft className="h-4 w-4" />
      Assets
    </Link>
  );
}

function LeasePanel({ lease, index, onOpenEvidence }: { lease: AssetLease; index: number; onOpenEvidence: (evidence: EvidenceTarget) => void }) {
  const title = lease.tenant?.name ?? lease.tenant_name ?? lease.lessee_name_verbatim ?? lease.id;
  const leaseFields = lease.fields?.length ? lease.fields : fieldsFromRecord(lease, "lease", hiddenLeaseKeys, lease.lease_provenance);

  return (
    <details className="rounded-lg border border-line bg-canopy-cream shadow-panel" open={index === 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-moss">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{String(title)}</div>
          <div className="text-xs text-canopy-fern">
            Lease {lease.id}
            {lease.tenant?.industry ? ` - ${lease.tenant.industry}` : ""}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-canopy-fern" />
      </summary>
      <div className="grid gap-3 border-t border-line p-4 md:grid-cols-2 xl:grid-cols-3">
        {leaseFields.map((field) => (
          <FieldValue
            key={field.fieldPath}
            entityType="lease"
            fieldPath={field.fieldPath}
            label={field.label}
            value={field.value}
            provenance={field.provenance.length ? field.provenance : lease.lease_provenance}
            onOpenEvidence={onOpenEvidence}
          />
        ))}
      </div>
    </details>
  );
}

function fieldsFromRecord(record: Record<string, unknown>, entityPrefix: "asset" | "lease", hiddenKeys: Set<string>, provenance?: ProvenanceMap): FieldDatum[] {
  return Object.entries(record)
    .filter((entry): entry is [string, string | number | boolean | null] => !hiddenKeys.has(entry[0]) && isDisplayablePrimitive(entry[1]))
    .map(([key, value]) => ({
      fieldPath: `${entityPrefix}.${key}`,
      label: labelize(key),
      value: value === null || value === undefined ? null : String(value),
      provenance: provenance?.[key] ? normalizeProvenance(provenance[key]) : [],
    }));
}

function normalizeProvenance(entry: ProvenanceMap[string]): FieldDatum["provenance"] {
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

function isDisplayablePrimitive(value: unknown): value is string | number | boolean | null {
  if (value === undefined || typeof value === "function") return false;
  if (Array.isArray(value)) return false;
  return !(value && typeof value === "object");
}

function mergeProvenance(...maps: (ProvenanceMap | undefined)[]): ProvenanceMap {
  return maps.reduce<ProvenanceMap>((merged, map) => (map ? { ...merged, ...map } : merged), {});
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bSf\b/g, "SF")
    .replace(/\bSm\b/g, "SM");
}

import { Link2 } from "lucide-react";

import type { EvidenceEntityType, EvidenceTarget, ProvenanceMap, ProvenanceSource } from "../types";

type FieldValueProps = {
  entityType: EvidenceEntityType;
  fieldPath: string;
  label: string;
  value: unknown;
  provenance?: ProvenanceMap | ProvenanceSource[];
  onOpenEvidence: (evidence: EvidenceTarget) => void;
};

export function FieldValue({ entityType, fieldPath, label, value, provenance, onOpenEvidence }: FieldValueProps) {
  const displayValue = formatValue(value);
  const evidence = buildEvidenceTarget({ entityType, fieldPath, label, value: displayValue, provenance });

  return (
    <div className="rounded-md border border-line bg-canopy-cream p-3 shadow-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-normal text-canopy-fern">{label}</div>
        {evidence ? (
          <button
            aria-label={`Open PDF evidence for ${label}`}
            type="button"
            className="rounded-md p-1 text-canopy-fern hover:bg-canopy-mint hover:text-moss focus:outline-none focus:ring-2 focus:ring-moss"
            onClick={() => onOpenEvidence(evidence)}
            title="Source evidence"
          >
            <Link2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className={`break-words text-sm ${displayValue === "Not provided" ? "text-canopy-fern" : "text-ink"}`}>{displayValue}</div>
    </div>
  );
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  return JSON.stringify(value);
}

function buildEvidenceTarget({
  entityType,
  fieldPath,
  label,
  value,
  provenance,
}: {
  entityType: EvidenceEntityType;
  fieldPath: string;
  label: string;
  value: string;
  provenance?: ProvenanceMap | ProvenanceSource[];
}): EvidenceTarget | null {
  const source = findPdfQuote(provenance, fieldPath);
  if (!source?.quote) return null;

  const filename = source.filename ?? source.document ?? "Source PDF";
  const url = source.url;
  if (!url) return null;

  return {
    entityType,
    fieldPath,
    label,
    value,
    url,
    refreshUrl: source.refreshUrl,
    filename,
    quote: source.quote,
    sourcePage: source.sourcePage ?? source.page,
  };
}

function findPdfQuote(provenance: ProvenanceMap | ProvenanceSource[] | undefined, fieldPath: string): ProvenanceSource | null {
  if (!provenance) return null;
  const pathParts = fieldPath.split(".");
  const fieldKey = pathParts[pathParts.length - 1] ?? fieldPath;
  const sourceLists = Array.isArray(provenance)
    ? [provenance]
    : [provenance[fieldPath], provenance[fieldKey]].map((entries) => (Array.isArray(entries) ? entries : entries ? [entries] : []));

  for (const entries of sourceLists) {
    const match = entries.find((entry) => {
      const sourceType = entry.source_type ?? entry.sourceType;
      return Boolean(entry.quote) && (!sourceType || sourceType.toLowerCase() === "pdf");
    });
    if (match) return match;
  }

  return null;
}

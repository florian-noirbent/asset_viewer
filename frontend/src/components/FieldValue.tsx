import { FileSearch } from "lucide-react";

import type { EvidenceEntityType, ProvenanceMap, ProvenanceSource, SourceViewerTarget } from "../types";

type FieldValueProps = {
  entityType: EvidenceEntityType;
  fieldPath: string;
  label: string;
  value: unknown;
  provenance?: ProvenanceMap | ProvenanceSource[];
  onOpenEvidence: (evidence: SourceViewerTarget) => void;
};

export function FieldValue({ entityType, fieldPath, label, value, provenance, onOpenEvidence }: FieldValueProps) {
  const displayValue = formatValue(value);
  const evidence = buildSourceViewerTarget({ entityType, fieldPath, label, value: displayValue, provenance });

  return (
    <div className="group rounded-md border border-line bg-canopy-cream p-3 shadow-panel transition duration-150 hover:-translate-y-0.5 hover:border-canopy-fern/50 hover:bg-white hover:shadow-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-normal text-canopy-fern">{label}</div>
        {evidence ? (
          <button
            aria-label={`Open source evidence for ${label}`}
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-canopy-fern transition hover:border-line hover:bg-canopy-mint hover:text-moss focus:outline-none focus:ring-2 focus:ring-moss"
            onClick={() => onOpenEvidence(evidence)}
            title={`${evidence.sources.length} source${evidence.sources.length === 1 ? "" : "s"}`}
          >
            <FileSearch className="h-4 w-4" />
            <span className="min-w-4 rounded bg-white px-1 text-center text-[10px] font-semibold tabular-nums text-moss group-hover:bg-canopy-cream">
              {evidence.sources.length}
            </span>
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

function buildSourceViewerTarget({
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
}): SourceViewerTarget | null {
  const sources = findSources(provenance, fieldPath);
  const source = chooseInitialSource(sources);
  if (!source) return null;

  return {
    entityType,
    fieldPath,
    label,
    value,
    source,
    sources,
  };
}

function findSources(provenance: ProvenanceMap | ProvenanceSource[] | undefined, fieldPath: string): ProvenanceSource[] {
  if (!provenance) return [];
  const pathParts = fieldPath.split(".");
  const fieldKey = pathParts[pathParts.length - 1] ?? fieldPath;
  const entries = Array.isArray(provenance) ? provenance : normalizeSourceEntries(provenance[fieldPath] ?? provenance[fieldKey]);

  return entries.filter(hasUsableSource);
}

function normalizeSourceEntries(entries: ProvenanceSource[] | ProvenanceSource | undefined): ProvenanceSource[] {
  if (!entries) return [];
  return Array.isArray(entries) ? entries : [entries];
}

function chooseInitialSource(sources: ProvenanceSource[]): ProvenanceSource | null {
  return sources.find((source) => "sources" in source) ?? sources[0] ?? null;
}

function hasUsableSource(source: ProvenanceSource): boolean {
  if ("sources" in source) {
    return source.sources.length > 0;
  }

  return "url" in source && Boolean(source.url && source.document && source.quote);
}

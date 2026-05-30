import { useMemo } from "react";
import { Calculator } from "lucide-react";

import type { CompositeProvenanceSource, ProvenanceSource } from "../../../../types";
import { SourceCard } from "../SourceCard";
import { getSourceRenderer } from "../registry";
import { sourceKey } from "../sourceIdentity";
import type { OpenSourceHandler } from "../types";

export function CompositeSourceView({ source, onOpenSource }: { source: CompositeProvenanceSource; onOpenSource: OpenSourceHandler }) {
  const groupedSources = useMemo(() => groupSources(source.sources), [source.sources]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 rounded-md border border-line bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-moss">
          <Calculator className="h-4 w-4" />
          Calculation source
        </div>
        <blockquote className="border-l-2 border-moss pl-3 text-sm text-canopy-ink">{source.quote}</blockquote>
      </div>

      <div className="space-y-4">
        {groupedSources.map(([group, sources]) => (
          <section key={group}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-canopy-fern">{group}</h3>
            <div className="grid gap-2">
              {sources.map((nestedSource) => (
                <SourceCard key={sourceKey(nestedSource)} source={nestedSource} onOpenSource={onOpenSource} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupSources(sources: ProvenanceSource[]): [string, ProvenanceSource[]][] {
  const groups = new Map<string, ProvenanceSource[]>();

  for (const source of sources) {
    const group = getSourceRenderer(source).getGroupLabel(source);
    groups.set(group, [...(groups.get(group) ?? []), source]);
  }

  return Array.from(groups.entries());
}

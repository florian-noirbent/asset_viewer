import { ArrowRight } from "lucide-react";

import type { ProvenanceSource } from "../../../types";
import { getSourceRenderer } from "./registry";
import type { OpenSourceHandler } from "./types";

export function SourceCard({ source, onOpenSource }: { source: ProvenanceSource; onOpenSource: OpenSourceHandler }) {
  const renderer = getSourceRenderer(source);
  const Icon = renderer.Icon;

  return (
    <button
      className="group flex w-full items-start gap-3 rounded-md border border-line bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-canopy-fern/50 hover:bg-canopy-mint/60 hover:shadow-panel focus:outline-none focus:ring-2 focus:ring-moss"
      onClick={() => onOpenSource(source)}
      type="button"
    >
      <Icon className="h-4 w-4 shrink-0 text-moss" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-canopy-ink">{renderer.getTitle(source)}</span>
        <span className="mt-1 line-clamp-2 text-xs text-canopy-fern">{source.quote}</span>
      </span>
      <ArrowRight className="mt-0.5 h-4 w-4 text-canopy-fern opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}

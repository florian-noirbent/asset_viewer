import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, PanelRightClose } from "lucide-react";

import type { ProvenanceSource, SourceViewerTarget } from "../../types";
import { getSourceRenderer } from "./sourceViewer/registry";
import { sourceKey, withTopLevelSiblingSources } from "./sourceViewer/sourceIdentity";

export type SourceViewerPanelProps = {
  isOpen: boolean;
  target: SourceViewerTarget | null;
  onClose: () => void;
};

export function SourceViewerPanel({ isOpen, target, onClose }: SourceViewerPanelProps) {
  const [history, setHistory] = useState<ProvenanceSource[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    if (!target) {
      setHistory([]);
      setHistoryIndex(0);
      return;
    }

    setHistory([withTopLevelSiblingSources(target)]);
    setHistoryIndex(0);
  }, [target]);

  const currentSource = history[historyIndex];
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  function pushSource(source: ProvenanceSource) {
    setHistory((currentHistory) => [...currentHistory.slice(0, historyIndex + 1), source]);
    setHistoryIndex((currentIndex) => currentIndex + 1);
  }

  if (!isOpen || !target || !currentSource) {
    return null;
  }

  const renderer = getSourceRenderer(currentSource);

  return (
    <aside aria-label="Source evidence" className="flex h-full min-h-[520px] flex-col overflow-hidden border border-line bg-canopy-cream shadow-panel">
      <header className="border-b border-line bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-normal text-moss">{target.entityType} source</div>
            <h2 className="mt-1 truncate text-lg font-semibold">{target.label}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-canopy-fern">{target.value}</p>
          </div>
          <button
            aria-label="Close source viewer"
            className="rounded-md p-2 text-canopy-fern transition hover:bg-canopy-mint hover:text-moss focus:outline-none focus:ring-2 focus:ring-moss"
            onClick={onClose}
            type="button"
          >
            <PanelRightClose className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            aria-label="Back to previous source"
            className="rounded-md border border-line bg-canopy-cream p-1.5 text-canopy-fern transition hover:bg-canopy-mint hover:text-moss disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canGoBack}
            onClick={() => setHistoryIndex((index) => Math.max(0, index - 1))}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Forward to next source"
            className="rounded-md border border-line bg-canopy-cream p-1.5 text-canopy-fern transition hover:bg-canopy-mint hover:text-moss disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canGoForward}
            onClick={() => setHistoryIndex((index) => Math.min(history.length - 1, index + 1))}
            type="button"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <Breadcrumb history={history} historyIndex={historyIndex} />
        </div>
      </header>

      <SourceContext source={currentSource} />

      <div className="min-h-0 flex-1 overflow-hidden bg-canopy-mist" data-testid="source-viewer-body">
        {renderer.render({ source: currentSource, onOpenSource: pushSource })}
      </div>
    </aside>
  );
}

function SourceContext({ source }: { source: ProvenanceSource }) {
  const renderer = getSourceRenderer(source);
  const Icon = renderer.Icon;

  return (
    <section className="border-b border-line bg-canopy-cream px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 shrink-0 text-moss" />
        {renderer.getTitle(source)}
      </div>
      <blockquote className="max-h-24 overflow-y-auto border-l-2 border-moss pl-3 text-sm text-canopy-ink">{source.quote}</blockquote>
    </section>
  );
}

function Breadcrumb({ history, historyIndex }: { history: ProvenanceSource[]; historyIndex: number }) {
  return (
    <div className="min-w-0 flex-1 truncate text-xs text-canopy-fern">
      {history.slice(0, historyIndex + 1).map((source, index) => {
        const renderer = getSourceRenderer(source);
        return (
          <span key={`${sourceKey(source)}-${index}`}>
            {index > 0 ? <span className="px-1 text-canopy-fern/60">/</span> : null}
            <span className={index === historyIndex ? "font-semibold text-moss" : ""}>{renderer.getShortTitle(source)}</span>
          </span>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from "react";
import * as pdfViewerCoreModule from "@react-pdf-viewer/core";
import type { DocumentLoadEvent } from "@react-pdf-viewer/core";
import * as pdfViewerToolbarModule from "@react-pdf-viewer/toolbar";
import { AlertCircle, CheckCircle2, FileSearch, Loader2, PanelRightClose } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";

import { loadCachedPdfObjectUrl } from "../../lib/pdf";
import type { EvidenceTarget } from "../../types";

type DefaultWrappedModule<T> = T & { default?: T };

const pdfViewerCore = (pdfViewerCoreModule as DefaultWrappedModule<typeof pdfViewerCoreModule>).default ?? pdfViewerCoreModule;
const pdfViewerToolbar = (pdfViewerToolbarModule as DefaultWrappedModule<typeof pdfViewerToolbarModule>).default ?? pdfViewerToolbarModule;
const { Viewer, Worker } = pdfViewerCore;
const { toolbarPlugin } = pdfViewerToolbar;

type EvidenceStatus = "idle" | "loading" | "highlighted" | "page-not-found" | "document-not-found" | "error";

type StatusState = {
  status: EvidenceStatus;
  message?: string;
};

export type PdfEvidencePanelProps = {
  isOpen: boolean;
  evidence: EvidenceTarget | null;
  onClose: () => void;
};

export function PdfEvidencePanel({ isOpen, evidence, onClose }: PdfEvidencePanelProps) {
  if (!isOpen || !evidence) {
    return null;
  }

  return <OpenPdfEvidencePanel evidence={evidence} onClose={onClose} />;
}

function OpenPdfEvidencePanel({ evidence, onClose }: { evidence: EvidenceTarget; onClose: () => void }) {
  const toolbarPluginInstance = toolbarPlugin({ searchPlugin: { enableShortcuts: true } });
  const { Toolbar, searchPluginInstance, pageNavigationPluginInstance } = toolbarPluginInstance;
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    const currentEvidence = evidence;

    async function loadPdf() {
      setStatus({ status: "loading" });
      setViewerUrl(null);

      try {
        const objectUrl = await loadCachedPdfObjectUrl(currentEvidence.url, currentEvidence.refreshUrl);

        if (!cancelled) {
          setViewerUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            status: "error",
            message: error instanceof Error ? error.message : "Unable to load PDF",
          });
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
    };
  }, [evidence]);

  async function handleDocumentLoad(event: DocumentLoadEvent) {
    const quote = evidence.quote.trim();
    const sourcePageIndex = getSourcePageIndex(evidence.sourcePage, event.doc.numPages);

    if (sourcePageIndex !== null) {
      pageNavigationPluginInstance.jumpToPage(sourcePageIndex);
    }

    if (!quote) {
      setStatus({
        status: sourcePageIndex === null ? "document-not-found" : "page-not-found",
        message: sourcePageIndex === null ? "Quote not found in document" : "Opened source page, quote not found",
      });
      return;
    }

    try {
      searchPluginInstance.clearHighlights();

      if (sourcePageIndex !== null) {
        searchPluginInstance.setTargetPages(({ pageIndex }) => pageIndex === sourcePageIndex);
        const pageMatches = await searchPluginInstance.highlight(quote);

        if (pageMatches.length > 0) {
          searchPluginInstance.jumpToMatch(1);
          setStatus({ status: "highlighted", message: "Quote highlighted" });
          return;
        }
      }

      searchPluginInstance.setTargetPages(() => true);
      const documentMatches = await searchPluginInstance.highlight(quote);

      if (documentMatches.length > 0) {
        searchPluginInstance.jumpToMatch(1);
        setStatus({ status: "highlighted", message: "Quote highlighted" });
        return;
      }

      setStatus({
        status: sourcePageIndex === null ? "document-not-found" : "page-not-found",
        message: sourcePageIndex === null ? "Quote not found in document" : "Opened source page, quote not found",
      });
    } catch (error) {
      setStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to search PDF",
      });
    }
  }

  return (
    <aside
      aria-label="PDF source evidence"
      aria-modal="true"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[min(96vw,1100px)] flex-col border-l border-line bg-canopy-cream shadow-xl lg:w-[88vw]"
      role="dialog"
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-normal text-moss">{evidence.entityType} source</div>
          <h2 className="mt-1 truncate text-lg font-semibold">{evidence.label}</h2>
          <p className="mt-1 break-words text-sm text-canopy-fern">{evidence.value}</p>
        </div>
        <button aria-label="Close evidence panel" className="rounded-md p-2 text-canopy-fern hover:bg-canopy-mint hover:text-moss" onClick={onClose} type="button">
          <PanelRightClose className="h-5 w-5" />
        </button>
      </header>

      <div className="grid gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="min-w-0 rounded-lg border border-line bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <FileSearch className="h-4 w-4 text-moss" />
            {evidence.filename}
          </div>
          <div className="break-all text-xs text-canopy-fern">{evidence.url}</div>
        </section>

        <section className="min-w-0 rounded-lg border border-line bg-white p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-canopy-fern">Quoted evidence</div>
          <blockquote className="max-h-20 overflow-y-auto border-l-2 border-moss pl-3 text-sm text-canopy-ink">{evidence.quote}</blockquote>
        </section>
      </div>

      <StatusMessage status={status} sourcePage={evidence.sourcePage} />

      <div className="flex min-h-0 flex-1 flex-col bg-canopy-mist">
        <div className="border-b border-line bg-canopy-cream px-2 py-1">
          <Toolbar />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden" data-testid="pdf-viewer-shell">
          {viewerUrl ? (
            <Worker workerUrl={pdfWorkerUrl}>
              <Viewer
                fileUrl={viewerUrl}
                onDocumentLoad={(event) => {
                  void handleDocumentLoad(event);
                }}
                plugins={[toolbarPluginInstance]}
              />
            </Worker>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-canopy-fern">{status.status === "error" ? "Unable to load PDF" : "Loading PDF viewer"}</div>
          )}
        </div>
      </div>
    </aside>
  );
}

function StatusMessage({ status, sourcePage }: { status: StatusState; sourcePage?: number }) {
  if (status.status === "idle") {
    return null;
  }

  if (status.status === "loading") {
    return (
      <div className="flex items-center gap-2 border-b border-line bg-canopy-mint px-5 py-2 text-sm text-moss">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading PDF
      </div>
    );
  }

  if (status.status === "highlighted") {
    return (
      <div className="flex items-center gap-2 border-b border-line bg-canopy-mint px-5 py-2 text-sm text-moss">
        <CheckCircle2 className="h-4 w-4" />
        {status.message}
        {sourcePage ? ` on source page ${sourcePage}` : ""}
      </div>
    );
  }

  if (status.status === "page-not-found" || status.status === "document-not-found") {
    return (
      <div className="flex items-center gap-2 border-b border-line bg-[#fff5df] px-5 py-2 text-sm text-[#8b5b20]">
        <AlertCircle className="h-4 w-4" />
        {status.message}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-line bg-red-50 px-5 py-2 text-sm text-red-700">
      <AlertCircle className="h-4 w-4" />
      {status.message}
    </div>
  );
}

function getSourcePageIndex(sourcePage: number | undefined, numPages: number): number | null {
  if (!sourcePage || sourcePage < 1 || sourcePage > numPages) {
    return null;
  }

  return sourcePage - 1;
}

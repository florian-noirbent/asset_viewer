import { useEffect, useState } from "react";
import * as pdfViewerCoreModule from "@react-pdf-viewer/core";
import type { DocumentLoadEvent } from "@react-pdf-viewer/core";
import * as pdfViewerToolbarModule from "@react-pdf-viewer/toolbar";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";

import type { PdfProvenanceSource } from "../../../../types";
import { loadCachedObjectUrl } from "../../../../lib/documentCache";
import { SourceErrorState, SourceLoadingState, SourceStatusMessage } from "../primitives";

type DefaultWrappedModule<T> = T & { default?: T };
type PdfSourceStatus = "idle" | "loading" | "highlighted" | "page-not-found" | "document-not-found" | "error";

type StatusState = {
  status: PdfSourceStatus;
  message?: string;
};

const pdfViewerCore = (pdfViewerCoreModule as DefaultWrappedModule<typeof pdfViewerCoreModule>).default ?? pdfViewerCoreModule;
const pdfViewerToolbar = (pdfViewerToolbarModule as DefaultWrappedModule<typeof pdfViewerToolbarModule>).default ?? pdfViewerToolbarModule;
const { Viewer, Worker } = pdfViewerCore;
const { toolbarPlugin } = pdfViewerToolbar;

export function PdfSourceView({ source }: { source: PdfProvenanceSource }) {
  const toolbarPluginInstance = toolbarPlugin({ searchPlugin: { enableShortcuts: true } });
  const { Toolbar, searchPluginInstance, pageNavigationPluginInstance } = toolbarPluginInstance;
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function loadSource() {
      setStatus({ status: "loading" });
      setViewerUrl(null);

      try {
        const objectUrl = await loadCachedObjectUrl(source.url, source.refreshUrl);
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

    void loadSource();

    return () => {
      cancelled = true;
    };
  }, [source]);

  async function handleDocumentLoad(event: DocumentLoadEvent) {
    const quote = source.quote.trim();
    const sourcePageIndex = getSourcePageIndex(source.page, event.doc.numPages);

    if (sourcePageIndex !== null) {
      pageNavigationPluginInstance.jumpToPage(sourcePageIndex);
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
    <div className="flex h-full min-h-0 flex-col">
      <PdfStatusMessage status={status} sourcePage={source.page} />
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
          <SourceLoadingState label={status.status === "error" ? "Unable to load PDF" : "Loading PDF viewer"} />
        )}
      </div>
    </div>
  );
}

function PdfStatusMessage({ status, sourcePage }: { status: StatusState; sourcePage?: number }) {
  if (status.status === "idle") {
    return null;
  }

  if (status.status === "loading") {
    return <SourceStatusMessage tone="loading" message="Loading PDF" />;
  }

  if (status.status === "highlighted") {
    return <SourceStatusMessage tone="success" icon={<CheckCircle2 className="h-4 w-4" />} message={`${status.message}${sourcePage ? ` on source page ${sourcePage}` : ""}`} />;
  }

  if (status.status === "page-not-found" || status.status === "document-not-found") {
    return <SourceStatusMessage tone="warning" icon={<AlertCircle className="h-4 w-4" />} message={status.message ?? "Source quote was not found"} />;
  }

  return <SourceErrorState message={status.message ?? "Unable to load source"} compact />;
}

function getSourcePageIndex(sourcePage: number | undefined, numPages: number): number | null {
  if (!sourcePage || sourcePage < 1 || sourcePage > numPages) {
    return null;
  }

  return sourcePage - 1;
}

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompositeProvenanceSource, CsvProvenanceSource, ExcelCellProvenanceSource, PdfProvenanceSource } from "../../../../types";
import { loadCachedArrayBuffer, loadCachedObjectUrl, loadCachedText } from "../../../../lib/documentCache";
import { parseXlsxWorkbook } from "../../../../lib/xlsx";
import { compositeSourceRenderer } from "./compositeSourceRenderer";
import { csvSourceRenderer } from "./csvSourceRenderer";
import { excelSourceRenderer } from "./excelSourceRenderer";
import { pdfSourceRenderer } from "./pdfSourceRenderer";

const pdfViewerMocks = vi.hoisted(() => ({
  clearHighlights: vi.fn(),
  highlight: vi.fn(),
  jumpToMatch: vi.fn(),
  jumpToPage: vi.fn(),
  setTargetPages: vi.fn(),
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.js?url", () => ({ default: "pdf-worker.js" }));

vi.mock("@react-pdf-viewer/core", async () => {
  const React = await import("react");
  const module = {
    Worker: ({ children }: { children: React.ReactNode }) => React.createElement("div", { "data-testid": "pdf-worker" }, children),
    Viewer: ({ fileUrl, onDocumentLoad }: { fileUrl: string; onDocumentLoad: (event: { doc: { numPages: number } }) => void }) => {
      const didLoad = React.useRef(false);

      React.useEffect(() => {
        if (didLoad.current) return;
        didLoad.current = true;
        onDocumentLoad({ doc: { numPages: 5 } });
      });

      return React.createElement("div", { "data-file-url": fileUrl, "data-testid": "pdf-viewer" }, "PDF viewer");
    },
  };

  return {
    ...module,
    default: module,
  };
});

vi.mock("@react-pdf-viewer/toolbar", async () => {
  const React = await import("react");
  const module = {
    toolbarPlugin: () => ({
      Toolbar: () => React.createElement("div", { "data-testid": "pdf-toolbar" }, "Toolbar"),
      searchPluginInstance: {
        clearHighlights: pdfViewerMocks.clearHighlights,
        highlight: pdfViewerMocks.highlight,
        jumpToMatch: pdfViewerMocks.jumpToMatch,
        setTargetPages: pdfViewerMocks.setTargetPages,
      },
      pageNavigationPluginInstance: {
        jumpToPage: pdfViewerMocks.jumpToPage,
      },
    }),
  };

  return {
    ...module,
    default: module,
  };
});

vi.mock("../../../../lib/documentCache", () => ({
  loadCachedArrayBuffer: vi.fn(),
  loadCachedObjectUrl: vi.fn(),
  loadCachedText: vi.fn(),
}));

vi.mock("../../../../lib/xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/xlsx")>();

  return {
    ...actual,
    parseXlsxWorkbook: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("concrete source renderers", () => {
  it("renders composite sources and opens nested source cards", async () => {
    const user = userEvent.setup();
    const onOpenSource = vi.fn();
    const nestedSource = makePdfSource("Investment summary");
    const source: CompositeProvenanceSource = {
      sourceType: "composite",
      quote: "Weighted rent = total rent / total area",
      sources: [nestedSource],
    };

    render(<>{compositeSourceRenderer.render({ source, onOpenSource })}</>);

    expect(screen.getByText("Calculation source")).toBeInTheDocument();
    expect(screen.getByText("Weighted rent = total rent / total area")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /source_viewer_demo\.pdf - page 2 Investment summary/i }));

    expect(onOpenSource).toHaveBeenCalledWith(nestedSource);
  });

  it("loads PDF sources and highlights the quote on the requested page", async () => {
    vi.mocked(loadCachedObjectUrl).mockResolvedValue("blob:source-pdf");
    pdfViewerMocks.highlight.mockResolvedValue([{ pageIndex: 1, keyword: "rent" }]);

    render(<>{pdfSourceRenderer.render({ source: makePdfSource("Annual rent"), onOpenSource: vi.fn() })}</>);

    expect(screen.getByText("Loading PDF")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-file-url", "blob:source-pdf"));
    await waitFor(() => expect(pdfViewerMocks.jumpToPage).toHaveBeenCalledWith(1));
    expect(pdfViewerMocks.highlight).toHaveBeenCalledWith("Annual rent");
    await waitFor(() => expect(screen.getByText("Quote highlighted on source page 2")).toBeInTheDocument());
  });

  it("renders PDF load failures", async () => {
    vi.mocked(loadCachedObjectUrl).mockRejectedValue(new Error("Signed URL expired"));

    render(<>{pdfSourceRenderer.render({ source: makePdfSource("Annual rent"), onOpenSource: vi.fn() })}</>);

    expect(await screen.findByText("Signed URL expired")).toBeInTheDocument();
  });

  it("loads CSV sources and highlights the matching row and column", async () => {
    vi.mocked(loadCachedText).mockResolvedValue("tenant,unit,annual_rent\nCanopy Logistics,A1,96000\nBeta Storage,B2,84000");

    render(<>{csvSourceRenderer.render({ source: makeCsvSource(), onOpenSource: vi.fn() })}</>);

    expect(screen.getByText("Loading CSV")).toBeInTheDocument();

    const highlightedCell = await screen.findByText("96000");
    expect(highlightedCell).toHaveClass("ring-moss");
    expect(screen.getByText("84000")).not.toHaveClass("ring-moss");
  });

  it("loads Excel workbooks and highlights cell/range evidence", async () => {
    vi.mocked(loadCachedArrayBuffer).mockResolvedValue(new ArrayBuffer(8));
    vi.mocked(parseXlsxWorkbook).mockReturnValue({
      sheets: [
        {
          name: "Rent Roll",
          mergedRanges: [],
          rows: [
            {
              index: 1,
              cells: [
                { ref: "A1", row: 1, column: 1, value: "Tenant" },
                { ref: "B1", row: 1, column: 2, value: "Rent" },
              ],
            },
            {
              index: 2,
              cells: [
                { ref: "A2", row: 2, column: 1, value: "Canopy Logistics" },
                { ref: "B2", row: 2, column: 2, value: "96000" },
              ],
            },
          ],
        },
      ],
    });

    render(<>{excelSourceRenderer.render({ source: makeExcelCellSource(), onOpenSource: vi.fn() })}</>);

    expect(screen.getByText("Loading workbook")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Rent Roll" })).toBeInTheDocument();
    expect(screen.getByText("96000")).toHaveClass("ring-moss");
    expect(screen.getByText("Canopy Logistics")).not.toHaveClass("ring-moss");
  });
});

function makePdfSource(quote: string): PdfProvenanceSource {
  return {
    sourceType: "pdf",
    document: "source_viewer_demo.pdf",
    quote,
    page: 2,
    url: "https://minio.test/source_viewer_demo.pdf",
    refreshUrl: "https://api.test/source_viewer_demo.pdf/url",
    expiresInSeconds: 900,
  };
}

function makeCsvSource(): CsvProvenanceSource {
  return {
    sourceType: "csv",
    document: "source_viewer_demo.csv",
    quote: "Annual rent evidence",
    row: 2,
    column: "annual_rent",
    url: "https://minio.test/source_viewer_demo.csv",
    refreshUrl: "https://api.test/source_viewer_demo.csv/url",
    expiresInSeconds: 900,
  };
}

function makeExcelCellSource(): ExcelCellProvenanceSource {
  return {
    sourceType: "excel",
    document: "source_viewer_demo.xlsx",
    quote: "Cell evidence",
    sheet: "Rent Roll",
    cell: "B2",
    url: "https://minio.test/source_viewer_demo.xlsx",
    refreshUrl: "https://api.test/source_viewer_demo.xlsx/url",
    expiresInSeconds: 900,
  };
}

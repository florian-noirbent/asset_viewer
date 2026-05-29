import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PdfEvidencePanel } from "./PdfEvidencePanel";
import { loadCachedPdfObjectUrl } from "../../lib/pdf";
import type { EvidenceTarget } from "../../types";

const jumpToPage = vi.fn();
const clearHighlights = vi.fn();
const setTargetPages = vi.fn();
const highlight = vi.fn();
const jumpToMatch = vi.fn();

vi.mock("@react-pdf-viewer/core", () => ({
  default: {
    Viewer: vi.fn(({ fileUrl, onDocumentLoad }) => {
      return (
        <div data-file-url={fileUrl} data-testid="mock-viewer">
          <button onClick={() => onDocumentLoad({ doc: { numPages: 12 } })} type="button">
            load document
          </button>
        </div>
      );
    }),
    Worker: ({ children, workerUrl }: { children: React.ReactNode; workerUrl: string }) => (
      <div data-testid="mock-worker" data-worker-url={workerUrl}>
        {children}
      </div>
    ),
  },
}));

vi.mock("@react-pdf-viewer/toolbar", () => ({
  default: {
    toolbarPlugin: vi.fn(() => {
      React.useState(null);
      return {
        Toolbar: () => <div data-testid="mock-toolbar">Toolbar</div>,
        pageNavigationPluginInstance: {
          jumpToPage,
        },
        searchPluginInstance: {
          clearHighlights,
          setTargetPages,
          highlight,
          jumpToMatch,
        },
      };
    }),
  },
}));

vi.mock("../../lib/pdf", () => ({
  loadCachedPdfObjectUrl: vi.fn(),
}));

const evidence: EvidenceTarget = {
  entityType: "asset",
  fieldPath: "asset.location",
  label: "Location",
  value: "Paris",
  url: "https://minio.test/source.pdf",
  refreshUrl: "https://api.test/source.pdf/url",
  filename: "source.pdf",
  quote: "The property is located in Paris",
  sourcePage: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadCachedPdfObjectUrl).mockResolvedValue("blob:source-pdf");
  jumpToPage.mockResolvedValue(undefined);
  highlight.mockResolvedValue([{ pageIndex: 3, matchIndex: 0 }]);
  jumpToMatch.mockReturnValue({ pageIndex: 3, matchIndex: 0 });
});

describe("PdfEvidencePanel", () => {
  it("does not render when closed", () => {
    render(<PdfEvidencePanel evidence={evidence} isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders field metadata, quote, toolbar, and viewer shell when open", async () => {
    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "PDF source evidence" })).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("source.pdf")).toBeInTheDocument();
    expect(screen.getByText("The property is located in Paris")).toBeInTheDocument();
    expect(screen.getByTestId("mock-toolbar")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("mock-viewer")).toHaveAttribute("data-file-url", "blob:source-pdf"));
  });

  it("calls onClose when close is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close evidence panel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("loads the PDF through the object URL cache", async () => {
    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={vi.fn()} />);

    await waitFor(() => expect(loadCachedPdfObjectUrl).toHaveBeenCalledWith("https://minio.test/source.pdf", "https://api.test/source.pdf/url"));
    expect(screen.getByTestId("mock-viewer")).toHaveAttribute("data-file-url", "blob:source-pdf");
  });

  it("uses the source page first and highlights the quote", async () => {
    const user = userEvent.setup();

    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "load document" }));

    expect(jumpToPage).toHaveBeenCalledWith(3);
    expect(setTargetPages).toHaveBeenCalledTimes(1);
    expect(highlight).toHaveBeenCalledWith("The property is located in Paris");
    expect(jumpToMatch).toHaveBeenCalledWith(1);
    expect(screen.getByText(/Quote highlighted/)).toBeInTheDocument();
  });

  it("falls back to full-document search when the source page has no match", async () => {
    const user = userEvent.setup();
    highlight.mockResolvedValueOnce([]).mockResolvedValueOnce([{ pageIndex: 7, matchIndex: 0 }]);

    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "load document" }));

    expect(setTargetPages).toHaveBeenCalledTimes(2);
    expect(highlight).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Quote highlighted/)).toBeInTheDocument();
  });

  it("shows page not-found when no match is found after using a source page hint", async () => {
    const user = userEvent.setup();
    highlight.mockResolvedValue([]);

    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "load document" }));

    expect(screen.getByText("Opened source page, quote not found")).toBeInTheDocument();
  });

  it("shows document not-found when there is no source page hint and no match", async () => {
    const user = userEvent.setup();
    highlight.mockResolvedValue([]);

    render(<PdfEvidencePanel evidence={{ ...evidence, sourcePage: undefined }} isOpen onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "load document" }));

    expect(jumpToPage).not.toHaveBeenCalled();
    expect(screen.getByText("Quote not found in document")).toBeInTheDocument();
  });

  it("shows error state when PDF loading fails", async () => {
    vi.mocked(loadCachedPdfObjectUrl).mockRejectedValue(new Error("PDF unavailable"));

    render(<PdfEvidencePanel evidence={evidence} isOpen onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("PDF unavailable")).toBeInTheDocument());
  });
});

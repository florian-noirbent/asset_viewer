import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SourceViewerPanel } from "./SourceViewerPanel";
import { getSourceRenderer } from "./sourceViewer/registry";
import type { ProvenanceSource, SourceViewerTarget } from "../../types";

const mockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;

vi.mock("./sourceViewer/registry", () => ({
  getSourceRenderer: vi.fn((source: ProvenanceSource) => ({
    Icon: mockIcon,
    getTitle: () => `Title: ${source.quote}`,
    getShortTitle: () => `Short: ${source.quote}`,
    getGroupLabel: () => "Group",
    render: ({ source: renderedSource, onOpenSource }: { source: ProvenanceSource; onOpenSource: (source: ProvenanceSource) => void }) => (
      <div data-testid="mock-renderer" data-source-quote={renderedSource.quote}>
        {"sources" in renderedSource
          ? renderedSource.sources.map((nestedSource) => (
              <button key={nestedSource.quote} onClick={() => onOpenSource(nestedSource)} type="button">
                Open {nestedSource.quote}
              </button>
            ))
          : null}
      </div>
    ),
  })),
}));

const leafSource = makeSource("leaf source");
const siblingSource = makeSource("sibling source");
const rootSource = makeSource("root source", [leafSource]);

const target: SourceViewerTarget = {
  entityType: "asset",
  fieldPath: "asset.rent_pu",
  label: "Rent per unit",
  value: "8.60",
  source: rootSource,
  sources: [rootSource],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SourceViewerPanel", () => {
  it("does not render when closed", () => {
    render(<SourceViewerPanel isOpen={false} target={target} onClose={vi.fn()} />);

    expect(screen.queryByRole("complementary", { name: "Source evidence" })).not.toBeInTheDocument();
  });

  it("renders the generic shell and delegates current source rendering to the registry", () => {
    render(<SourceViewerPanel isOpen target={target} onClose={vi.fn()} />);

    expect(screen.getByRole("complementary", { name: "Source evidence" })).toBeInTheDocument();
    expect(screen.getByText("Rent per unit")).toBeInTheDocument();
    expect(screen.getByText("8.60")).toBeInTheDocument();
    expect(screen.getByText("Title: root source")).toBeInTheDocument();
    expect(screen.getByTestId("mock-renderer")).toHaveAttribute("data-source-quote", "root source");
    expect(getSourceRenderer).toHaveBeenCalledWith(expect.objectContaining({ quote: "root source" }));
  });

  it("navigates backward and forward through renderer-opened sources", async () => {
    const user = userEvent.setup();

    render(<SourceViewerPanel isOpen target={target} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Open leaf source" }));

    expect(screen.getByTestId("mock-renderer")).toHaveAttribute("data-source-quote", "leaf source");
    expect(screen.getByText("Short: root source")).toBeInTheDocument();
    expect(screen.getByText("Short: leaf source")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to previous source" }));
    expect(screen.getByTestId("mock-renderer")).toHaveAttribute("data-source-quote", "root source");

    await user.click(screen.getByRole("button", { name: "Forward to next source" }));
    expect(screen.getByTestId("mock-renderer")).toHaveAttribute("data-source-quote", "leaf source");
  });

  it("resets the navigation stack when the selected target changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SourceViewerPanel isOpen target={target} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Open leaf source" }));
    expect(screen.getByTestId("mock-renderer")).toHaveAttribute("data-source-quote", "leaf source");

    rerender(<SourceViewerPanel isOpen target={{ ...target, label: "Gross rent", source: siblingSource, sources: [siblingSource] }} onClose={vi.fn()} />);

    expect(screen.getByText("Gross rent")).toBeInTheDocument();
    expect(screen.getByTestId("mock-renderer")).toHaveAttribute("data-source-quote", "sibling source");
    expect(screen.getByRole("button", { name: "Back to previous source" })).toBeDisabled();
  });

  it("keeps sibling top-level sources visible when the initial root has nested sources", () => {
    render(<SourceViewerPanel isOpen target={{ ...target, sources: [rootSource, siblingSource] }} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Open leaf source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open sibling source" })).toBeInTheDocument();
  });

  it("calls onClose from the generic close control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SourceViewerPanel isOpen target={target} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close source viewer" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function makeSource(quote: string, sources?: ProvenanceSource[]): ProvenanceSource {
  if (sources) {
    return {
      sourceType: "composite",
      quote,
      sources,
    };
  }

  return {
    sourceType: "pdf",
    document: `${quote}.pdf`,
    quote,
    page: 1,
    url: `https://minio.test/${quote}.pdf`,
    refreshUrl: `https://api.test/${quote}.pdf/url`,
    expiresInSeconds: 900,
  };
}

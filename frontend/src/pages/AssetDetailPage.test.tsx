import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetDetailPage } from "./AssetDetailPage";

vi.mock("../components/evidence", () => ({
  PdfEvidencePanel: ({ isOpen, evidence, onClose }: { isOpen: boolean; evidence: { label: string; quote: string } | null; onClose: () => void }) =>
    isOpen && evidence ? (
      <div role="dialog" aria-label="mock pdf evidence">
        <div>{evidence.label}</div>
        <div>{evidence.quote}</div>
        <div data-testid="pdf-viewer-shell" />
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssetDetailPage", () => {
  it("renders asset fields and stacked expandable lease panels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(assetDetailFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Causeway Park" })).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("Warrington")).toBeInTheDocument();
    expect(screen.getByText("Chiu Wah Ltd")).toBeInTheDocument();
    expect(screen.getByText("Datel Computing")).toBeInTheDocument();
    expect(screen.getAllByText("Gross rent")[0]).toBeInTheDocument();
  });

  it("opens the PDF panel from lease provenance", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(assetDetailFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await screen.findByText("Chiu Wah Ltd");
    await user.click(screen.getByRole("button", { name: "Open PDF evidence for Gross rent" }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "mock pdf evidence" })).toBeInTheDocument());
    expect(screen.getByText("Annual rent is GBP 150,000")).toBeInTheDocument();
  });

  it("opens the source panel from asset detail and renders the viewer shell", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(assetDetailFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Open PDF evidence for City" }));

    expect(screen.getByRole("dialog", { name: "mock pdf evidence" })).toBeInTheDocument();
    expect(screen.getByTestId("pdf-viewer-shell")).toBeInTheDocument();
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assets/asset-1"]}>
      <Routes>
        <Route path="/assets/:assetId" element={<AssetDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function assetDetailFixture() {
  return {
    id: "asset-1",
    name: "Causeway Park",
    city: "Warrington",
    country: "United Kingdom",
    assetType: "Logistics",
    fields: [
      {
        fieldPath: "asset.city",
        label: "City",
        value: "Warrington",
        provenance: [
          {
            sourceType: "pdf",
            quote: "Warrington WA4 6RF",
            url: "https://minio.test/source.pdf?signature=asset",
            refreshUrl: "https://api.test/source.pdf/url",
            expiresInSeconds: 900,
            document: "source.pdf",
            page: 2,
          },
        ],
      },
    ],
    leases: [
      {
        id: "lease-1",
        tenant: {
          id: "tenant-1",
          name: "Chiu Wah Ltd",
          industry: "Food Wholesaler",
        },
        fields: [
          {
            fieldPath: "lease.rent_gross",
            label: "Gross rent",
            value: "150000.0",
            provenance: [
              {
                sourceType: "pdf",
                quote: "Annual rent is GBP 150,000",
                url: "https://minio.test/source.pdf?signature=lease",
                refreshUrl: "https://api.test/source.pdf/url",
                expiresInSeconds: 900,
                document: "source.pdf",
                page: 16,
              },
            ],
          },
        ],
      },
      {
        id: "lease-2",
        tenant: {
          id: "tenant-2",
          name: "Datel Computing",
        },
        fields: [
          {
            fieldPath: "lease.rent_gross",
            label: "Gross rent",
            value: "90000.0",
            provenance: [],
          },
        ],
      },
    ],
  };
}

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./components/evidence", () => ({
  PdfEvidencePanel: ({ isOpen, evidence, onClose }: any) =>
    isOpen && evidence ? (
      <aside aria-label="PDF source evidence" role="dialog">
        <div>{evidence.filename}</div>
        <div>{evidence.quote}</div>
        <button onClick={onClose} type="button">
          Close
        </button>
      </aside>
    ) : null,
}));

const assetSummary = {
  id: "d1994ec3-e121-4d5e-adec-014907116986",
  name: "Causeway Park",
  city: "Warrington",
  country: "United Kingdom",
  assetType: "Logistics",
  propertyType: "Multi-let industrial estate",
  currency: "GBP",
};

const assetDetail = {
  ...assetSummary,
  address: "Wilderspool Causeway, Warrington WA4 6RF",
  fields: [
    {
      fieldPath: "asset.name",
      label: "Asset name",
      value: "Causeway Park",
      provenance: [
        {
          sourceType: "pdf",
          document: "source.pdf",
          filename: "source.pdf",
          pdfUrl: "http://localhost:8000/api/resources/source.pdf",
          quote: "Causeway Park source quote",
          page: 2,
        },
      ],
    },
  ],
  leases: [
    {
      id: "24421",
      tenant: {
        id: "3316146",
        name: "Chiu Wah Ltd",
        industry: "Food Wholesaler",
      },
      fields: [
        {
          fieldPath: "lease.rent_gross",
          label: "Gross rent",
          value: "150000",
          provenance: [
            {
              sourceType: "pdf",
              document: "source.pdf",
              filename: "source.pdf",
              pdfUrl: "http://localhost:8000/api/resources/source.pdf",
              quote: "Lease rent source quote",
              page: 12,
            },
          ],
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the asset list route", async () => {
    mockFetch({
      "http://localhost:8000/api/assets": assetListResponse(),
    });

    renderApp("/assets");

    expect(screen.getByText("Asset Library")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Causeway Park")).toBeInTheDocument());
    expect(screen.getByText("Warrington, United Kingdom")).toBeInTheDocument();
  });

  it("keeps upload available on the asset list route", async () => {
    const user = userEvent.setup();
    mockFetch({
      "http://localhost:8000/api/assets": assetListResponse(),
      "http://localhost:8000/api/uploads": uploadResponse(),
    });

    renderApp("/assets");

    const file = new File(["hello"], "asset.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Upload files"), file);
    await user.click(screen.getByRole("button", { name: "Upload queued" }));

    await waitFor(() => expect(screen.getByText("uploaded")).toBeInTheDocument());
  });

  it("renders asset fields and all leases on one page", async () => {
    mockFetch({
      "http://localhost:8000/api/assets/d1994ec3-e121-4d5e-adec-014907116986": assetDetailResponse(),
    });

    renderApp("/assets/d1994ec3-e121-4d5e-adec-014907116986");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Causeway Park" })).toBeInTheDocument());
    expect(screen.getByText("Asset Fields")).toBeInTheDocument();
    expect(screen.getByText("Leases")).toBeInTheDocument();
    expect(screen.getByText("Chiu Wah Ltd")).toBeInTheDocument();
    expect(screen.getByText(/Food Wholesaler/)).toBeInTheDocument();
    expect(screen.getByText("Gross rent")).toBeInTheDocument();
  });

  it("opens PDF evidence for asset and lease fields", async () => {
    const user = userEvent.setup();
    mockFetch({
      "http://localhost:8000/api/assets/d1994ec3-e121-4d5e-adec-014907116986": assetDetailResponse(),
    });

    renderApp("/assets/d1994ec3-e121-4d5e-adec-014907116986");

    await user.click(await screen.findByRole("button", { name: "Open PDF evidence for Asset name" }));
    expect(screen.getByRole("dialog", { name: "PDF source evidence" })).toBeInTheDocument();
    expect(screen.getByText("Causeway Park source quote")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Open PDF evidence for Gross rent" }));
    expect(screen.getByText("Lease rent source quote")).toBeInTheDocument();
  });
});

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

function mockFetch(responses: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
    const response = responses[url];

    if (!response) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function assetListResponse() {
  return [assetSummary];
}

function assetDetailResponse() {
  return assetDetail;
}

function uploadResponse() {
  return {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    filename: "asset.pdf",
    content_type: "application/pdf",
    size_bytes: 5,
    bucket: "assets",
    object_key: "uploads/7c9e6679-7425-40de-944b-e07fc1f90ae7/original/asset.pdf",
    status: "uploaded",
    created_at: "2026-05-28T10:00:00Z",
  };
}

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FieldValue } from "./FieldValue";

describe("FieldValue", () => {
  it("opens PDF evidence when provenance has a PDF quote", async () => {
    const user = userEvent.setup();
    const onOpenEvidence = vi.fn();

    render(
      <FieldValue
        entityType="asset"
        fieldPath="asset.city"
        label="City"
        value="Warrington"
        provenance={{
          city: [
            {
              source_type: "pdf",
              quote: "Located in Warrington",
              url: "https://minio.test/source.pdf",
              refreshUrl: "https://api.test/source.pdf/url",
              document: "source.pdf",
              page: 2,
            },
          ],
        }}
        onOpenEvidence={onOpenEvidence}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open PDF evidence for City" }));

    expect(onOpenEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "asset",
        fieldPath: "asset.city",
        label: "City",
        value: "Warrington",
        url: "https://minio.test/source.pdf",
        refreshUrl: "https://api.test/source.pdf/url",
        quote: "Located in Warrington",
        sourcePage: 2,
      }),
    );
  });

  it("does not show an evidence action without a PDF quote", () => {
    render(<FieldValue entityType="lease" fieldPath="lease.rent" label="Rent" value="" onOpenEvidence={vi.fn()} />);

    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open PDF evidence/ })).not.toBeInTheDocument();
  });
});

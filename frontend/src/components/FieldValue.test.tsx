import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FieldValue } from "./FieldValue";

describe("FieldValue", () => {
  it("opens source evidence for document provenance", async () => {
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
              sourceType: "pdf",
              quote: "Located in Warrington",
              url: "https://minio.test/source.pdf",
              refreshUrl: "https://api.test/source.pdf/url",
              expiresInSeconds: 900,
              document: "source.pdf",
              page: 2,
            },
          ],
        }}
        onOpenEvidence={onOpenEvidence}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open source evidence for City" }));

    expect(onOpenEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "asset",
        fieldPath: "asset.city",
        label: "City",
        value: "Warrington",
        source: expect.objectContaining({
          sourceType: "pdf",
          url: "https://minio.test/source.pdf",
          refreshUrl: "https://api.test/source.pdf/url",
          quote: "Located in Warrington",
          page: 2,
        }),
        sources: [
          expect.objectContaining({
            sourceType: "pdf",
            quote: "Located in Warrington",
          }),
        ],
      }),
    );
  });

  it("prefers a composite source over direct document sources", async () => {
    const user = userEvent.setup();
    const onOpenEvidence = vi.fn();

    render(
      <FieldValue
        entityType="asset"
        fieldPath="asset.rent_pu"
        label="Rent per unit"
        value="8.60"
        provenance={{
          "asset.rent_pu": [
            {
              sourceType: "pdf",
              quote: "Rent per unit is 8.60",
              url: "https://minio.test/source.pdf",
              refreshUrl: "https://api.test/source.pdf/url",
              expiresInSeconds: 900,
              document: "source.pdf",
              page: 2,
            },
            {
              sourceType: "composite",
              quote: "Rent per unit = rent / area",
              sources: [
                {
                  sourceType: "csv",
                  quote: "Rent row",
                  url: "https://minio.test/rent.csv",
                  refreshUrl: "https://api.test/rent.csv/url",
                  expiresInSeconds: 900,
                  document: "rent.csv",
                  row: 2,
                  column: "annual_rent_gbp",
                },
              ],
            },
          ],
        }}
        onOpenEvidence={onOpenEvidence}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open source evidence for Rent per unit" }));

    expect(onOpenEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceType: "composite",
          quote: "Rent per unit = rent / area",
        }),
      }),
    );
  });

  it("prefers the full field path before falling back to the field key", async () => {
    const user = userEvent.setup();
    const onOpenEvidence = vi.fn();

    render(
      <FieldValue
        entityType="lease"
        fieldPath="lease.walt"
        label="WALT"
        value="3.4"
        provenance={{
          walt: {
            sourceType: "pdf",
            quote: "Fallback quote",
            url: "https://minio.test/fallback.pdf",
            refreshUrl: "https://api.test/fallback.pdf/url",
            expiresInSeconds: 900,
            document: "fallback.pdf",
            page: 1,
          },
          "lease.walt": {
            sourceType: "csv",
            quote: "Specific quote",
            url: "https://minio.test/specific.csv",
            refreshUrl: "https://api.test/specific.csv/url",
            expiresInSeconds: 900,
            document: "specific.csv",
            row: 3,
            column: "expiry_date",
          },
        }}
        onOpenEvidence={onOpenEvidence}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open source evidence for WALT" }));

    expect(onOpenEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceType: "csv",
          quote: "Specific quote",
        }),
      }),
    );
  });

  it("does not show an evidence action without source provenance", () => {
    render(<FieldValue entityType="lease" fieldPath="lease.rent" label="Rent" value="" onOpenEvidence={vi.fn()} />);

    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open source evidence/ })).not.toBeInTheDocument();
  });
});

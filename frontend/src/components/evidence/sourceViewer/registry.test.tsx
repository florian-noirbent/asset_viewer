import { describe, expect, it } from "vitest";

import type { ProvenanceSource } from "../../../types";
import { getSourceRenderer } from "./registry";

describe("source viewer registry", () => {
  it("returns metadata for composite sources", () => {
    const renderer = getSourceRenderer({ sourceType: "composite", quote: "Total rent / total area", sources: [] });

    expect(renderer.getTitle({ sourceType: "composite", quote: "Total rent / total area", sources: [] })).toBe("Calculation");
    expect(renderer.getShortTitle({ sourceType: "composite", quote: "Total rent / total area", sources: [] })).toBe("Calculation");
    expect(renderer.getGroupLabel({ sourceType: "composite", quote: "Total rent / total area", sources: [] })).toBe("Calculations");
    expect(renderer.Icon).toBeDefined();
  });

  it("returns metadata for PDF sources", () => {
    const source = makePdfSource();
    const renderer = getSourceRenderer(source);

    expect(renderer.getTitle(source)).toBe("summary.pdf - page 3");
    expect(renderer.getShortTitle(source)).toBe("PDF p.3");
    expect(renderer.getGroupLabel(source)).toBe("PDF");
    expect(renderer.Icon).toBeDefined();
  });

  it("returns metadata for CSV sources", () => {
    const source = makeCsvSource();
    const renderer = getSourceRenderer(source);

    expect(renderer.getTitle(source)).toBe("rent-roll.csv - row 4, annual_rent");
    expect(renderer.getShortTitle(source)).toBe("CSV row 4");
    expect(renderer.getGroupLabel(source)).toBe("CSV");
  });

  it("returns metadata for Excel cell and range sources", () => {
    const cellSource = makeExcelCellSource();
    const rangeSource = makeExcelRangeSource();
    const renderer = getSourceRenderer(cellSource);

    expect(renderer.getTitle(cellSource)).toBe("model.xlsx - Rent Roll!D4");
    expect(renderer.getShortTitle(cellSource)).toBe("Rent Roll!D4");
    expect(renderer.getTitle(rangeSource)).toBe("model.xlsx - Area Reconciliation!B2:C4");
    expect(renderer.getShortTitle(rangeSource)).toBe("Area Reconciliation!B2:C4");
    expect(renderer.getGroupLabel(cellSource)).toBe("EXCEL");
  });

  it("returns a fallback renderer for unsupported source shapes", () => {
    const source = { sourceType: "image", quote: "Unsupported source" } as unknown as ProvenanceSource;
    const renderer = getSourceRenderer(source);

    expect(renderer.getTitle(source)).toBe("Unsupported source: image");
    expect(renderer.getShortTitle(source)).toBe("image");
    expect(renderer.getGroupLabel(source)).toBe("Unsupported");
  });
});

function makePdfSource(): ProvenanceSource {
  return {
    sourceType: "pdf",
    document: "summary.pdf",
    quote: "Investment summary",
    page: 3,
    url: "https://minio.test/summary.pdf",
    refreshUrl: "https://api.test/summary.pdf/url",
    expiresInSeconds: 900,
  };
}

function makeCsvSource(): ProvenanceSource {
  return {
    sourceType: "csv",
    document: "rent-roll.csv",
    quote: "Annual rent evidence",
    row: 4,
    column: "annual_rent",
    url: "https://minio.test/rent-roll.csv",
    refreshUrl: "https://api.test/rent-roll.csv/url",
    expiresInSeconds: 900,
  };
}

function makeExcelCellSource(): ProvenanceSource {
  return {
    sourceType: "excel",
    document: "model.xlsx",
    quote: "Cell evidence",
    sheet: "Rent Roll",
    cell: "D4",
    url: "https://minio.test/model.xlsx",
    refreshUrl: "https://api.test/model.xlsx/url",
    expiresInSeconds: 900,
  };
}

function makeExcelRangeSource(): ProvenanceSource {
  return {
    sourceType: "excel",
    document: "model.xlsx",
    quote: "Range evidence",
    sheet: "Area Reconciliation",
    range: "B2:C4",
    url: "https://minio.test/model.xlsx",
    refreshUrl: "https://api.test/model.xlsx/url",
    expiresInSeconds: 900,
  };
}

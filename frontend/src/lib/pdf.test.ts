import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearPdfDocumentCache, loadCachedPdfObjectUrl } from "./pdf";

function makeResponse(label: string, ok = true, status = 200) {
  return {
    ok,
    status,
    blob: vi.fn().mockResolvedValue(new Blob([label], { type: "application/pdf" })),
  } as unknown as Response;
}

beforeEach(async () => {
  clearPdfDocumentCache();
  await Promise.resolve();
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}:${Math.random()}`) as never;
  URL.revokeObjectURL = vi.fn() as never;
});

describe("loadCachedPdfObjectUrl", () => {
  it("reuses the cached object URL for the same PDF URL", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse("source"));

    const firstUrl = await loadCachedPdfObjectUrl("https://example.test/source.pdf");
    const secondUrl = await loadCachedPdfObjectUrl("https://example.test/source.pdf");

    expect(secondUrl).toBe(firstUrl);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://example.test/source.pdf");
  });

  it("keeps only the last 10 opened documents and revokes evicted URLs", async () => {
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(makeResponse(String(url))));

    for (let index = 0; index < 11; index += 1) {
      await loadCachedPdfObjectUrl(`https://example.test/document-${index}.pdf`);
    }

    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));

    await loadCachedPdfObjectUrl("https://example.test/document-0.pdf");

    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it("refreshes recency when a cached URL is opened again", async () => {
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(makeResponse(String(url))));

    for (let index = 0; index < 10; index += 1) {
      await loadCachedPdfObjectUrl(`https://example.test/document-${index}.pdf`);
    }

    const firstDocumentUrl = await loadCachedPdfObjectUrl("https://example.test/document-0.pdf");
    await loadCachedPdfObjectUrl("https://example.test/document-10.pdf");

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(firstDocumentUrl);
  });

  it("does not cache failed loads", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse("missing", false, 404))
      .mockResolvedValueOnce(makeResponse("recovered"));

    await expect(loadCachedPdfObjectUrl("https://example.test/source.pdf")).rejects.toThrow("Unable to load PDF");
    await expect(loadCachedPdfObjectUrl("https://example.test/source.pdf")).resolves.toMatch(/^blob:/);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("revokes all object URLs when clearing the cache", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse("source"));
    const objectUrl = await loadCachedPdfObjectUrl("https://example.test/source.pdf");

    clearPdfDocumentCache();

    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearPdfDocumentCache, loadCachedPdfObjectUrl } from "./pdf";

function makePdfResponse(label: string, ok = true, status = 200) {
  return {
    ok,
    status,
    blob: vi.fn().mockResolvedValue(new Blob([label], { type: "application/pdf" })),
  } as unknown as Response;
}

function makePresignResponse(url: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue({ url, expires_in_seconds: 900 }),
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
    vi.mocked(fetch).mockResolvedValue(makePdfResponse("source"));

    const firstUrl = await loadCachedPdfObjectUrl("https://minio.test/source.pdf", "https://api.test/source.pdf/url");
    const secondUrl = await loadCachedPdfObjectUrl("https://minio.test/source.pdf", "https://api.test/source.pdf/url");

    expect(secondUrl).toBe(firstUrl);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://minio.test/source.pdf");
  });

  it("keeps only the last 10 opened documents and revokes evicted URLs", async () => {
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(makePdfResponse(String(url))));

    for (let index = 0; index < 11; index += 1) {
      await loadCachedPdfObjectUrl(`https://minio.test/document-${index}.pdf`, `https://api.test/document-${index}.pdf/url`);
    }

    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));

    await loadCachedPdfObjectUrl("https://minio.test/document-0.pdf", "https://api.test/document-0.pdf/url");

    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it("refreshes recency when a cached URL is opened again", async () => {
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(makePdfResponse(String(url))));

    for (let index = 0; index < 10; index += 1) {
      await loadCachedPdfObjectUrl(`https://minio.test/document-${index}.pdf`, `https://api.test/document-${index}.pdf/url`);
    }

    const firstDocumentUrl = await loadCachedPdfObjectUrl("https://minio.test/document-0.pdf", "https://api.test/document-0.pdf/url");
    await loadCachedPdfObjectUrl("https://minio.test/document-10.pdf", "https://api.test/document-10.pdf/url");

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(firstDocumentUrl);
  });

  it("does not cache failed loads", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makePdfResponse("missing", false, 404))
      .mockResolvedValueOnce(makePdfResponse("recovered"));

    await expect(loadCachedPdfObjectUrl("https://minio.test/source.pdf")).rejects.toThrow("Unable to load PDF");
    await expect(loadCachedPdfObjectUrl("https://minio.test/source.pdf")).resolves.toMatch(/^blob:/);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("revokes all object URLs when clearing the cache", async () => {
    vi.mocked(fetch).mockResolvedValue(makePdfResponse("source"));
    const objectUrl = await loadCachedPdfObjectUrl("https://minio.test/source.pdf", "https://api.test/source.pdf/url");

    clearPdfDocumentCache();

    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl));
  });

  it("refreshes the source URL once when the direct source URL is expired", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makePdfResponse("expired", false, 403))
      .mockResolvedValueOnce(makePresignResponse("https://minio.test/recovered.pdf"))
      .mockResolvedValueOnce(makePdfResponse("recovered"));

    await expect(loadCachedPdfObjectUrl("https://minio.test/expired.pdf", "https://api.test/source.pdf/url")).resolves.toMatch(/^blob:/);

    expect(fetch).toHaveBeenNthCalledWith(1, "https://minio.test/expired.pdf");
    expect(fetch).toHaveBeenNthCalledWith(2, "https://api.test/source.pdf/url");
    expect(fetch).toHaveBeenNthCalledWith(3, "https://minio.test/recovered.pdf");
  });

  it("does not cache failed refresh attempts", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makePdfResponse("expired", false, 403))
      .mockResolvedValueOnce(makePresignResponse("https://minio.test/missing.pdf", false, 404))
      .mockResolvedValueOnce(makePdfResponse("recovered"));

    await expect(loadCachedPdfObjectUrl("https://minio.test/expired.pdf", "https://api.test/source.pdf/url")).rejects.toThrow("Unable to refresh PDF URL");
    await expect(loadCachedPdfObjectUrl("https://minio.test/recovered.pdf", "https://api.test/source.pdf/url")).resolves.toMatch(/^blob:/);

    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

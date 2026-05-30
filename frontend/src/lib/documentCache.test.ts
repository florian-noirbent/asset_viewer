import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearDocumentCache, configureDocumentCache, loadCachedArrayBuffer, loadCachedBlob, loadCachedObjectUrl, loadCachedText } from "./documentCache";

function makeDocumentResponse(label: string, ok = true, status = 200) {
  return {
    ok,
    status,
    blob: vi.fn().mockResolvedValue(new Blob([label], { type: "text/plain" })),
  } as unknown as Response;
}

function makeRefreshResponse(url: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue({ url, expires_in_seconds: 900 }),
  } as unknown as Response;
}

beforeEach(() => {
  clearDocumentCache();
  configureDocumentCache({ maxDocuments: 10 });
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}:${Math.random()}`) as never;
  URL.revokeObjectURL = vi.fn() as never;
});

describe("document cache", () => {
  it("reuses cached object URLs for the same source URL", async () => {
    vi.mocked(fetch).mockResolvedValue(makeDocumentResponse("source"));

    const firstUrl = await loadCachedObjectUrl("https://minio.test/source.pdf", "https://api.test/source.pdf/url");
    const secondUrl = await loadCachedObjectUrl("https://minio.test/source.pdf", "https://api.test/source.pdf/url");

    expect(secondUrl).toBe(firstUrl);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://minio.test/source.pdf");
  });

  it("uses the refresh URL as the cache key when signed source URLs rotate", async () => {
    vi.mocked(fetch).mockResolvedValue(makeDocumentResponse("source"));

    const firstUrl = await loadCachedObjectUrl("https://minio.test/source.pdf?signature=one", "https://api.test/source.pdf/url");
    const secondUrl = await loadCachedObjectUrl("https://minio.test/source.pdf?signature=two", "https://api.test/source.pdf/url");

    expect(secondUrl).toBe(firstUrl);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached blob for text and array buffer loads", async () => {
    vi.mocked(fetch).mockResolvedValue(makeDocumentResponse("source"));

    await expect(loadCachedText("https://minio.test/source.csv")).resolves.toBe("source");
    const arrayBuffer = await loadCachedArrayBuffer("https://minio.test/source.csv");

    expect(new TextDecoder().decode(arrayBuffer)).toBe("source");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps only the most recent documents and revokes evicted object URLs", async () => {
    configureDocumentCache({ maxDocuments: 2 });
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(makeDocumentResponse(String(url))));

    const firstUrl = await loadCachedObjectUrl("https://minio.test/document-0.pdf");
    await loadCachedObjectUrl("https://minio.test/document-1.pdf");
    await loadCachedObjectUrl("https://minio.test/document-2.pdf");

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);

    await loadCachedBlob("https://minio.test/document-0.pdf");

    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("refreshes recency when a cached document is loaded again", async () => {
    configureDocumentCache({ maxDocuments: 2 });
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(makeDocumentResponse(String(url))));

    const firstUrl = await loadCachedObjectUrl("https://minio.test/document-0.pdf");
    await loadCachedObjectUrl("https://minio.test/document-1.pdf");
    await loadCachedObjectUrl("https://minio.test/document-0.pdf");
    await loadCachedObjectUrl("https://minio.test/document-2.pdf");

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(firstUrl);
  });

  it("does not cache failed loads", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeDocumentResponse("missing", false, 404))
      .mockResolvedValueOnce(makeDocumentResponse("recovered"));

    await expect(loadCachedBlob("https://minio.test/source.csv")).rejects.toThrow("Unable to load document");
    await expect(loadCachedObjectUrl("https://minio.test/source.csv")).resolves.toMatch(/^blob:/);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("revokes all object URLs when clearing the cache", async () => {
    vi.mocked(fetch).mockResolvedValue(makeDocumentResponse("source"));
    const objectUrl = await loadCachedObjectUrl("https://minio.test/source.pdf");

    clearDocumentCache();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("refreshes the source URL once when the direct URL is unauthorized", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeDocumentResponse("expired", false, 403))
      .mockResolvedValueOnce(makeRefreshResponse("https://minio.test/recovered.csv"))
      .mockResolvedValueOnce(makeDocumentResponse("recovered"));

    await expect(loadCachedText("https://minio.test/expired.csv", "https://api.test/source.csv/url")).resolves.toBe("recovered");

    expect(fetch).toHaveBeenNthCalledWith(1, "https://minio.test/expired.csv");
    expect(fetch).toHaveBeenNthCalledWith(2, "https://api.test/source.csv/url");
    expect(fetch).toHaveBeenNthCalledWith(3, "https://minio.test/recovered.csv");
  });

  it("does not cache failed refresh attempts", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeDocumentResponse("expired", false, 401))
      .mockResolvedValueOnce(makeRefreshResponse("https://minio.test/missing.csv", false, 404))
      .mockResolvedValueOnce(makeDocumentResponse("recovered"));

    await expect(loadCachedBlob("https://minio.test/expired.csv", "https://api.test/source.csv/url")).rejects.toThrow("Unable to refresh document URL");
    await expect(loadCachedText("https://minio.test/recovered.csv", "https://api.test/source.csv/url")).resolves.toBe("recovered");

    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

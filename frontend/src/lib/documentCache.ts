const DEFAULT_MAX_DOCUMENTS = 10;
const REFRESHABLE_STATUSES = new Set([401, 403]);

type CachedDocument = {
  blobPromise: Promise<Blob>;
  objectUrl?: string;
  textPromise?: Promise<string>;
  arrayBufferPromise?: Promise<ArrayBuffer>;
};

export type CachedDocumentRequest = {
  url: string;
  refreshUrl?: string;
};

const documentCache = new Map<string, CachedDocument>();
let maxCachedDocuments = DEFAULT_MAX_DOCUMENTS;

export function configureDocumentCache(options: { maxDocuments?: number } = {}) {
  const nextMaxDocuments = options.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
  maxCachedDocuments = Math.max(1, Math.floor(nextMaxDocuments));
  evictLeastRecentlyUsedDocuments();
}

export function clearDocumentCache() {
  for (const cachedDocument of documentCache.values()) {
    revokeObjectUrl(cachedDocument);
  }

  documentCache.clear();
}

export async function loadCachedBlob(url: string, refreshUrl?: string): Promise<Blob>;
export async function loadCachedBlob(request: CachedDocumentRequest): Promise<Blob>;
export async function loadCachedBlob(requestOrUrl: CachedDocumentRequest | string, refreshUrl?: string): Promise<Blob> {
  const request = normalizeRequest(requestOrUrl, refreshUrl);
  const cachedDocument = getOrCreateCachedDocument(request);

  try {
    return await cachedDocument.blobPromise;
  } catch (error) {
    const key = getCacheKey(request);

    if (documentCache.get(key) === cachedDocument) {
      documentCache.delete(key);
    }

    throw error;
  }
}

export async function loadCachedObjectUrl(url: string, refreshUrl?: string): Promise<string>;
export async function loadCachedObjectUrl(request: CachedDocumentRequest): Promise<string>;
export async function loadCachedObjectUrl(requestOrUrl: CachedDocumentRequest | string, refreshUrl?: string): Promise<string> {
  const request = normalizeRequest(requestOrUrl, refreshUrl);
  const cachedDocument = getOrCreateCachedDocument(request);

  if (cachedDocument.objectUrl) {
    return cachedDocument.objectUrl;
  }

  const blob = await loadCachedBlob(request);
  cachedDocument.objectUrl = URL.createObjectURL(blob);
  return cachedDocument.objectUrl;
}

export async function loadCachedText(url: string, refreshUrl?: string): Promise<string>;
export async function loadCachedText(request: CachedDocumentRequest): Promise<string>;
export async function loadCachedText(requestOrUrl: CachedDocumentRequest | string, refreshUrl?: string): Promise<string> {
  const request = normalizeRequest(requestOrUrl, refreshUrl);
  const cachedDocument = getOrCreateCachedDocument(request);

  cachedDocument.textPromise ??= loadCachedBlob(request).then(readBlobText);
  return cachedDocument.textPromise;
}

export async function loadCachedArrayBuffer(url: string, refreshUrl?: string): Promise<ArrayBuffer>;
export async function loadCachedArrayBuffer(request: CachedDocumentRequest): Promise<ArrayBuffer>;
export async function loadCachedArrayBuffer(requestOrUrl: CachedDocumentRequest | string, refreshUrl?: string): Promise<ArrayBuffer> {
  const request = normalizeRequest(requestOrUrl, refreshUrl);
  const cachedDocument = getOrCreateCachedDocument(request);

  cachedDocument.arrayBufferPromise ??= loadCachedBlob(request).then(readBlobArrayBuffer);
  return cachedDocument.arrayBufferPromise;
}

function normalizeRequest(requestOrUrl: CachedDocumentRequest | string, refreshUrl?: string): CachedDocumentRequest {
  return typeof requestOrUrl === "string" ? { url: requestOrUrl, refreshUrl } : requestOrUrl;
}

function getOrCreateCachedDocument(request: CachedDocumentRequest): CachedDocument {
  const key = getCacheKey(request);
  const cachedDocument = documentCache.get(key);

  if (cachedDocument) {
    documentCache.delete(key);
    documentCache.set(key, cachedDocument);
    return cachedDocument;
  }

  const nextCachedDocument: CachedDocument = {
    blobPromise: fetchDocumentBlob(request),
  };

  documentCache.set(key, nextCachedDocument);
  evictLeastRecentlyUsedDocuments();
  return nextCachedDocument;
}

function getCacheKey(request: CachedDocumentRequest): string {
  return request.refreshUrl ?? request.url;
}

async function fetchDocumentBlob(request: CachedDocumentRequest): Promise<Blob> {
  const response = await fetch(request.url);

  if (response.ok) {
    return response.blob();
  }

  if (request.refreshUrl && REFRESHABLE_STATUSES.has(response.status)) {
    const refreshedUrl = await refreshDocumentUrl(request.refreshUrl);
    const refreshedResponse = await fetch(refreshedUrl);

    if (refreshedResponse.ok) {
      return refreshedResponse.blob();
    }

    throw new Error(`Unable to load document after refresh: ${refreshedResponse.status}`);
  }

  throw new Error(`Unable to load document: ${response.status}`);
}

async function refreshDocumentUrl(refreshUrl: string): Promise<string> {
  const response = await fetch(refreshUrl);

  if (!response.ok) {
    throw new Error(`Unable to refresh document URL: ${response.status}`);
  }

  const payload = (await response.json()) as { url?: unknown };

  if (typeof payload.url !== "string" || payload.url.length === 0) {
    throw new Error("Unable to refresh document URL: missing URL");
  }

  return payload.url;
}

function evictLeastRecentlyUsedDocuments() {
  while (documentCache.size > maxCachedDocuments) {
    const oldestKey = documentCache.keys().next().value;

    if (!oldestKey) {
      return;
    }

    const oldestDocument = documentCache.get(oldestKey);
    if (oldestDocument) {
      revokeObjectUrl(oldestDocument);
    }

    documentCache.delete(oldestKey);
  }
}

function revokeObjectUrl(cachedDocument: CachedDocument) {
  if (!cachedDocument.objectUrl) {
    return;
  }

  URL.revokeObjectURL(cachedDocument.objectUrl);
  cachedDocument.objectUrl = undefined;
}

async function readBlobText(blob: Blob): Promise<string> {
  if ("text" in blob && typeof blob.text === "function") {
    return blob.text();
  }

  const arrayBuffer = await readBlobArrayBuffer(blob);
  return new TextDecoder().decode(arrayBuffer);
}

function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if ("arrayBuffer" in blob && typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read document blob"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read document blob")));
    reader.readAsArrayBuffer(blob);
  });
}

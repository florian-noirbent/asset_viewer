const MAX_CACHED_DOCUMENTS = 10;

type CachedPdfUrl = {
  objectUrl: string;
  sourceUrl: string;
};

type PresignedPdfUrl = {
  url: string;
  expires_in_seconds: number;
};

const objectUrlCache = new Map<string, Promise<CachedPdfUrl>>();

export async function loadCachedPdfObjectUrl(sourceUrl: string, refreshUrl?: string): Promise<string> {
  const cacheKey = refreshUrl ?? sourceUrl;
  const cachedUrl = objectUrlCache.get(cacheKey);

  if (cachedUrl) {
    objectUrlCache.delete(cacheKey);
    objectUrlCache.set(cacheKey, cachedUrl);
    return (await cachedUrl).objectUrl;
  }

  const objectUrlPromise = fetchPdfObjectUrl(sourceUrl, refreshUrl).catch((error) => {
    if (objectUrlCache.get(cacheKey) === objectUrlPromise) {
      objectUrlCache.delete(cacheKey);
    }
    throw error;
  });

  objectUrlCache.set(cacheKey, objectUrlPromise);
  trimObjectUrlCache();

  return (await objectUrlPromise).objectUrl;
}

export function clearPdfDocumentCache() {
  for (const cachedUrl of objectUrlCache.values()) {
    void cachedUrl.then(({ objectUrl }) => URL.revokeObjectURL(objectUrl)).catch(() => undefined);
  }
  objectUrlCache.clear();
}

async function fetchPdfObjectUrl(sourceUrl: string, refreshUrl?: string): Promise<CachedPdfUrl> {
  let pdfResponse = await fetch(sourceUrl);

  if (shouldRefreshSourceUrl(pdfResponse) && refreshUrl) {
    const refreshedUrl = await fetchRefreshedSourceUrl(refreshUrl);
    pdfResponse = await fetch(refreshedUrl);
  }

  if (!pdfResponse.ok) {
    throw new Error(`Unable to load PDF (${pdfResponse.status})`);
  }

  const blob = await pdfResponse.blob();

  return {
    objectUrl: URL.createObjectURL(blob),
    sourceUrl,
  };
}

async function fetchRefreshedSourceUrl(refreshUrl: string): Promise<string> {
  const refreshResponse = await fetch(refreshUrl);

  if (!refreshResponse.ok) {
    throw new Error(`Unable to refresh PDF URL (${refreshResponse.status})`);
  }

  const refreshedUrl = (await refreshResponse.json()) as PresignedPdfUrl;

  if (!refreshedUrl.url) {
    throw new Error("Unable to refresh PDF URL");
  }

  return refreshedUrl.url;
}

function shouldRefreshSourceUrl(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function trimObjectUrlCache() {
  while (objectUrlCache.size > MAX_CACHED_DOCUMENTS) {
    const oldestUrl = objectUrlCache.keys().next().value;

    if (!oldestUrl) {
      return;
    }

    const oldestObjectUrl = objectUrlCache.get(oldestUrl);
    objectUrlCache.delete(oldestUrl);
    void oldestObjectUrl?.then(({ objectUrl }) => URL.revokeObjectURL(objectUrl)).catch(() => undefined);
  }
}

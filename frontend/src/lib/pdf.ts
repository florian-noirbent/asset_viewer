const MAX_CACHED_DOCUMENTS = 10;

type CachedPdfUrl = {
  objectUrl: string;
  sourceUrl: string;
};

const objectUrlCache = new Map<string, Promise<CachedPdfUrl>>();

export async function loadCachedPdfObjectUrl(pdfUrl: string): Promise<string> {
  const cachedUrl = objectUrlCache.get(pdfUrl);

  if (cachedUrl) {
    objectUrlCache.delete(pdfUrl);
    objectUrlCache.set(pdfUrl, cachedUrl);
    return (await cachedUrl).objectUrl;
  }

  const objectUrlPromise = fetchPdfObjectUrl(pdfUrl).catch((error) => {
    if (objectUrlCache.get(pdfUrl) === objectUrlPromise) {
      objectUrlCache.delete(pdfUrl);
    }
    throw error;
  });

  objectUrlCache.set(pdfUrl, objectUrlPromise);
  trimObjectUrlCache();

  return (await objectUrlPromise).objectUrl;
}

export function clearPdfDocumentCache() {
  for (const cachedUrl of objectUrlCache.values()) {
    void cachedUrl.then(({ objectUrl }) => URL.revokeObjectURL(objectUrl)).catch(() => undefined);
  }
  objectUrlCache.clear();
}

async function fetchPdfObjectUrl(pdfUrl: string): Promise<CachedPdfUrl> {
  const response = await fetch(pdfUrl);

  if (!response.ok) {
    throw new Error(`Unable to load PDF (${response.status})`);
  }

  const blob = await response.blob();

  return {
    objectUrl: URL.createObjectURL(blob),
    sourceUrl: pdfUrl,
  };
}

function trimObjectUrlCache() {
  while (objectUrlCache.size > MAX_CACHED_DOCUMENTS) {
    const oldestUrl = objectUrlCache.keys().next().value as string | undefined;

    if (!oldestUrl) {
      return;
    }

    const oldestObjectUrl = objectUrlCache.get(oldestUrl);
    objectUrlCache.delete(oldestUrl);
    void oldestObjectUrl?.then(({ objectUrl }) => URL.revokeObjectURL(objectUrl)).catch(() => undefined);
  }
}

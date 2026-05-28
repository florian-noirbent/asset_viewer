import type { AssetDetail, AssetSummary } from "./types";

const env = import.meta.env as { readonly VITE_API_BASE_URL?: string };
const configuredApiBaseUrl = (env.VITE_API_BASE_URL ?? "").trim();
const API_BASE_URL = (configuredApiBaseUrl || "http://localhost:8000").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `${fallbackError} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function unwrapList<T>(payload: T[] | { items?: T[]; assets?: T[] }): T[] {
  if (Array.isArray(payload)) return payload;
  return payload.items ?? payload.assets ?? [];
}

export async function listAssets(): Promise<AssetSummary[]> {
  const response = await fetch(apiUrl("/api/assets"));
  const payload = await readJson<AssetSummary[] | { items?: AssetSummary[]; assets?: AssetSummary[] }>(response, "Unable to load assets");

  return unwrapList(payload);
}

export async function getAsset(assetId: string): Promise<AssetDetail> {
  const response = await fetch(apiUrl(`/api/assets/${encodeURIComponent(assetId)}`));
  return readJson<AssetDetail>(response, "Unable to load asset");
}

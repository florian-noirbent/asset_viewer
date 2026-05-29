import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Building2, Loader2, RefreshCw } from "lucide-react";

import { listAssets } from "../api";
import type { AssetSummary } from "../types";

export function AssetsPage() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setAssets(await listAssets());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load assets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-line bg-canopy-cream shadow-panel">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-normal text-moss">Portfolio inputs</div>
            <h2 className="mt-1 font-semibold">Assets</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadAssets()}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-canopy-ink hover:border-moss hover:text-moss focus:outline-none focus:ring-2 focus:ring-moss"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-canopy-fern">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading assets
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 bg-red-50 px-4 py-8 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : assets.length === 0 ? (
          <div className="px-4 py-8 text-sm text-canopy-fern">No assets returned by the API yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {assets.map((asset) => (
              <Link key={asset.id} to={`/assets/${asset.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-white">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-canopy-mint text-moss">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{asset.name}</div>
                  <div className="truncate text-xs text-canopy-fern">{[asset.city, asset.country].filter(Boolean).join(", ") || asset.address}</div>
                </div>
                <div className="hidden shrink-0 rounded-md border border-line bg-white px-2 py-1 text-xs text-canopy-fern sm:block">
                  {asset.assetType ?? asset.asset_type ?? asset.propertyType ?? asset.property_type ?? "Asset"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Database, FolderOpen } from "lucide-react";

import { AssetDetailPage } from "./pages/AssetDetailPage";
import { AssetsPage } from "./pages/AssetsPage";

export function App() {
  return (
    <div className="flex min-h-screen bg-canopy-mist text-ink">
      <aside className="hidden w-64 border-r border-line bg-canopy-cream md:flex md:flex-col">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-canopy-ink text-sm font-semibold text-canopy-cream">GC</div>
            <div>
              <div className="text-lg font-semibold">GoCanopy</div>
              <div className="mt-0.5 text-sm text-canopy-fern">Asset intelligence</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <NavLink
            to="/assets"
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium ${isActive ? "bg-canopy-mint text-canopy-ink" : "text-canopy-fern hover:bg-white"}`
            }
          >
            <FolderOpen className="h-4 w-4 text-moss" />
            Assets
          </NavLink>
          <button className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-canopy-fern hover:bg-white" type="button">
            <Database className="h-4 w-4" />
            Sources
          </button>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-canopy-cream px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-normal text-moss">Investments</div>
          <h1 className="mt-1 text-xl font-semibold">Asset Library</h1>
          <p className="text-sm text-canopy-fern">Review extracted asset data, leases, and source evidence.</p>
        </header>

        <div className="flex-1 p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/assets" replace />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:assetId" element={<AssetDetailPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

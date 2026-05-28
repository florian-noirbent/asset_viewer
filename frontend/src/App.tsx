import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Database, FolderOpen } from "lucide-react";

import { AssetDetailPage } from "./pages/AssetDetailPage";
import { AssetsPage } from "./pages/AssetsPage";

export function App() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-ink">
      <aside className="hidden w-60 border-r border-line bg-white md:flex md:flex-col">
        <div className="border-b border-line px-5 py-5">
          <div className="text-lg font-semibold">GoCanopy</div>
          <div className="mt-1 text-sm text-slate-500">Asset intelligence</div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <NavLink
            to="/assets"
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium ${isActive ? "bg-slate-100 text-ink" : "text-slate-500 hover:bg-slate-50"}`
            }
          >
            <FolderOpen className="h-4 w-4 text-moss" />
            Assets
          </NavLink>
          <button className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-500" type="button">
            <Database className="h-4 w-4" />
            Sources
          </button>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-white px-5 py-4">
          <h1 className="text-xl font-semibold">Asset Library</h1>
          <p className="text-sm text-slate-500">Review extracted asset data, leases, and source evidence.</p>
        </header>

        <div className="flex-1 p-4">
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

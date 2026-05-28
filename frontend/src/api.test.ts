import { afterEach, describe, expect, it, vi } from "vitest";

import { getAsset, listAssets } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("asset API", () => {
  it("loads the asset list from the API", async () => {
    const assets = [{ id: "asset-1", name: "Causeway Park" }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: assets }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listAssets()).resolves.toEqual(assets);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/assets");
  });

  it("loads an asset detail from the API", async () => {
    const asset = { id: "asset-1", name: "Causeway Park", leases: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(asset), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAsset("asset-1")).resolves.toEqual(asset);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/assets/asset-1");
  });
});

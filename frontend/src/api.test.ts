import { afterEach, describe, expect, it, vi } from "vitest";

import { getAsset, listAssets, uploadAsset } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadAsset", () => {
  it("posts multipart form data to the configured upload endpoint", async () => {
    const response = {
      id: "asset-1",
      filename: "policy.pdf",
      content_type: "application/pdf",
      size_bytes: 6,
      bucket: "uploads",
      object_key: "uploads/asset-1/policy.pdf",
      status: "uploaded",
      created_at: "2026-05-28T10:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const file = new File(["policy"], "policy.pdf", { type: "application/pdf" });
    const result = await uploadAsset(file);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/uploads", {
      method: "POST",
      body: expect.any(FormData),
    });
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(result).toEqual(response);
  });
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

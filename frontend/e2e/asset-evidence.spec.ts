import { expect, type Locator, type Page, test } from "@playwright/test";

const assetName = "Causeway Park";

test.describe("asset evidence flow", () => {
  test("opens Causeway Park and switches from asset source to lease source without a blank page", async ({ page }) => {
    const assertNoBrowserErrors = collectBrowserErrors(page);
    const pdfRequests = collectPdfResourceRequests(page);

    await page.goto("/");
    await assertAppIsVisible(page);

    await page.getByRole("link", { name: new RegExp(assetName, "i") }).click();
    await expect(page.getByRole("heading", { name: assetName })).toBeVisible();
    await expect(page.getByText("Wilderspool Causeway, Warrington WA4 6RF", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Logistics", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Multi-let industrial estate", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("GBP", { exact: true }).first()).toBeVisible();

    await openSource(page, "Asset name");
    await expectSourcePanelLoaded(page, "Asset name");
    await assertAppIsVisible(page);

    const fetchedPdfCountAfterAssetSource = pdfRequests.size;
    expect(fetchedPdfCountAfterAssetSource).toBeGreaterThanOrEqual(1);

    await openSource(page, "Gross rent", { force: true });
    await expectSourcePanelLoaded(page, "Gross rent");
    await assertAppIsVisible(page);

    expect(pdfRequests.size).toBe(fetchedPdfCountAfterAssetSource);
    assertNoBrowserErrors();
  });

  test("opens Meridian composite evidence and drills into CSV, Excel, and PDF sources", async ({ page }) => {
    const assertNoBrowserErrors = collectBrowserErrors(page);

    await page.goto("/");
    await assertAppIsVisible(page);

    await page.getByRole("link", { name: /Meridian Trade Park/i }).click();
    await expect(page.getByRole("heading", { name: "Meridian Trade Park" })).toBeVisible();

    await openSource(page, "Rent per unit");
    const panel = page.getByRole("complementary", { name: "Source evidence" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Calculation source")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meridian Trade Park" })).toBeVisible();

    await panel
      .getByRole("button", { name: /source_viewer_demo\.xlsx/i })
      .first()
      .click();
    await expect(panel.getByRole("button", { name: "Valuation Inputs" })).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText("172000").first()).toBeVisible();

    await panel.getByRole("button", { name: "Back to previous source" }).click();
    await expect(panel.getByText("Calculation source")).toBeVisible();

    await panel.getByRole("button", { name: /Total gross rent = Northstar rent/i }).click();
    await expect(panel.getByText("Total gross rent = Northstar rent 96000 + Greenline rent 76000").first()).toBeVisible();

    await panel
      .getByRole("button", { name: /source_viewer_demo\.csv/i })
      .first()
      .click();
    await expect(panel.getByText("Northstar Components Ltd").first()).toBeVisible({ timeout: 30_000 });

    await panel.getByRole("button", { name: "Back to previous source" }).click();
    await panel.getByRole("button", { name: "Back to previous source" }).click();
    await panel
      .getByRole("button", { name: /source_viewer_demo\.pdf/i })
      .first()
      .click();
    await expectSourcePanelLoaded(page, "Rent per unit");

    const resizeHandle = page.getByRole("button", { name: "Resize source viewer" });
    await expect(resizeHandle).toBeVisible();
    const mainContentBeforeResize = await page.getByRole("heading", { name: "Meridian Trade Park" }).boundingBox();
    expect(mainContentBeforeResize).not.toBeNull();
    await resizeHandle.dragTo(page.locator("body"), { targetPosition: { x: 520, y: 220 } });
    await expect(page.getByRole("heading", { name: "Meridian Trade Park" })).toBeVisible();

    await panel.getByRole("button", { name: "Close source viewer" }).click();
    await expect(panel).toBeHidden();
    assertNoBrowserErrors();
  });
});

function collectBrowserErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const text = message.text();
    if (text.includes("Failed to load resource: the server responded with a status of 404")) return;

    consoleErrors.push(text);
  });

  return () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  };
}

function collectPdfResourceRequests(page: Page) {
  const pdfRequests = new Set<string>();

  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/assets/resources/") || !url.toLowerCase().includes(".pdf")) return;

    pdfRequests.add(stripSignedQuery(url));
  });

  return pdfRequests;
}

async function openSource(page: Page, label: string, options?: { force?: boolean }) {
  const button = page.getByRole("button", { name: `Open source evidence for ${label}` }).first();

  if (options?.force) {
    await button.evaluate((element) => {
      if (!(element instanceof HTMLElement)) throw new Error("Source trigger is not an HTML element");
      element.click();
    });
    return;
  }

  await button.click();
}

async function expectSourcePanelLoaded(page: Page, label: string) {
  const panel = page.getByRole("complementary", { name: "Source evidence" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: label })).toBeVisible();
  await expect(panel.getByText("Loading PDF", { exact: true })).toBeHidden({ timeout: 30_000 });
  await expect(panel.getByText("Loading PDF viewer")).toBeHidden({ timeout: 30_000 });
  await expect(getPdfRenderedContent(panel)).toBeVisible({ timeout: 30_000 });
}

async function assertAppIsVisible(page: Page) {
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asset Library" })).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
}

function getPdfRenderedContent(panel: Locator) {
  return panel.locator("[data-testid='pdf-viewer-shell'] canvas, [data-testid='pdf-viewer-shell'] .rpv-core__page-layer").first();
}

function stripSignedQuery(url: string) {
  const parsedUrl = new URL(url);
  return `${parsedUrl.origin}${parsedUrl.pathname}`;
}

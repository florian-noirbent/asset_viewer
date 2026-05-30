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
  const button = page.getByRole("button", { name: `Open PDF evidence for ${label}` }).first();

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
  const panel = page.getByRole("dialog", { name: "PDF source evidence" });
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

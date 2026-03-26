import { expect, test, type Page } from "@playwright/test";

async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Living Island")).toBeVisible();
}

test.describe("Living Island shell feature sweep", () => {
  test("renders primary shell regions and default controls", async ({ page }) => {
    await openApp(page);
    await expect(page.locator(".top-bar")).toBeVisible();
    await expect(page.locator(".left-panel")).toBeVisible();
    await expect(page.locator(".right-panel")).toBeVisible();
    await expect(page.locator(".bottom-strip")).toBeVisible();
    await expect(page.locator(".world-viewport")).toBeVisible();
    await expect(page.getByRole("button", { name: "timelapse" })).toBeVisible();
  });

  test("supports simulation speed, cinematic toggle, and photo mode", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "timelapse" }).click();
    await expect(page.locator(".indicator-column .indicator-card").first()).toContainText("Timelapse active");

    await page.getByRole("button", { name: "Cinematic" }).click();
    await expect(page.locator(".indicator-column .indicator-card").nth(1)).toContainText("Cinematic camera");

    await page.getByRole("button", { name: "Photo Mode" }).click();
    await expect(page.locator(".top-bar")).toHaveCount(0);
    await expect(page.locator(".left-panel")).toHaveCount(0);
    await expect(page.locator(".world-viewport")).toBeVisible();
  });

  test("supports seed input generation and surprise world generation", async ({ page }) => {
    await openApp(page);

    const seedInput = page.getByLabel("World seed");
    await seedInput.fill("playwright-seed-001");
    await page.getByRole("button", { name: "Generate World" }).click();
    await expect(page.getByText("Seed playwright-seed-001")).toBeVisible();

    const before = await seedInput.inputValue();
    await page.getByRole("button", { name: "Surprise Me" }).click();
    await expect(seedInput).not.toHaveValue(before);
  });

  test("supports mode switching and overlay legend rendering", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "build zone" }).click();
    await expect(page.getByRole("heading", { name: "Zone Type" })).toBeVisible();

    await page.getByRole("button", { name: "place utility" }).click();
    await expect(page.getByRole("heading", { name: "Utility" })).toBeVisible();

    await page.getByRole("button", { name: "build road" }).click();
    await expect(page.locator(".left-panel")).toContainText("Intersections:");

    await page.getByRole("button", { name: "traffic" }).click();
    await expect(page.locator(".overlay-legend")).toContainText("Traffic");

    await page.getByRole("button", { name: "power" }).click();
    await expect(page.locator(".overlay-legend")).toContainText("Power");
  });

  test("supports manual save-slot labeling and save/load controls", async ({ page }) => {
    await openApp(page);

    const slot1Label = page.getByLabel("slot-1 name");
    const slot1Row = slot1Label.locator("xpath=ancestor::div[contains(@class,'save-slot-row')][1]");
    await slot1Label.fill("Playwright Slot One");
    await slot1Row.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => slot1Row.getByRole("button", { name: "Load" }).isEnabled(), {
        timeout: 20_000,
      })
      .toBe(true);
    await slot1Row.getByRole("button", { name: "Load" }).click();
    await expect(page.locator(".top-bar__footer")).not.toContainText("No save found");
  });
});

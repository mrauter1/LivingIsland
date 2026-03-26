import { expect, test } from "@playwright/test";

test("shows renderer fallback surface when WebGL bootstrap fails without crashing the shell", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(
      this: HTMLCanvasElement,
      contextId: string,
      options?: CanvasRenderingContext2DSettings,
    ) {
      if (contextId === "webgl2" || contextId === "webgl" || contextId === "experimental-webgl") {
        throw new Error("Forced WebGL failure for fallback verification");
      }
      return originalGetContext.call(this, contextId, options);
    };
  });

  await page.goto("/");

  await expect(page.locator(".world-viewport")).toBeVisible();
  await expect(page.locator(".world-canvas-error")).toContainText("3D viewport unavailable");
  await expect(page.getByText("Living Island")).toBeVisible();
});

test("keeps the viewport visible and centered on a phone-width layout without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".world-viewport")).toBeVisible();

  const mobileLayout = await page.evaluate(() => {
    const viewport = document.querySelector(".world-viewport");
    const shell = document.querySelector(".app-shell");
    if (!(viewport instanceof HTMLElement) || !(shell instanceof HTMLElement)) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();
    return {
      centerOffset: Math.abs(window.innerWidth / 2 - (rect.left + rect.right) / 2),
      gridTemplateColumns: getComputedStyle(shell).gridTemplateColumns,
      left: rect.left,
      right: rect.right,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(mobileLayout).not.toBeNull();
  expect(mobileLayout?.scrollWidth).toBeLessThanOrEqual((mobileLayout?.viewportWidth ?? 0) + 1);
  expect(mobileLayout?.left).toBeGreaterThanOrEqual(0);
  expect(mobileLayout?.right).toBeLessThanOrEqual((mobileLayout?.viewportWidth ?? 0) + 1);
  expect(mobileLayout?.centerOffset).toBeLessThanOrEqual(8);
  expect(mobileLayout?.gridTemplateColumns).not.toContain(" ");
});

test("uses the short-screen viewport sizing path without reintroducing desktop clipping", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");

  await expect(page.locator(".world-viewport")).toBeVisible();

  const compactLayout = await page.evaluate(() => {
    const viewport = document.querySelector(".world-viewport");
    const shell = document.querySelector(".app-shell");
    if (!(viewport instanceof HTMLElement) || !(shell instanceof HTMLElement)) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();
    const styles = getComputedStyle(viewport);
    return {
      computedMinHeight: Number.parseFloat(styles.minHeight),
      height: rect.height,
      right: rect.right,
      scrollWidth: document.documentElement.scrollWidth,
      shellColumns: getComputedStyle(shell).gridTemplateColumns,
      viewportWidth: window.innerWidth,
    };
  });

  expect(compactLayout).not.toBeNull();
  expect(compactLayout?.computedMinHeight).toBeLessThan(500);
  expect(compactLayout?.height).toBeLessThan(500);
  expect(compactLayout?.right).toBeLessThanOrEqual((compactLayout?.viewportWidth ?? 0) + 1);
  expect(compactLayout?.scrollWidth).toBeLessThanOrEqual((compactLayout?.viewportWidth ?? 0) + 1);
  expect(compactLayout?.shellColumns).not.toContain(" ");
});

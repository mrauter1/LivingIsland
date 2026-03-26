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

import { test, expect } from "@playwright/test";

/**
 * Smoke test: the home page loads and responds 2xx.
 * Replace/extend with real flows (login, checkout, story creation).
 */
test("home page loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/.+/);
});

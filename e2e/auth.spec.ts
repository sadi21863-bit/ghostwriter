import { test, expect } from "@playwright/test";

/**
 * Auth UI flow (no data mutation).
 *
 * The tab-switching assertions are pure client UI (no DB). The invalid-sign-in
 * assertion exercises the real NextAuth credentials path and so needs the DB
 * reachable — it only ever attempts a bad login, it never creates data.
 *
 * RUN AGAINST A STABLE SERVER, not the Turbopack dev server: HMR + the login
 * page's infinite background CSS animations make Playwright's actionability waits
 * flaky under `next dev`. Use a production build or a deployed URL, e.g.
 *   next build && next start            # then: npm run test:e2e
 *   PLAYWRIGHT_BASE_URL=https://www.ghost-writer.cc npm run test:e2e
 */
test.describe("auth UI", () => {
  test("switches between sign-in and create-account, showing the right fields", async ({ page }) => {
    await page.goto("/login", { waitUntil: "commit" });

    // Page is interactive once the always-present email field renders.
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible({ timeout: 30_000 });
    // Default Sign In tab: the Name field belongs to the register tab only.
    await expect(page.getByPlaceholder("Your name")).toHaveCount(0);

    // → Create Account (unambiguous footer link, not the duplicate-labelled tab/submit).
    // force:true — the page runs infinite background CSS animations (gw-mesh) which
    // can stall Playwright's click actionability wait under the Turbopack dev server.
    await page.getByRole("button", { name: "Create one →" }).click({ force: true });
    await expect(page.getByPlaceholder("Your name")).toBeVisible();

    // → back to Sign In.
    await page.getByRole("button", { name: "Sign in →" }).click({ force: true });
    await expect(page.getByPlaceholder("Your name")).toHaveCount(0);
  });

  test("rejects an invalid sign-in with an error message", async ({ page }) => {
    await page.goto("/login", { waitUntil: "commit" });
    await page.getByPlaceholder("you@example.com").fill(`nobody+${Date.now()}@example.com`);
    await page.getByPlaceholder("••••••••").fill("definitely-not-the-password");
    await page.locator('button[type="submit"]').click({ force: true });
    await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 15_000 });
  });
});

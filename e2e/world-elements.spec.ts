import { test, expect } from "@playwright/test";

/**
 * Authenticated World Bible "Elements" flow — end-to-end through real auth + DB.
 *
 * GATED: this registers a throwaway user (a real DB row) so it only runs when you
 * opt in with E2E_ALLOW_SIGNUP=1. Skipped by default to keep `npm run test:e2e`
 * side-effect-free against a shared database.
 *
 * As with auth.spec.ts, run against a STABLE server (next start / deployed URL),
 * not the Turbopack dev server.
 *
 * It exercises the full world_entities slice shipped 2026-06-30:
 *   register → sign in (UI) → create a project → POST a world entity → GET it back.
 * The CRUD goes through the same authenticated cookie the browser holds, so it
 * validates auth + ownership + the zod-typed route end to end.
 */
const ALLOW = process.env.E2E_ALLOW_SIGNUP === "1";

test.describe("World Bible — Elements (authenticated)", () => {
  test.skip(!ALLOW, "set E2E_ALLOW_SIGNUP=1 to run (registers a throwaway DB user)");

  test("a signed-in user can create and read back a world entity", async ({ page }) => {
    const email = `e2e+${Date.now()}@example.com`;
    const password = "e2e-password-123";

    // 1. Register via the real API (carries into the browser context).
    const reg = await page.request.post("/api/auth/register", {
      data: { email, password, name: "E2E Tester" },
    });
    expect(reg.ok()).toBeTruthy();

    // 2. Sign in through the UI so the NextAuth session cookie is set on the context.
    await page.goto("/login", { waitUntil: "commit" });
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.locator('button[type="submit"]').click({ force: true });
    await page.waitForURL("**/dashboard", { timeout: 30_000 });

    // 3. Create a project (authenticated request — shares the browser's cookies).
    const projRes = await page.request.post("/api/projects", {
      data: { name: "E2E World", format: "Novel" },
    });
    expect(projRes.status()).toBe(201);
    const project = await projRes.json();

    // 4. Add a world entity (the slice under test).
    const createRes = await page.request.post(`/api/projects/${project.id}/world-entities`, {
      data: { name: "The Ember Blade", kind: "weapon", summary: "a sword wreathed in cold fire", properties: { origin: "forged in the north" } },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.kind).toBe("weapon");

    // 5. Read it back — proves persistence + ordering through the real route.
    const listRes = await page.request.get(`/api/projects/${project.id}/world-entities`);
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    const found = list.find((e: any) => e.id === created.id);
    expect(found).toBeTruthy();
    expect(found.name).toBe("The Ember Blade");
    expect(found.properties?.origin).toBe("forged in the north");
  });
});

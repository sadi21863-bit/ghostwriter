import { test, expect } from "@playwright/test";

/**
 * Studio Phase 1 smoke test — entry point, shell, and panes.
 *
 * Two modes:
 *
 *   MODE A — supply existing credentials (recommended; avoids auth rate limits):
 *     E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=yourpass \
 *       npm run test:e2e -- e2e/studio-phase1.spec.ts
 *
 *   MODE B — register a fresh throwaway user (hits the 5/hr IP rate limit faster):
 *     E2E_ALLOW_SIGNUP=1 npm run test:e2e -- e2e/studio-phase1.spec.ts
 *
 * Either mode needs a STABLE server (next start / deployed URL), not Turbopack dev.
 * Against local dev:
 *   next build && next start     (then in another terminal)
 *
 * Covers Task 8 verification items:
 *  1. "Studio →" link in writing room footer next to "Actions"
 *  2. Studio route loads with heading + 4 pane tabs
 *  3. Pipelines / Analytics / Exports panes show "coming soon" text
 *  4. Graph pane: ConstellationView container renders at 640 px height
 *  5. "← Back to writing room" link returns to the correct project URL
 *  6. Studio route returns HTTP 200 (not a 404 orphan)
 *  7. ?studioOpen=comic deep-link opens Comic Studio in the Actions drawer
 *  8. ?studioOpen=production deep-link opens Production Studio in the Actions drawer
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const ALLOW_SIGNUP = process.env.E2E_ALLOW_SIGNUP === "1";

const ENABLED = !!(TEST_EMAIL && TEST_PASSWORD) || ALLOW_SIGNUP;

test.describe("Studio Phase 1 — shell + entry point", () => {
  test.skip(!ENABLED,
    "set E2E_TEST_EMAIL+E2E_TEST_PASSWORD (use existing account) " +
    "or E2E_ALLOW_SIGNUP=1 (register throwaway user, counts toward 5/hr IP rate limit)"
  );

  test("full Studio smoke flow", async ({ page }) => {
    test.setTimeout(180_000);

    let email: string;
    let password: string;

    if (TEST_EMAIL && TEST_PASSWORD) {
      // ── Mode A: pre-existing credentials ─────────────────────────────────
      email = TEST_EMAIL;
      password = TEST_PASSWORD;
    } else {
      // ── Mode B: register a fresh throwaway user ───────────────────────────
      email = `e2e+studio+${Date.now()}@example.com`;
      password = "e2e-studio-pass-123";

      const reg = await page.request.post("/api/auth/register", {
        data: { email, password, name: "Studio E2E" },
      });
      if (!reg.ok()) {
        const body = await reg.text();
        throw new Error(
          `Register failed ${reg.status()}: ${body}\n` +
          "Tip: auth registration is rate-limited to 5/hr per IP. " +
          "Use E2E_TEST_EMAIL+E2E_TEST_PASSWORD to skip registration."
        );
      }
    }

    // ── Sign in via NextAuth API (bypasses UI login; sets session cookie) ────────
    // 1. Fetch the CSRF token NextAuth requires for credentials sign-in.
    const csrfRes = await page.request.get("/api/auth/csrf");
    expect(csrfRes.ok()).toBeTruthy();
    const { csrfToken } = await csrfRes.json();

    // 2. POST credentials — NextAuth sets the session cookie on this context.
    const signInRes = await page.request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, redirect: "false", callbackUrl: "/dashboard", json: "true" },
    });
    // NextAuth responds 200 with a redirect URL or the session; either way we
    // confirm the request succeeded before navigating.
    expect([200, 302].includes(signInRes.status())).toBeTruthy();

    // 3. Navigate to dashboard to confirm auth worked end-to-end.
    // First visit may trigger Turbopack compilation — allow up to 90s.
    await page.goto("/dashboard", { waitUntil: "load", timeout: 90_000 });
    // Dashboard redirect to /login means auth failed; any other URL means success.
    expect(page.url()).not.toContain("/login");

    // ── Create a project ──────────────────────────────────────────────────────
    const projRes = await page.request.post("/api/projects", {
      data: { name: "Studio E2E Project", format: "Novel" },
    });
    expect(projRes.status()).toBe(201);
    const { id: projectId } = await projRes.json();

    // ── 1. Writing room: Studio → link in footer ──────────────────────────────
    // First visit may trigger Turbopack compilation — give it up to 90s.
    await page.goto(`/project/${projectId}`, { waitUntil: "load", timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Actions" })).toBeVisible({ timeout: 90_000 });

    const studioLink = page.getByRole("link", { name: /Studio/i });
    await expect(studioLink).toBeVisible({ timeout: 10_000 });
    const href = await studioLink.getAttribute("href");
    expect(href).toContain(`/project/${projectId}/studio`);

    // ── 2. Studio route: HTTP 200 + heading + 4 tabs ──────────────────────────
    const studioRes = await page.goto(`/project/${projectId}/studio`, {
      waitUntil: "load",
      timeout: 90_000,
    });
    expect(studioRes?.status()).toBe(200);

    await expect(page.getByText("Studio", { exact: true })).toBeVisible({ timeout: 20_000 });
    for (const label of ["Graph", "Pipelines", "Analytics", "Exports"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }

    // ── 3. Coming-soon panes ──────────────────────────────────────────────────
    await page.getByRole("button", { name: "Pipelines" }).click();
    await expect(page.getByText(/Pipelines.*coming soon/i)).toBeVisible();

    await page.getByRole("button", { name: "Analytics" }).click();
    await expect(page.getByText(/Analytics.*coming soon/i)).toBeVisible();

    await page.getByRole("button", { name: "Exports" }).click();
    await expect(page.getByText(/Exports.*coming soon/i)).toBeVisible();

    // ── 4. Graph pane: ConstellationView at 640 px ────────────────────────────
    await page.getByRole("button", { name: "Graph" }).click();

    // Wait for a div whose rendered height is ~640 (allows ±10px for rounding).
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("div"))
        .some(d => { const h = d.getBoundingClientRect().height; return h >= 630 && h <= 660; }),
      { timeout: 30_000 }
    );

    const measuredHeight = await page.evaluate(() => {
      const match = Array.from(document.querySelectorAll("div"))
        .find(d => { const h = d.getBoundingClientRect().height; return h >= 630 && h <= 660; });
      return match?.getBoundingClientRect().height ?? 0;
    });
    expect(measuredHeight).toBeGreaterThanOrEqual(630);

    // ── 5. Back to writing room ───────────────────────────────────────────────
    await page.getByRole("link", { name: /Back to writing room/i }).click();
    await page.waitForURL(`**/project/${projectId}`, { timeout: 20_000 });
    expect(page.url()).toContain(`/project/${projectId}`);
    expect(page.url()).not.toContain("/studio");

    // ── 6. ?studioOpen=comic deep link ────────────────────────────────────────
    // Studio dispatches back to the writing room via a one-shot query param
    // (GhostWriterApp reads it on mount, opens the Actions drawer + the
    // requested studio, then scrubs the param from the URL). This is the
    // dispatch path Task 8's E2E only exercised for ?studioOpen=actions —
    // verifying the comic/production branches actually work too.
    await page.goto(`/project/${projectId}?studioOpen=comic`, { waitUntil: "load", timeout: 90_000 });
    await expect(page.getByText("🎨 Comic Studio", { exact: true })).toBeVisible({ timeout: 20_000 });
    // The one-shot param must be scrubbed after dispatch (regression guard for
    // the URL-scrub fix from the Phase 1 final review).
    expect(page.url()).not.toContain("studioOpen");

    // ── 7. ?studioOpen=production deep link ───────────────────────────────────
    // A fresh navigation (no click-to-close needed — the Actions drawer has no
    // keyboard handler, only a backdrop click; a full page.goto already resets
    // all React state, including actionsOpen/showComicStudio, for free).
    await page.goto(`/project/${projectId}?studioOpen=production`, { waitUntil: "load", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Production Studio" })).toBeVisible({ timeout: 20_000 });
    expect(page.url()).not.toContain("studioOpen");
  });
});

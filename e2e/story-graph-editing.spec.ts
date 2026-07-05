import { test, expect } from "@playwright/test";

/**
 * Story Graph Phase 2 — drag-drop graph editing smoke test.
 *
 * Same signup/login/project pattern as studio-phase1.spec.ts. Needs
 * E2E_ALLOW_SIGNUP=1 (or E2E_TEST_EMAIL/PASSWORD) and a stable server
 * (next build && next start), not the Turbopack dev server.
 */
const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const ALLOW_SIGNUP = process.env.E2E_ALLOW_SIGNUP === "1";
const ENABLED = !!(TEST_EMAIL && TEST_PASSWORD) || ALLOW_SIGNUP;

test.describe("Story Graph — drag-drop editing", () => {
  test.skip(!ENABLED, "set E2E_TEST_EMAIL+E2E_TEST_PASSWORD or E2E_ALLOW_SIGNUP=1");

  test("draws a wire between two existing characters to create a relationship", async ({ page }) => {
    test.setTimeout(180_000);

    const email = TEST_EMAIL ?? `e2e+storygraph+${Date.now()}@example.com`;
    const password = TEST_PASSWORD ?? "e2e-storygraph-pass-123";

    if (!TEST_EMAIL) {
      const reg = await page.request.post("/api/auth/register", {
        data: { email, password, name: "StoryGraph E2E" },
      });
      if (!reg.ok()) throw new Error(`Register failed ${reg.status()}: ${await reg.text()}`);
    }

    const csrfRes = await page.request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const signInRes = await page.request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, redirect: "false", callbackUrl: "/dashboard", json: "true" },
    });
    expect([200, 302].includes(signInRes.status())).toBeTruthy();

    const projRes = await page.request.post("/api/projects", {
      data: { name: "StoryGraph E2E Project", format: "Novel" },
    });
    expect(projRes.status()).toBe(201);
    const { id: projectId } = await projRes.json();

    // Seed two characters directly via the API — the test targets wire-drawing,
    // not node creation, so start from known nodes rather than also depending
    // on the (harder-to-simulate) native HTML5 palette-drag path.
    const charARes = await page.request.post(`/api/projects/${projectId}/characters`, { data: { name: "Mara" } });
    const charA = await charARes.json();
    const charBRes = await page.request.post(`/api/projects/${projectId}/characters`, { data: { name: "Kessler" } });
    const charB = await charBRes.json();

    const consoleErrors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

    await page.goto(`/project/${projectId}/studio`, { waitUntil: "load", timeout: 90_000 });
    await page.getByRole("button", { name: "Graph" }).click();

    // Palette chips render (proves the drag-create affordance is wired up, even
    // though this test exercises the wire-drawing path, not the native-DnD path).
    await expect(page.getByText("+ Character")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("+ Location")).toBeVisible();
    await expect(page.getByText("+ Thread")).toBeVisible();

    // Wait for both seeded characters to render as React Flow nodes.
    const nodeA = page.locator(`.react-flow__node[data-id="${charA.id}"]`);
    const nodeB = page.locator(`.react-flow__node[data-id="${charB.id}"]`);
    await expect(nodeA).toBeVisible({ timeout: 30_000 });
    await expect(nodeB).toBeVisible();

    // Draw a wire: React Flow's connection line is pointer-driven (not native
    // HTML5 DnD), so plain mouse actions work directly — but strict connection
    // mode (the default) requires dragging FROM a source handle (bottom) TO a
    // target handle (top), not just anywhere on the destination node's body.
    const sourceHandleA = nodeA.locator(".react-flow__handle-bottom");
    const targetHandleB = nodeB.locator(".react-flow__handle-top");
    const boxA = await sourceHandleA.boundingBox();
    const boxB = await targetHandleB.boundingBox();
    if (!boxA || !boxB) throw new Error("Could not locate source/target handle bounding boxes");

    // A couple of small intermediate pauses/moves — React Flow's pointer-driven
    // drag needs the gesture to actually move before it starts a connection line,
    // a single move+down+move+up sequence doesn't reliably register.
    const cx = boxA.x + boxA.width / 2, cy = boxA.y + boxA.height / 2;
    const tx = boxB.x + boxB.width / 2, ty = boxB.y + boxB.height / 2;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(cx + 20, cy + 20, { steps: 5 });
    await page.waitForTimeout(100);
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();

    // onConnect PATCHes /relationship-map then refetches /story-graph — poll THAT
    // endpoint (not /relationship-map, which only surfaces edges for characters
    // that co-occur in chapter text — irrelevant here, this project has none).
    await expect(async () => {
      const graphRes = await page.request.get(`/api/projects/${projectId}/story-graph`);
      const { edges } = await graphRes.json();
      const created = edges.find((e: any) =>
        e.kind === "relationship" &&
        [e.source, e.target].includes(charA.id) && [e.source, e.target].includes(charB.id)
      );
      expect(created).toBeTruthy();
    }).toPass({ timeout: 20_000 });

    expect(consoleErrors).toEqual([]);
  });
});

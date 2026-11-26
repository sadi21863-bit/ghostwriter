/**
 * Real-browser E2E for the thin local shell.
 *
 * A `vm.Script` pin proves the served app.js parses; this proves the listeners
 * actually run. It boots the real loopback host on a fresh temp DB, drives the
 * shell in Chromium, and asserts observable behavior:
 *
 *   1. owner-token gate accepts the token and shows Write
 *   2. autosave persists text across a reload
 *   3. Continue with AI posts the chapter tail and inserts the response
 *   4. continuity notes save, load back, and never duplicate on re-save
 *   5. the Doctor renders the unresolved-promise REVIEW wording
 *   6. the Settings model picker populates from /provider-models
 *
 * /ai/generate and /provider-models are fulfilled by Playwright route stubs:
 * this verifies UI wiring, not model quality, and spends nothing. The host is
 * booted with generation OFF, so a missed stub cannot reach a provider.
 *
 *   node scripts/verify-local-shell-e2e.mjs
 *
 * The per-launch owner token is parsed from stderr and never printed.
 */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const REPO = resolve(import.meta.dirname, "..");
const RUN_DIR = resolve(
  process.env.TEMP ?? ".",
  "gw-e2e",
  `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
);
const DB = resolve(RUN_DIR, "shell.sqlite");
const ERR_LOG = resolve(RUN_DIR, "host.err");
const OUT_LOG = resolve(RUN_DIR, "host.out");

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", rej);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => res(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e });
    console.log(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

let hostPid;
let browser;
let page;

function killHost() {
  if (!hostPid) return;
  const pid = hostPid;
  hostPid = undefined;
  execFile("taskkill", ["/PID", String(pid), "/T", "/F"], () => undefined);
}

async function main() {
  mkdirSync(RUN_DIR, { recursive: true });
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  // A fixed token keeps this run deterministic; it is generated here, never
  // printed, and dies with the host. Normal hosts still mint per launch.
  const token = randomBytes(24).toString("hex");
  const env = {
    ...process.env,
    GW_LOCAL_DB: DB,
    GW_LOCAL_HOST_PORT: String(port),
    GW_LOCAL_TOKEN: token,
    // Generation stays OFF: every model call in this run is a browser stub.
    GW_LOCAL_GENERATION: "",
  };
  const outFd = openSync(OUT_LOG, "w");
  const errFd = openSync(ERR_LOG, "w");
  const child = spawn("cmd.exe", ["/c", "npx tsx scripts/spawn-local-host.mts"], {
    cwd: REPO,
    env,
    stdio: ["ignore", outFd, errFd],
  });
  hostPid = child.pid;
  closeSync(outFd);
  closeSync(errFd);

  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const api = async (path, method = "GET", body) => {
    const res = await fetch(base + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok || data.ok === false) {
      throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    }
    return data;
  };

  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      await api("/providers");
      break;
    } catch (e) {
      if (attempt === 60) throw e;
      await sleep(1000);
    }
  }
  console.log(`host up at ${base} (db ${DB})`);

  // -- seed: one project (seeded chapter) + a second chapter directly --------
  const projectName = `E2E Shell ${Date.now()}`;
  const created = await api("/projects", "POST", {
    name: projectName,
    format: "Novel",
    storyType: "linear",
  });
  const projectId = created.project?.id;
  assert.ok(projectId, "project create returned no id");

  const db = new DatabaseSync(DB);
  db.exec("PRAGMA busy_timeout = 5000");
  db.prepare(
    "INSERT INTO chapters (id, project_id, title, content, sort_order, word_count, created_at, updated_at) VALUES (?, ?, ?, '', ?, 0, ?, ?)",
  ).run(`e2e-${projectId}-ch2`, projectId, "Chapter 2", 1, Date.now(), Date.now());
  db.close();

  const graph0 = await api(`/projects/${projectId}`);
  const chapters0 = (graph0.project?.chapters ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  assert.equal(chapters0.length, 2, "expected two chapters");
  const ch1 = chapters0[0];
  const ch2 = chapters0[1];

  // -- browser ---------------------------------------------------------------
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url ?? "";
    // The shell serves no favicon; Chromium logs a 404 for it. Nothing else.
    if (url.endsWith("favicon.ico")) return;
    problems.push(`console: ${m.text()} (${url})`);
  });

  await page.goto(base, { waitUntil: "domcontentloaded" });

  await step("gate: owner token opens the Write view", async () => {
    await page.waitForSelector("#gate-token", { timeout: 15_000 });
    await page.fill("#gate-token", token);
    await page.press("#gate-token", "Enter");
    await page.waitForSelector("#app:not([hidden])", { timeout: 20_000 });
    await page.waitForSelector("#project-list li", { timeout: 20_000 });
  });

  await step("project: selecting it paints the editor and both chapter tabs", async () => {
    await page.locator("#project-list li", { hasText: projectName }).click();
    await page.waitForSelector("#write-pane:not([hidden])", { timeout: 15_000 });
    await page.waitForFunction(() => document.querySelectorAll("#chapter-tabs button").length === 2, null, {
      timeout: 15_000,
    });
    assert.equal(await page.locator("#editor").inputValue(), "");
  });

  const marker = `Autosave marker ${Date.now()}.`;
  await step("autosave: typed text persists across a reload", async () => {
    await page.fill("#editor", marker);
    await page.waitForFunction(
      () => document.getElementById("save-state")?.textContent === "saved",
      null,
      { timeout: 20_000 },
    );
    const g = await api(`/projects/${projectId}`);
    const row = g.project.chapters.find((c) => c.id === ch1.id);
    assert.match(String(row?.content ?? ""), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#app:not([hidden])", { timeout: 20_000 });
    await page.waitForFunction(
      (want) => (document.getElementById("editor")?.value ?? "").includes(want),
      marker,
      { timeout: 20_000 },
    );
  });

  const continuation = `STUBBED CONTINUATION ${Date.now()} — the lamp answered.`;
  let genBody = null;
  await page.route("**/ai/generate", async (route) => {
    genBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        text: continuation,
        model: "stub-model",
        tokensUsed: 12,
      }),
    });
  });

  await step("continue: posts the chapter tail and inserts the response", async () => {
    await page.click("#generate-next");
    await page.waitForFunction(
      () => document.getElementById("gen-state")?.textContent?.includes("inserted") === true,
      null,
      { timeout: 20_000 },
    );
    assert.ok(genBody, "no /ai/generate request captured");
    assert.equal(genBody.mode, "write");
    assert.equal(genBody.chapterId, ch1.id);
    assert.ok(
      String(genBody.dynamicContext ?? "").includes(marker),
      "dynamicContext did not carry the chapter tail",
    );
    assert.match(await page.locator("#editor").inputValue(), new RegExp(continuation.split(" ")[0]));
    await page.waitForFunction(
      () => document.getElementById("save-state")?.textContent === "saved",
      null,
      { timeout: 20_000 },
    );
    const g = await api(`/projects/${projectId}`);
    const row = g.project.chapters.find((c) => c.id === ch1.id);
    assert.match(String(row?.content ?? ""), /STUBBED CONTINUATION/);
  });

  const promiseA = "The brass key must be returned";
  const promiseB = "The canal gate stays locked at dusk";
  const shiftLine = "Mara: the brass key opens the canal gate";

  await step("continuity: save writes one note with the chapter index", async () => {
    await page.locator("#continuity-notes").evaluate((el) => {
      el.open = true;
    });
    await page.fill("#continuity-promises-opened", `${promiseA}\n${promiseB}`);
    await page.fill("#continuity-promises-resolved", "");
    await page.fill("#continuity-knowledge-shifts", shiftLine);
    await page.click("#save-continuity");
    await page.waitForFunction(
      () => document.getElementById("continuity-state")?.textContent === "saved",
      null,
      { timeout: 20_000 },
    );

    const data = await api(`/projects/${projectId}/story-memories`);
    const notes = (data.memories ?? []).filter(
      (m) => m.chapterId === ch1.id && String(m.fact ?? "").startsWith("Continuity notes for "),
    );
    assert.equal(notes.length, 1, "expected exactly one continuity note");
    assert.equal(notes[0].chapterIndex, 0);
    assert.deepEqual(notes[0].structuredData.openPromisesCreated, [promiseA, promiseB]);
    assert.equal(notes[0].structuredData.knowledgeShifts[0].character, "Mara");
    assert.equal(
      notes[0].structuredData.knowledgeShifts[0].learned,
      "the brass key opens the canal gate",
    );
  });

  await step("continuity: re-saving replaces instead of duplicating", async () => {
    await page.fill("#continuity-promises-opened", promiseA);
    await page.click("#save-continuity");
    await page.waitForFunction(
      () => document.getElementById("continuity-state")?.textContent === "saved",
      null,
      { timeout: 20_000 },
    );
    const data = await api(`/projects/${projectId}/story-memories`);
    const notes = (data.memories ?? []).filter(
      (m) => m.chapterId === ch1.id && String(m.fact ?? "").startsWith("Continuity notes for "),
    );
    assert.equal(notes.length, 1, "re-save duplicated the note");
    assert.deepEqual(notes[0].structuredData.openPromisesCreated, [promiseA]);
  });

  await step("continuity: switching chapters resets, then loads the saved note back", async () => {
    await page.locator("#chapter-tabs button").nth(1).click();
    await page.waitForFunction(
      () => document.getElementById("continuity-promises-opened")?.value === "",
      null,
      { timeout: 10_000 },
    );
    await page.locator("#chapter-tabs button").nth(0).click();
    await page.waitForFunction(
      (want) => (document.getElementById("continuity-promises-opened")?.value ?? "").includes(want),
      promiseA,
      { timeout: 20_000 },
    );
    assert.match(await page.locator("#continuity-knowledge-shifts").inputValue(), /Mara:/);
  });

  await step("doctor: unresolved promises render as a review decision", async () => {
    await api(`/projects/${projectId}/story-memories`, "POST", {
      fact: "E2E doctor probe",
      chapterIndex: 0,
      chapterId: ch1.id,
      structuredData: { openPromisesCreated: [promiseA] },
    });
    await page.click("#run-doctor");
    await page.waitForSelector("#doctor-results:not([hidden])", { timeout: 20_000 });
    const text = await page.locator("#doctor-results").innerText();
    assert.match(text, /Unresolved promise/i);
    assert.match(text, /decide whether that is intentional/i);
  });

  await step("settings: selecting a provider fills the model picker", async () => {
    await page.route("**/provider-models/opencode", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          models: [
            { id: "stub-model", label: "Stub Model" },
            { id: "stub-model-2", label: "Stub Model 2" },
          ],
        }),
      });
    });
    await page.click('.tab[data-view="settings"]');
    await page.waitForSelector("#view-settings:not([hidden])", { timeout: 10_000 });
    await page.selectOption("#settings-provider", "opencode");
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("#settings-model-picker option")).some(
          (o) => o.value === "stub-model",
        ),
      null,
      { timeout: 20_000 },
    );
    await page.selectOption("#settings-model-picker", "stub-model");
    assert.equal(await page.locator("#settings-model").inputValue(), "stub-model");
    await page.click('#settings-form button[type="submit"]');
    await page.waitForFunction(
      () => document.getElementById("settings-state")?.textContent?.includes("saved") === true,
      null,
      { timeout: 20_000 },
    );
  });

  await step("bible: propose → accept applies the edit as a transaction", async () => {
    await page.click('.tab[data-view="bible"]');
    await page.waitForSelector("#view-bible:not([hidden])", { timeout: 10_000 });
    const name = `E2E Character ${Date.now()}`;
    page.once("dialog", (d) => d.accept(name));
    await page.click("#new-character");
    await page.waitForFunction(
      (want) =>
        document.querySelector('#entity-fields [data-key="name"]')?.value === want,
      name,
      { timeout: 20_000 },
    );
    await page.fill('#entity-fields [data-key="role"]', "Lighthouse keeper");
    await page.fill('#entity-fields [data-key="personality"]', "Patient, exacting.");
    await page.click('#bible-form button[type="submit"]');
    await page.waitForSelector("#proposal:not([hidden])", { timeout: 20_000 });
    const diff = await page.locator("#proposal-rows").innerText();
    assert.match(diff, /role/i);
    assert.match(diff, /Lighthouse keeper/);
    await page.click("#accept-proposal");
    await page.waitForFunction(
      (want) =>
        Array.from(document.querySelectorAll("#character-list li")).some((li) =>
          li.textContent?.includes(want),
        ),
      name,
      { timeout: 20_000 },
    );
    const g = await api(`/projects/${projectId}`);
    const character = (g.project.characters ?? []).find((c) => c.name === name);
    assert.ok(character, "accepted character missing");
    assert.equal(character.role, "Lighthouse keeper");
  });

  await step("bible: reject keeps the canonical entry untouched", async () => {
    const name = `E2E Location ${Date.now()}`;
    page.once("dialog", (d) => d.accept(name));
    await page.click("#new-location");
    await page.waitForFunction(
      (want) =>
        document.querySelector('#entity-fields [data-key="name"]')?.value === want,
      name,
      { timeout: 20_000 },
    );
    await page.fill('#entity-fields [data-key="description"]', "Never saved.");
    await page.click('#bible-form button[type="submit"]');
    await page.waitForSelector("#proposal:not([hidden])", { timeout: 20_000 });
    assert.match(await page.locator("#proposal-rows").innerText(), /Never saved/);
    await page.click("#reject-proposal");
    await page.waitForSelector("#proposal", { state: "hidden", timeout: 10_000 });
    const g = await api(`/projects/${projectId}`);
    const location = (g.project.locations ?? []).find((l) => l.name === name);
    assert.ok(location, "rejected location should still exist (create is direct)");
    assert.equal(location.description ?? "", "");
  });

  await step("browser: no page errors or unexpected console errors", async () => {
    assert.deepEqual(problems, []);
  });

  const failed = results.filter((r) => !r.ok);
  writeFileSync(
    resolve(RUN_DIR, "result.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        db: DB,
        passed: results.length - failed.length,
        failed: failed.length,
        results: results.map((r) => ({ name: r.name, ok: r.ok })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("E2E FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await browser?.close();
    } catch {
      /* */
    }
    killHost();
    console.log(`artifacts: ${RUN_DIR}`);
  });

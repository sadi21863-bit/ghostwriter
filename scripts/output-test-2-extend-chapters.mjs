/**
 * Output Test 2 extension: 3 more chapters (4-6) for each Novel-format story,
 * continuing from the real chapter 3 content already on disk from Track B.
 * Real staticContext on every call, per the Track B v2 lesson.
 *
 * Usage: node scripts/output-test-2-extend-chapters.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "novel");

const STORIES = {
  "the-dealer": {
    projectId: "c109dd81-13c4-4f0b-98d3-cebc7a6afad0",
    staticContext: [
      "CHARACTERS:",
      "- Mara Voss (protagonist): guarded, methodical, haunted by her father's legacy. Wants: escape the family business without getting anyone killed.",
      "- Kessler (antagonist): calculating, controlled, dangerous. Wants: consolidate control over the regional arms trade.",
      "",
      "LOCATIONS:",
      "- The Armory: A decommissioned grain silo converted into a weapons cache on the edge of town, corrugated steel and sodium light.",
    ].join("\n"),
    lastChapterFile: "the-dealer-Novel-chapter3.json",
  },
  "the-horizon-line": {
    projectId: "4bbfd6fe-bc07-4394-a4db-9bd5c8da39e3",
    staticContext: [
      "CHARACTERS:",
      "- Dr. Elena Marsh (protagonist): rational, increasingly unraveling, fiercely loyal to her research. Wants: prove the anomaly is real before she's discredited or worse.",
      "- The Warden (antagonist): patient, inhuman logic wearing a human voice. Wants: keep the station's true purpose hidden.",
      "",
      "LOCATIONS:",
      "- Horizon Station: An isolated arctic research outpost built over a structure that predates any human expedition.",
    ].join("\n"),
    lastChapterFile: "the-horizon-line-Novel-chapter3.json",
  },
};

let cookies = "";
function captureCookies(res) {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    cookies = cookies.split("; ").filter(kv => !kv.startsWith(name + "=")).concat(pair).filter(Boolean).join("; ");
  }
}
async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(cookies ? { Cookie: cookies } : {}), ...(opts.headers || {}) },
  });
  captureCookies(res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 1000); }
  return { status: res.status, json };
}
function save(name, data) {
  writeFileSync(join(OUT_DIR, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

// Calls normally first; only retries with bypassViolationCheck if the app's
// own confirmation gate actually fires (mirrors a real user's confirm click).
async function generateWithConfirm(body) {
  const first = await req("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
  if (first.json?.requiresConfirmation) {
    console.log(`  [violation gate fired: ${first.json.violationType} -- confirming through]`);
    return req("/api/ai/generate", { method: "POST", body: JSON.stringify({ ...body, bypassViolationCheck: true }) });
  }
  return first;
}

async function extendStory(key, story) {
  console.log(`\n=== Extending ${key} ===`);
  let priorContent = JSON.parse(readFileSync(join(OUT_DIR, story.lastChapterFile), "utf8")).text ?? "";

  for (let i = 4; i <= 6; i++) {
    const { json: chapter } = await req(`/api/projects/${story.projectId}/chapters`, { method: "POST", body: JSON.stringify({ title: `Chapter ${i}` }) });
    const prompt = `Continue the story. Previous chapter ended:\n${priorContent.slice(-1500)}\n\nWrite chapter ${i}, advancing the plot toward a real turning point.`;
    const { json: writeRes } = await generateWithConfirm({
      mode: "write", prompt, context: "", staticContext: story.staticContext, dynamicContext: "",
      format: "Novel", projectId: story.projectId, chapterId: chapter.id,
    });
    save(`${key}-Novel-chapter${i}.json`, writeRes);
    priorContent = writeRes.text ?? "";
    console.log(`chapter ${i}:`, priorContent.length, "chars");
    await req(`/api/projects/${story.projectId}/chapters/${chapter.id}`, { method: "PATCH", body: JSON.stringify({ content: priorContent }) });
  }
}

async function main() {
  const { json: csrf } = await req("/api/auth/csrf");
  const signIn = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookies ? { Cookie: cookies } : {}) },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: PASSWORD, redirect: "false", callbackUrl: "/dashboard", json: "true" }),
    redirect: "manual",
  });
  captureCookies(signIn);
  console.log("sign-in status:", signIn.status);

  for (const [key, story] of Object.entries(STORIES)) {
    await extendStory(key, story);
  }

  console.log("\nAll new chapters saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

/**
 * Targeted fix-and-retry for Track B's two real issues:
 * 1. All 4 refine calls got "text too short" because the script tried a
 *    nonexistent GET /chapters/[chapterId] route -- for the-dealer-Novel,
 *    the-dealer-Screenplay, and the-horizon-line-Screenplay, the chapter 1
 *    content is already saved from the original run; just re-send it to
 *    /api/ai/refine directly, no regeneration needed.
 * 2. the-horizon-line-Novel's chapter 1 tripped the op_protagonist safety
 *    gate (working as designed) and the script didn't handle it, which then
 *    cascaded into chapters 2/3 being written with no real prior context.
 *    Full redo of that one sub-track's chapter loop + villain-pov +
 *    tension-curve + refine, this time with bypassViolationCheck: true.
 *
 * Usage: node scripts/output-test-2-track-b-fix.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2");

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
function save(subdir, name, data) {
  writeFileSync(join(OUT_DIR, subdir, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}
function readSavedText(subdir, name) {
  const raw = readFileSync(join(OUT_DIR, subdir, name), "utf8");
  return JSON.parse(raw)?.text ?? "";
}

const SUMMARY = JSON.parse(readFileSync(join(OUT_DIR, "TRACK-B-SUMMARY.json"), "utf8"));

async function retryRefine(subdir, label, projectId, chapterId, chapterFileName, format) {
  const text = readSavedText(subdir, chapterFileName);
  console.log(`\nretrying refine: ${label} (chapter1 text: ${text.length} chars)`);
  const { json: refineRes } = await req("/api/ai/refine", { method: "POST", body: JSON.stringify({ text, format, projectId, chapterId }) });
  save(subdir, `${label}-refine.json`, refineRes);
  console.log("refine:", refineRes.text?.length ?? 0, "chars", refineRes.error ? `ERROR: ${refineRes.error}` : "");
  return refineRes;
}

async function redoHorizonLineNovel() {
  console.log("\n=== REDO: the-horizon-line-Novel (chapter1 op_protagonist cascade) ===");
  const { projectId, chapterIds } = SUMMARY["the-horizon-line-novel"];
  const format = "Novel";
  const premise = {
    intro: `Dr. Elena Marsh discovers that Horizon Station's official founding date is a fabrication -- the structure beneath the ice predates any human expedition by centuries, and The Warden has known the whole time.`,
    villainScene: "The Warden confronts Elena in the station's lower levels after she accesses files she was never meant to see.",
  };
  const outlineText = readSavedText("novel", "the-horizon-line-Novel-outline.json");

  let priorContent = "";
  let chapter1Content = "";
  for (let i = 0; i < 3; i++) {
    const chapterId = chapterIds[i];
    const prompt = i === 0
      ? `Premise: ${premise.intro}\n\nOutline so far:\n${outlineText}\n\nWrite chapter 1.`
      : `Continue the story. Previous chapter ended:\n${priorContent.slice(-1500)}\n\nWrite chapter ${i + 1}, advancing the plot.`;
    const { json: writeRes } = await req("/api/ai/generate", { method: "POST", body: JSON.stringify({ mode: "write", prompt, context: "", format, projectId, chapterId, bypassViolationCheck: true }) });
    save("novel", `the-horizon-line-Novel-chapter${i + 1}.json`, writeRes);
    priorContent = writeRes.text ?? "";
    if (i === 0) chapter1Content = priorContent;
    console.log(`chapter ${i + 1}:`, priorContent.length, "chars", writeRes.requiresConfirmation ? "STILL FLAGGED" : "");
    await req(`/api/projects/${projectId}/chapters/${chapterId}`, { method: "PATCH", body: JSON.stringify({ content: priorContent }) });
  }

  const { json: villainRes } = await req(`/api/projects/${projectId}/villain-pov`, {
    method: "POST",
    body: JSON.stringify({ characterId: "a8b5cff7-4c2d-443b-8d3d-f0884125e9e0", sceneDescription: premise.villainScene }),
  });
  save("novel", "the-horizon-line-Novel-villain-pov.json", villainRes);
  console.log("villain-pov:", villainRes.text?.length ?? 0, "chars");

  const { json: tensionRes } = await req(`/api/projects/${projectId}/tension-curve`, { method: "POST" });
  save("novel", "the-horizon-line-Novel-tension-curve.json", tensionRes);
  console.log("tension-curve:", tensionRes.scores ? `${tensionRes.scores.length} chapters scored` : JSON.stringify(tensionRes).slice(0, 150));

  const { json: refineRes } = await req("/api/ai/refine", { method: "POST", body: JSON.stringify({ text: chapter1Content, format, projectId, chapterId: chapterIds[0] }) });
  save("novel", "the-horizon-line-Novel-refine.json", refineRes);
  console.log("refine:", refineRes.text?.length ?? 0, "chars");
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

  await retryRefine("novel", "the-dealer-Novel", SUMMARY["the-dealer-novel"].projectId, SUMMARY["the-dealer-novel"].chapterIds[0], "the-dealer-Novel-chapter1.json", "Novel");
  await retryRefine("screenplay", "the-dealer-Screenplay", SUMMARY["the-dealer-screenplay"].projectId, SUMMARY["the-dealer-screenplay"].chapterIds[0], "the-dealer-Screenplay-chapter1.json", "Screenplay");
  await retryRefine("screenplay", "the-horizon-line-Screenplay", SUMMARY["the-horizon-line-screenplay"].projectId, SUMMARY["the-horizon-line-screenplay"].chapterIds[0], "the-horizon-line-Screenplay-chapter1.json", "Screenplay");

  await redoHorizonLineNovel();

  console.log("\nAll fixes applied and saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

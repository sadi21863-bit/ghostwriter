/**
 * Output Test 2, Phase 2: real-money Segmind video test against the corrected
 * Dealer premise (item 62's redo). Creates a small dedicated project with the
 * real card-throwing combat scene as its one chapter, runs the real
 * generate-package Director tool to auto-break it into shots, then generates
 * real Segmind (seedance-2.0) videos for each shot at trailer-length duration
 * (10s, per the user's explicit "shots should sit into the trailer category"
 * request), tracking real spend against a $16.56 confirmed budget.
 *
 * Usage: node scripts/output-test-2-segmind-dealer-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const SEGMIND_KEY = env.SEGMIND_API_KEY;
if (!SEGMIND_KEY) throw new Error("SEGMIND_API_KEY not found in .env.local");

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "dealer-redo", "segmind-test");
mkdirSync(OUT_DIR, { recursive: true });

// Real combat text from the Dealer redo mode-sweep (item 62), verified premise-faithful.
const COMBAT_SCENE_TEXT = readFileSync(
  join(process.cwd(), "outputtestresults", "output-test-2", "dealer-redo", "mode-sweep", "the-dealer-redo-combat.json"),
  "utf8"
);
const combatText = JSON.parse(COMBAT_SCENE_TEXT).text;

const DURATION_SEC = 10; // trailer pacing, per explicit user request
const RESOLUTION = "720p"; // Segmind's own default; ~$0.1512/s real confirmed rate
const RATE_PER_SEC = 0.1512;
const MAX_SHOTS = 6; // budget guard: 6 * 10s * $0.1512/s = $9.07, leaves buffer in the $16.56 balance

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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollShot(projectId, shotId, label, maxWaitMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { json } = await req(`/api/projects/${projectId}/production/shots/${shotId}/generate-video/status`);
    if (json.status === "final_ready") return { ok: true, videoUrl: json.videoUrl };
    if (json.status === "error") return { ok: false, error: "generation_error" };
    console.log(`  [${label}] status=${json.status ?? JSON.stringify(json).slice(0, 100)} (${Math.round((Date.now() - start) / 1000)}s)`);
    await sleep(8000);
  }
  return { ok: false, error: "timeout" };
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

  // Ensure the test account's Segmind key is set (idempotent).
  const settingsRes = await req("/api/user/settings", { method: "PATCH", body: JSON.stringify({ segmindApiKey: SEGMIND_KEY }) });
  console.log("segmind key set:", settingsRes.status);

  // Fresh, dedicated project — one chapter, so generate-package produces a tight,
  // directly-relevant shot list instead of sweeping all 6 Dealer-redo chapters.
  const { json: project } = await req("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "The Dealer — Segmind Trailer Test", format: "Novel", genres: ["Action", "Thriller"] }),
  });
  console.log("project:", project.id);

  await req(`/api/projects/${project.id}/characters`, {
    method: "POST",
    body: JSON.stringify({
      name: "The Dealer",
      role: "protagonist",
      appearance: "Lean, controlled build; black suit, no tie; a deck of kinetically-charged playing cards always in hand.",
      personality: "silent, controlled, methodical, haunted by the Trigger Phantom",
    }),
  });
  await req(`/api/projects/${project.id}/locations`, {
    method: "POST",
    body: JSON.stringify({ name: "The Tower Corridor", description: "A narrow service corridor on the 39th floor leading to a private penthouse elevator — a deliberate kill box, fire door at one end, brass elevator surround at the other." }),
  });

  const { json: chapter } = await req(`/api/projects/${project.id}/chapters`, { method: "POST", body: JSON.stringify({ title: "The Corridor" }) });
  await req(`/api/projects/${project.id}/chapters/${chapter.id}`, { method: "PATCH", body: JSON.stringify({ content: combatText }) });
  console.log("chapter saved:", combatText.length, "chars");

  console.log("\nRunning generate-package (real Director/Claude call, breaks the scene into shots)...");
  const { json: pkg } = await req(`/api/projects/${project.id}/production/generate-package`, { method: "POST" });
  save("generate-package-result.json", pkg);
  console.log("shots created:", pkg.shotCount, "| brief:", pkg.brief?.logline);

  const { json: shotsRes } = await req(`/api/projects/${project.id}/production/shots`);
  const shots = (shotsRes.shots ?? []).slice(0, MAX_SHOTS);
  save("shots-list.json", shots);
  console.log(`\nGenerating real Segmind video for ${shots.length} shots (duration=${DURATION_SEC}s, resolution=${RESOLUTION})...`);
  console.log(`Estimated cost: ${shots.length} x ${DURATION_SEC}s x $${RATE_PER_SEC}/s = $${(shots.length * DURATION_SEC * RATE_PER_SEC).toFixed(2)}`);

  const results = [];
  for (const shot of shots) {
    const label = `scene${shot.sceneNumber}-shot${shot.shotNumber}`;
    console.log(`\n--- ${label} ---`);
    console.log(`  prompt: ${(shot.videoPrompt || shot.soulPrompt || "").slice(0, 140)}...`);
    const { json: genRes, status: genStatus } = await req(`/api/projects/${project.id}/production/shots/${shot.id}/generate-video`, {
      method: "POST",
      body: JSON.stringify({ model: "seedance", duration: DURATION_SEC, resolution: RESOLUTION }),
    });
    if (genStatus !== 200) {
      console.log(`  FAILED to submit: ${genStatus}`, JSON.stringify(genRes).slice(0, 300));
      results.push({ label, shotId: shot.id, ok: false, error: `submit_${genStatus}` });
      continue;
    }
    if (genRes.status === "final_ready") {
      console.log(`  done synchronously: ${genRes.videoUrl}`);
      results.push({ label, shotId: shot.id, ok: true, videoUrl: genRes.videoUrl });
      continue;
    }
    const polled = await pollShot(project.id, shot.id, label);
    if (polled.ok) console.log(`  done: ${polled.videoUrl}`);
    else console.log(`  FAILED: ${polled.error}`);
    results.push({ label, shotId: shot.id, ...polled });
  }

  save("generation-results.json", results);
  writeFileSync(join(OUT_DIR, "project-info.json"), JSON.stringify({ projectId: project.id, chapterId: chapter.id }, null, 2), "utf8");

  const succeeded = results.filter(r => r.ok);
  const actualDurationSec = succeeded.length * DURATION_SEC;
  const actualCost = actualDurationSec * RATE_PER_SEC;
  console.log(`\n${succeeded.length}/${results.length} shots succeeded.`);
  console.log(`Real cost estimate: ${actualDurationSec}s total x $${RATE_PER_SEC}/s = $${actualCost.toFixed(2)}`);
  console.log("Video URLs:");
  for (const r of succeeded) console.log(`  ${r.label}: ${r.videoUrl}`);
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

/**
 * Restage (not reword) the 4 shots Segmind rejected
 * (OutputVideoSensitiveContentDetected.PolicyViolation). Per explicit user
 * direction: replace the guns/gunfire with a blunt weapon (a steel pipe) that
 * the Dealer destroys by repeatedly striking it with Hard Deck cards, and use
 * wide Soft Deck (paper) card sweeps to knock enforcers down — nobody is shot,
 * wounded, or killed in any of the 4. This is a real content change to what's
 * depicted, not a wording tweak on the same violence. Confirmed via real
 * balance change (2 successful requests billed, 4 rejected ones free) that a
 * repeat rejection costs nothing, so this is a low-risk retry either way.
 *
 * Usage: node scripts/output-test-2-segmind-retry-softened.mjs
 */
import { readFileSync, writeFileSync } from "fs";
const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/segmind-test";

const SOFTENED = {
  "ea5742a0-e7ec-4eb3-bb84-a9b8128e1fea": // scene1-shot1
    "Low-angle camera pushes in fast as the Dealer bursts through the fire door low to the ground, suit fabric snapping with the motion, eyes flicking rapidly across the corridor in under a second, cards already fanned in hand; ahead, an enforcer raises a heavy steel pipe overhead, others fan out behind him; fluorescent lights flicker overhead casting strobing shadows; camera settles into a tight push as the Dealer's weight drops into his calves.",
  "6d2bc727-cd36-4bb8-8127-dc6e12b2ccdc": // scene1-shot2
    "Whip pan follows a wide sheet of paper cards exploding off the Dealer's snapped wrist, rippling outward with a hard laminar sheen; the fan slaps across the nearest enforcer's chest and legs like a solid wall, the impact sweeping his feet out from under him — he crashes backward onto the concrete, stunned and disarmed, as the cards flutter harmlessly to the floor around him.",
  "4348201b-3a4e-4071-99ac-c7a13f0aab49": // scene1-shot3
    "Handheld camera shakes as the pipe-wielding enforcer's swing grazes the Dealer's shoulder, spinning him half a step; camera steadies low as he pivots and snaps a rapid volley of Hard Deck cards directly at the raised pipe, each one striking with a sharp metallic ring in quick succession, sparks skittering off the steel; on the fourth strike the pipe bends visibly and clatters from the enforcer's numbed grip, spinning away across the floor.",
  "2341aabf-07bf-4710-afb0-bcc50c59fd74": // scene2-shot4
    "Camera orbits low and fast around the Dealer as the remaining enforcers close in with fists and batons; a wide fan of cards spins into a sweeping ring around him, each pass batting an attacker's legs or arms aside; one man goes down clutching a numbed hand, another stumbles back holding his ribs, both stunned rather than struck by any blade; the orbit never fully breaking as the Dealer holds the center.",
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
  const res = await fetch(BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(cookies ? { Cookie: cookies } : {}), ...(opts.headers || {}) } });
  captureCookies(res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 500); }
  return { status: res.status, json };
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollShot(projectId, shotId, label, maxWaitMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { json } = await req(`/api/projects/${projectId}/production/shots/${shotId}/generate-video/status`);
    if (json.status === "final_ready") return { ok: true, videoUrl: json.videoUrl };
    if (json.status === "error") return { ok: false, error: json.error || "generation_error" };
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
  console.log("sign-in:", signIn.status);

  const projectInfo = JSON.parse(readFileSync(`${OUT_DIR}/project-info.json`, "utf8"));
  const projectId = projectInfo.projectId;

  const results = [];
  for (const [shotId, softenedPrompt] of Object.entries(SOFTENED)) {
    console.log(`\n--- shot ${shotId} ---`);
    const patchRes = await req(`/api/projects/${projectId}/production/shots/${shotId}`, {
      method: "PATCH",
      body: JSON.stringify({ videoPrompt: softenedPrompt }),
    });
    console.log("  prompt updated:", patchRes.status);

    const { json: genRes, status: genStatus } = await req(`/api/projects/${projectId}/production/shots/${shotId}/generate-video`, {
      method: "POST",
      body: JSON.stringify({ model: "seedance", duration: 10, resolution: "720p" }),
    });
    if (genStatus !== 200) {
      console.log(`  FAILED to submit: ${genStatus}`, JSON.stringify(genRes).slice(0, 300));
      results.push({ shotId, ok: false, error: `submit_${genStatus}` });
      continue;
    }
    if (genRes.status === "final_ready") {
      console.log(`  done synchronously: ${genRes.videoUrl}`);
      results.push({ shotId, ok: true, videoUrl: genRes.videoUrl });
      continue;
    }
    const polled = await pollShot(projectId, shotId, shotId);
    if (polled.ok) console.log(`  done: ${polled.videoUrl}`);
    else console.log(`  FAILED: ${polled.error}`);
    results.push({ shotId, ...polled });
  }

  writeFileSync(`${OUT_DIR}/retry-softened-results.json`, JSON.stringify(results, null, 2), "utf8");
  const succeeded = results.filter(r => r.ok);
  console.log(`\n${succeeded.length}/${results.length} softened retries succeeded.`);
  for (const r of results) console.log(`  ${r.shotId}: ${r.ok ? r.videoUrl : "FAILED - " + r.error}`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

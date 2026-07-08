/**
 * Retry the 4 shots that failed on Seedance 2.0 (twice, even after a real
 * content restage) using Kling instead — a different vendor (Kuaishou, not
 * ByteDance), not caught in the same active copyright dispute driving
 * Seedance's output filter instability, and tagged "bestFor": ["action",
 * "combat"] in this app's own model registry. std mode, confirmed real
 * pricing $0.056/s ($0.56 for 10s) via Segmind's own pricing page.
 * Reuses the already-restaged (blunt weapon, non-lethal) videoPrompt text
 * already saved on these shots from the previous retry.
 *
 * Usage: node scripts/output-test-2-segmind-retry-kling.mjs
 */
import { readFileSync, writeFileSync } from "fs";
const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/segmind-test";
const SHOT_IDS = [
  "ea5742a0-e7ec-4eb3-bb84-a9b8128e1fea",
  "6d2bc727-cd36-4bb8-8127-dc6e12b2ccdc",
  "4348201b-3a4e-4071-99ac-c7a13f0aab49",
  "2341aabf-07bf-4710-afb0-bcc50c59fd74",
];

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
  for (const shotId of SHOT_IDS) {
    console.log(`\n--- shot ${shotId} (kling) ---`);
    const { json: genRes, status: genStatus } = await req(`/api/projects/${projectId}/production/shots/${shotId}/generate-video`, {
      method: "POST",
      body: JSON.stringify({ model: "kling", duration: 10 }),
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

  writeFileSync(`${OUT_DIR}/retry-kling-results.json`, JSON.stringify(results, null, 2), "utf8");
  const succeeded = results.filter(r => r.ok);
  console.log(`\n${succeeded.length}/${results.length} Kling retries succeeded.`);
  for (const r of results) console.log(`  ${r.shotId}: ${r.ok ? r.videoUrl : "FAILED - " + r.error}`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

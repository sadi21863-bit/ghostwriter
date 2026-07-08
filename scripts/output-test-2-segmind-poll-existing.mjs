// Poll the 6 real jobs that were already submitted to Segmind (confirmed via
// higgsfieldJobId in the DB) but never reported success to the client, because
// the qstash scheduling crash (now fixed) threw AFTER the DB was updated.
import { readFileSync, writeFileSync } from "fs";
const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = "outputtestresults/output-test-2/dealer-redo/segmind-test";
const shots = JSON.parse(readFileSync(`${OUT_DIR}/shots-list.json`, "utf8"));
const projectId = shots[0].projectId;

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

async function pollShot(shotId, label, maxWaitMs = 300_000) {
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
  console.log("sign-in:", signIn.status);

  const { json: shotsRes } = await req(`/api/projects/${projectId}/production/shots`);
  const results = [];
  for (const shot of shotsRes.shots ?? []) {
    const label = `scene${shot.sceneNumber}-shot${shot.shotNumber}`;
    if (shot.generationStatus === "final_ready") {
      console.log(`${label}: already done -> ${shot.finalVideoUrl}`);
      results.push({ label, shotId: shot.id, ok: true, videoUrl: shot.finalVideoUrl });
      continue;
    }
    console.log(`\n--- polling ${label} ---`);
    const polled = await pollShot(shot.id, label);
    if (polled.ok) console.log(`  done: ${polled.videoUrl}`);
    else console.log(`  FAILED: ${polled.error}`);
    results.push({ label, shotId: shot.id, ...polled });
  }

  writeFileSync(`${OUT_DIR}/generation-results.json`, JSON.stringify(results, null, 2), "utf8");
  const succeeded = results.filter(r => r.ok);
  console.log(`\n${succeeded.length}/${results.length} shots succeeded.`);
  for (const r of succeeded) console.log(`  ${r.label}: ${r.videoUrl}`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

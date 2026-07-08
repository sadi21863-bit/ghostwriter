// Check real DB/job status for shots before deciding whether to resubmit
// (avoids double-spending if the original submit actually reached Segmind
// before the qstash scheduling crash).
import { readFileSync } from "fs";
const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const shots = JSON.parse(readFileSync("outputtestresults/output-test-2/dealer-redo/segmind-test/shots-list.json", "utf8"));
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

const { json: csrf } = await req("/api/auth/csrf");
const signIn = await fetch(BASE + "/api/auth/callback/credentials", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: PASSWORD, redirect: "false", callbackUrl: "/dashboard", json: "true" }),
  redirect: "manual",
});
captureCookies(signIn);
console.log("sign-in:", signIn.status);

const { json: shotsRes } = await req(`/api/projects/${projectId}/production/shots`);
for (const s of shotsRes.shots ?? []) {
  console.log(`${s.sceneNumber}.${s.shotNumber} | id=${s.id} | status=${s.generationStatus} | jobId=${s.higgsfieldJobId || "(none)"} | finalUrl=${s.finalVideoUrl || "(none)"}`);
}

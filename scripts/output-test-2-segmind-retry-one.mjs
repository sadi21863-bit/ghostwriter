// Temp diagnostic: retry a single shot's generate-video call to surface the real error.
import { readFileSync } from "fs";
const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const shots = JSON.parse(readFileSync("outputtestresults/output-test-2/dealer-redo/segmind-test/shots-list.json", "utf8"));
const shot = shots[0];
const projectId = shot.projectId;

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
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 2000); }
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

const result = await req(`/api/projects/${projectId}/production/shots/${shot.id}/generate-video`, {
  method: "POST",
  body: JSON.stringify({ model: "seedance", duration: 10, resolution: "720p" }),
});
console.log("status:", result.status);
console.log("body:", JSON.stringify(result.json, null, 2));

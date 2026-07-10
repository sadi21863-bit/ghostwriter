/**
 * Real-money comparison, Task 6 of the AI-slop-fix plan: calls the REAL,
 * just-shipped multi-shot route on Horizon Line's real Scene 1 (3 shots,
 * from the actual generate-package Director output verified in item 69).
 * Segmind budget only (Seedance).
 *
 * Usage: node scripts/test-multishot-vs-pershot-horizon.mjs
 */
import { fetch as undiciFetch, Agent } from "undici";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const PROJECT_ID = "4a365d59-e102-4b13-aeea-f570b8758a06";
const SCENE_NUMBER = 1;

const longRunningDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

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
  const res = await undiciFetch(BASE + path, {
    ...opts,
    dispatcher: longRunningDispatcher,
    headers: { "Content-Type": "application/json", ...(cookies ? { Cookie: cookies } : {}), ...(opts.headers || {}) },
  });
  captureCookies(res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 1000); }
  return { status: res.status, json };
}

async function main() {
  const { json: csrf } = await req("/api/auth/csrf");
  const signIn = await undiciFetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    dispatcher: longRunningDispatcher,
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookies ? { Cookie: cookies } : {}) },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, password: PASSWORD, redirect: "false", callbackUrl: "/dashboard", json: "true" }),
    redirect: "manual",
  });
  captureCookies(signIn);
  console.log("sign-in status:", signIn.status);

  console.log("Calling the REAL multi-shot route on Horizon Line Scene 1 (3 real shots)...");
  const start = Date.now();
  const { status, json } = await req(`/api/projects/${PROJECT_ID}/production/scenes/${SCENE_NUMBER}/generate-video?multiShot=1`, { method: "POST" });
  console.log(`status: ${status} (${Math.round((Date.now() - start) / 1000)}s)`);
  console.log(JSON.stringify(json, null, 2));
}
main().catch(e => { console.error("FAILED:", e); process.exit(1); });

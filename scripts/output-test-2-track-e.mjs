/**
 * Output Test 2, Track E: web-research grounding + cache-hit validation
 * (item 56 piece 4). One scitech-mode call on The Horizon Line with
 * groundInResearch: true, run twice back-to-back -- confirms the real
 * web_search call fires on the first call, and the semantic cache is hit
 * (skips the model entirely) on the second, near-identical call.
 *
 * Usage: node scripts/output-test-2-track-e.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "web-research");
mkdirSync(OUT_DIR, { recursive: true });

const HORIZON_PROJECT_ID = "4bbfd6fe-bc07-4394-a4db-9bd5c8da39e3";
const STATIC_CONTEXT = [
  "CHARACTERS:",
  "- Dr. Elena Marsh (protagonist): rational, increasingly unraveling, fiercely loyal to her research.",
  "- The Warden (antagonist): patient, inhuman logic wearing a human voice.",
  "",
  "LOCATIONS:",
  "- Horizon Station: An isolated arctic research outpost built over a structure that predates any human expedition.",
].join("\n");

const PROMPT = "Write a short scene where Elena explains to a colleague, in concrete scientific terms, what makes the anomaly beneath the station theoretically possible -- grounded in real physics, not technobabble.";

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

  const t0 = Date.now();
  const { json: firstRes } = await req("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({
      mode: "scitech", prompt: PROMPT, context: "",
      staticContext: STATIC_CONTEXT, dynamicContext: "",
      format: "Novel", projectId: HORIZON_PROJECT_ID,
      groundInResearch: true,
    }),
  });
  const t1 = Date.now();
  save("call-1-first.json", firstRes);
  console.log("call 1 (should hit real web_search):", firstRes.text?.length ?? 0, "chars,", (t1 - t0), "ms");

  const t2 = Date.now();
  const { json: secondRes } = await req("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({
      mode: "scitech", prompt: PROMPT, context: "",
      staticContext: STATIC_CONTEXT, dynamicContext: "",
      format: "Novel", projectId: HORIZON_PROJECT_ID,
      groundInResearch: true,
    }),
  });
  const t3 = Date.now();
  save("call-2-repeat.json", secondRes);
  console.log("call 2 (same prompt, should hit semantic cache for research):", secondRes.text?.length ?? 0, "chars,", (t3 - t2), "ms");

  save("SUMMARY.json", {
    call1DurationMs: t1 - t0, call2DurationMs: t3 - t2,
    call1Chars: firstRes.text?.length ?? 0, call2Chars: secondRes.text?.length ?? 0,
    note: "A meaningfully faster call 2 is consistent with a semantic-cache hit on the web-research step, but total request duration also includes the full generation call, so this is suggestive, not conclusive proof by itself.",
  });
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

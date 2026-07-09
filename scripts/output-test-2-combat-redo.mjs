/**
 * Track C (combat fight-scene + refine-grounding comparison) redo — the
 * original run used the invented Mara Voss/Kessler premise; this reuses the
 * corrected Dealer project (project-info.json) but with two NEW named
 * enforcer characters (since The Dealer's own signature is card-throwing,
 * not hand-to-hand), fighting with real registry combat styles (Boxing vs
 * Krav Maga, same pairing as the original test for continuity), set inside
 * Roland Colt's organization.
 *
 * Usage: node scripts/output-test-2-combat-redo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "combat-redo");
mkdirSync(OUT_DIR, { recursive: true });

const DEALER_PROJECT = JSON.parse(readFileSync(join(process.cwd(), "outputtestresults", "output-test-2", "dealer-redo", "project-info.json"), "utf8"));

const FIGHTER_A = { name: "Hollis", role: "supporting", personality: "disciplined, methodical, Roland Colt's senior enforcer", desires: "prove himself the last loyal man standing as the Colt Clan's outer circle collapses" };
const FIGHTER_B = { name: "Draza", role: "supporting", personality: "brutal, efficient, a rival enforcer sent to replace Hollis", desires: "take Hollis's position by any means, including eliminating him" };

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
async function generateWithConfirm(body) {
  const first = await req("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
  if (first.json?.requiresConfirmation) {
    console.log(`  [violation gate fired: ${first.json.violationType} — confirming through]`);
    return req("/api/ai/generate", { method: "POST", body: JSON.stringify({ ...body, bypassViolationCheck: true }) });
  }
  return first;
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

  const projectId = DEALER_PROJECT.projectId;
  const { json: fighterA } = await req(`/api/projects/${projectId}/characters`, { method: "POST", body: JSON.stringify(FIGHTER_A) });
  const { json: fighterB } = await req(`/api/projects/${projectId}/characters`, { method: "POST", body: JSON.stringify(FIGHTER_B) });
  console.log("Hollis:", fighterA.id, "Draza:", fighterB.id);

  const STATIC_CONTEXT = [
    "CHARACTERS:",
    `- Hollis (${FIGHTER_A.personality}). Wants: ${FIGHTER_A.desires}. Fighting style: Boxing.`,
    `- Draza (${FIGHTER_B.personality}). Wants: ${FIGHTER_B.desires}. Fighting style: Krav Maga.`,
    "",
    "LOCATIONS:",
    "- The Foundry: an abandoned Detroit auto factory the Colt Clan's muscle uses as a meeting ground.",
  ].join("\n");

  console.log("\n--- combat mode: Hollis (Boxing) vs Draza (Krav Maga) ---");
  const { json: combatRes } = await generateWithConfirm({
    mode: "combat",
    prompt: "Hollis and Draza settle their rivalry over who leads Roland Colt's remaining enforcers with a real fight in the Foundry's loading bay — no weapons, just the two of them.",
    context: "", staticContext: STATIC_CONTEXT, dynamicContext: "",
    format: "Novel", projectId, combatStyleA: "Boxing", combatStyleB: "Krav Maga",
  });
  writeFileSync(join(OUT_DIR, "combat-scene.json"), JSON.stringify(combatRes, null, 2), "utf8");
  console.log("combat scene:", combatRes.text?.length ?? 0, "chars");

  console.log("\n--- refine: bare (no mode/styles) ---");
  const { json: bareRefine } = await req("/api/ai/refine", {
    method: "POST", body: JSON.stringify({ text: combatRes.text, format: "Novel", projectId }),
  });
  writeFileSync(join(OUT_DIR, "refine-bare.json"), JSON.stringify(bareRefine, null, 2), "utf8");
  console.log("bare refine:", bareRefine.text?.length ?? 0, "chars");

  console.log("\n--- refine: grounded (mode=combat + styles) ---");
  const { json: groundedRefine } = await req("/api/ai/refine", {
    method: "POST", body: JSON.stringify({ text: combatRes.text, format: "Novel", projectId, mode: "combat", combatStyleA: "Boxing", combatStyleB: "Krav Maga" }),
  });
  writeFileSync(join(OUT_DIR, "refine-grounded.json"), JSON.stringify(groundedRefine, null, 2), "utf8");
  console.log("grounded refine:", groundedRefine.text?.length ?? 0, "chars");

  writeFileSync(join(OUT_DIR, "project-info.json"), JSON.stringify({ projectId, fighterAId: fighterA.id, fighterBId: fighterB.id }, null, 2), "utf8");
  console.log("\nDone. All output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

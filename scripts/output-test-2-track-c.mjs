/**
 * Output Test 2, Track C: combat mode fight-scene script + the new
 * refine-with-technique-context comparison + a free suggestComposition()
 * cross-check. Reuses Track A/B's real "The Dealer" project (Mara Voss vs
 * Kessler, Kessler has a real Krav Maga skill). Matchup: Mara (Boxing) vs
 * Kessler (Krav Maga), per the plan's own example pairing.
 *
 * The combat biomechanics text below is the REAL output of
 * buildCombatContext("Boxing", "Krav Maga") (src/lib/combat/context.ts),
 * captured via a one-shot vitest dump against the live module rather than
 * hand-transcribed, so this is byte-faithful to what the real Writer-side
 * Combat mode UI (generateCombat() in useGeneration.ts) actually sends.
 *
 * Usage: node scripts/output-test-2-track-c.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "combat-fight-scene");
mkdirSync(OUT_DIR, { recursive: true });

const PROJECT_ID = "c109dd81-13c4-4f0b-98d3-cebc7a6afad0"; // The Dealer, reused from Track A/B
const STATIC_CONTEXT = [
  "CHARACTERS:",
  "- Mara Voss (protagonist): guarded, methodical, haunted by her father's legacy. Wants: escape the family business without getting anyone killed.",
  "- Kessler (antagonist): calculating, controlled, dangerous. Wants: consolidate control over the regional arms trade.",
  "",
  "LOCATIONS:",
  "- The Armory: A decommissioned grain silo converted into a weapons cache on the edge of town, corrugated steel and sodium light.",
].join("\n");

const COMBAT_CONTEXT = readFileSync(join(OUT_DIR, "..", "combat-context-boxing-vs-kravmaga.txt"), "utf8");

const SCENE_PROMPT = `Premise: Mara Voss has come to the Armory at night to confront Kessler about a shipment her father's ledger never accounted for. Kessler, calm and controlled, makes clear he intends to keep consolidating power now that her father is gone. The conversation turns physical -- Mara defends herself with Boxing, Kessler answers with Krav Maga. Write a single coherent fight scene (not a montage), sized for a short video clip -- one continuous exchange in the Armory, not a sprawling multi-location chase.`;

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

  // 1. Generate the fight scene via Combat mode, real biomechanics context
  //    prepended to dynamicContext exactly as generateCombat() does client-side.
  const dynamicContext = COMBAT_CONTEXT;
  const { json: sceneRes } = await req("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({
      mode: "combat", prompt: SCENE_PROMPT, context: "",
      staticContext: STATIC_CONTEXT, dynamicContext,
      format: "Novel", projectId: PROJECT_ID,
    }),
  });
  save("fight-scene.json", sceneRes);
  console.log("fight scene:", sceneRes.text?.length ?? 0, "chars", sceneRes.requiresConfirmation ? "REQUIRES CONFIRMATION" : "");
  const sceneText = sceneRes.text ?? "";

  if (!sceneText) {
    console.error("Fight scene generation failed, aborting refine comparison.");
    return;
  }

  // 2. Refine WITHOUT technique context (bare, matches pre-item-56 behavior).
  const { json: refineBare } = await req("/api/ai/refine", {
    method: "POST",
    body: JSON.stringify({ text: sceneText, format: "Novel", projectId: PROJECT_ID }),
  });
  save("refine-bare.json", refineBare);
  console.log("refine (bare):", refineBare.text?.length ?? 0, "chars");

  // 3. Refine WITH technique context (item 56 piece 1 -- the actual validation).
  const { json: refineGrounded } = await req("/api/ai/refine", {
    method: "POST",
    body: JSON.stringify({
      text: sceneText, format: "Novel", projectId: PROJECT_ID,
      mode: "combat", combatStyleA: "Boxing", combatStyleB: "Krav Maga",
    }),
  });
  save("refine-grounded.json", refineGrounded);
  console.log("refine (grounded):", refineGrounded.text?.length ?? 0, "chars");

  // 4. Compare technique-term retention between the two refine passes.
  const TECHNIQUE_TERMS = [
    "jab", "cross", "hook", "uppercut", "orthodox", "southpaw", "philly shell",
    "no-freeze guard", "exit ready", "direct counter", "retzev", "cover and move",
  ];
  const countTerms = (text) => {
    const lower = (text || "").toLowerCase();
    return TECHNIQUE_TERMS.filter((t) => lower.includes(t));
  };
  const original = countTerms(sceneText);
  const bare = countTerms(refineBare.text);
  const grounded = countTerms(refineGrounded.text);
  console.log("\nTechnique-term retention:");
  console.log("  original scene:", original.length, original);
  console.log("  refine (bare):", bare.length, bare);
  console.log("  refine (grounded):", grounded.length, grounded);

  save("SUMMARY.json", {
    sceneChars: sceneText.length,
    refineBareChars: refineBare.text?.length ?? 0,
    refineGroundedChars: refineGrounded.text?.length ?? 0,
    techniqueTerms: { original, bare, grounded },
  });

  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

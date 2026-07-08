/**
 * Output Test 2, Track D: Series Bible / Universe citation re-test.
 * The 06-24 test confirmed the injection mechanism is wired but a real
 * generation didn't literally cite the planted lore detail, and this was
 * never chased further. This asks a direct question against a real Series
 * Bible + Universe to close that open item conclusively.
 *
 * Usage: node scripts/output-test-2-track-d.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "series-universe");
mkdirSync(OUT_DIR, { recursive: true });

const DEALER_PROJECT_ID = "c109dd81-13c4-4f0b-98d3-cebc7a6afad0";
const HORIZON_PROJECT_ID = "4bbfd6fe-bc07-4394-a4db-9bd5c8da39e3";

const DEALER_STATIC_CONTEXT = [
  "CHARACTERS:",
  "- Mara Voss (protagonist): guarded, methodical, haunted by her father's legacy.",
  "- Kessler (antagonist): calculating, controlled, dangerous.",
  "",
  "LOCATIONS:",
  "- The Armory: A decommissioned grain silo converted into a weapons cache.",
].join("\n");

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

  // 1. Series Bible for The Dealer, with a planted world rule.
  // NOTE: POST /api/series-bibles returns { bible: {...} } (wrapped), not the
  // bare object -- unlike POST /api/universes, which returns the bare object.
  const { json: bibleRes } = await req("/api/series-bibles", {
    method: "POST",
    body: JSON.stringify({ name: "The Voss Ledger Series", premise: "The Midwest Armaments saga.", projectIds: [DEALER_PROJECT_ID] }),
  });
  const bibleId = bibleRes.bible.id;
  console.log("series bible:", bibleId);
  const { status: patchStatus } = await req(`/api/series-bibles/${bibleId}`, {
    method: "PATCH",
    body: JSON.stringify({
      worldRules: ["Every arms shipment routed through the Voss network carries a hidden ledger code called the Long Count -- a serial cipher known only to Voss-family insiders, never spoken aloud, only written."],
      continuityNotes: "The Long Count is the single most closely-guarded secret in the Voss organization.",
    }),
  });
  console.log("series bible worldRules PATCH status:", patchStatus);
  save("series-bible.json", bibleRes);

  // 2. Universe linking The Dealer + The Horizon Line, with a planted shared rule + canon event.
  const { json: universe } = await req("/api/universes", {
    method: "POST",
    body: JSON.stringify({
      name: "The Quiet Ledger", premise: "Unconnected stories secretly touched by the same silent broker.",
      sharedRules: ["Every conflict in this universe is quietly financed on both sides by a broker known only as the Adjuster, who profits regardless of outcome and has never been seen by anyone who lived to describe them."],
    }),
  });
  console.log("universe:", universe.id);
  const { status: link1Status, json: link1 } = await req(`/api/universes/${universe.id}/projects`, { method: "POST", body: JSON.stringify({ projectId: DEALER_PROJECT_ID, timelineSort: 1 }) });
  const { status: link2Status } = await req(`/api/universes/${universe.id}/projects`, { method: "POST", body: JSON.stringify({ projectId: HORIZON_PROJECT_ID, timelineSort: 2 }) });
  console.log("link The Dealer status:", link1Status, "universeId now set:", link1?.universeId === universe.id);
  console.log("link Horizon Line status:", link2Status);
  const { json: event } = await req(`/api/universes/${universe.id}/events`, {
    method: "POST",
    body: JSON.stringify({ name: "The Adjuster's first known transaction", description: "A shell payment traced to both the Voss arms network and Horizon Station's founding grant -- never publicly connected.", timelineSort: 1, isCanon: true }),
  });
  save("universe.json", { universe, event });

  // 3. Citation test on The Dealer -- deliberately does NOT name "the Long Count"
  // or "the Adjuster" anywhere in the prompt. If either term appears in the
  // output, it can only have come from the injected Series Bible/Universe
  // context (buildSeriesBibleContext/buildSeriesUniverseContext), not an echo
  // of the prompt itself -- unlike the first attempt at this script, which
  // named "the Long Count" directly in the prompt, making any citation trivial
  // and uninformative.
  const prompt = `Write a short scene where Mara presses Emil for the one detail her father never let her see -- the actual mechanism his organization used to keep its most sensitive shipments untraceable, and whether anyone outside the family has ever profited from watching their business from a distance. Emil answers as honestly as he's willing to, using whatever specific names or terms are actually established for these things.`;
  const { json: sceneRes } = await req("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify({ mode: "write", prompt, context: "", staticContext: DEALER_STATIC_CONTEXT, dynamicContext: "", format: "Novel", projectId: DEALER_PROJECT_ID }),
  });
  save("citation-test-scene.json", sceneRes);
  const text = sceneRes.text ?? "";
  console.log("citation test scene:", text.length, "chars");

  const citedLongCount = /long count/i.test(text);
  const citedAdjuster = /adjuster/i.test(text);
  console.log("cited 'Long Count' (unprompted):", citedLongCount);
  console.log("cited 'Adjuster' (unprompted):", citedAdjuster);

  save("SUMMARY.json", { seriesBibleId: bibleId, patchStatus, universeId: universe.id, dealerLinked: link1?.universeId === universe.id, citedLongCount, citedAdjuster, sceneChars: text.length });
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

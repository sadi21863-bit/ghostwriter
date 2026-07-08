/**
 * Output Test 2: "The Dealer" redo, Track B equivalent (format+role rewrite)
 * against the REAL card-throwing premise. Reuses the Novel project created
 * by output-test-2-dealer-redo.mjs; creates a fresh Screenplay + short-form
 * project with the same corrected World Bible.
 *
 * Usage: node scripts/output-test-2-dealer-redo-track-b.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "dealer-redo");
mkdirSync(join(OUT_DIR, "novel"), { recursive: true });
mkdirSync(join(OUT_DIR, "screenplay"), { recursive: true });
mkdirSync(join(OUT_DIR, "short-form"), { recursive: true });

const PROJECT_INFO = JSON.parse(readFileSync(join(OUT_DIR, "project-info.json"), "utf8"));

const PROTAGONIST = { name: "The Dealer", role: "protagonist", personality: "silent, controlled, methodical, haunted by the Trigger Phantom", desires: "systematic vengeance against everyone responsible for his family's annihilation, following his own Dead Man's Hand structure" };
const ANTAGONIST = { name: "Roland Colt", role: "antagonist", personality: "controlled, self-preserving, politically ruthless", desires: "keep his role in the massacre buried and his remaining power intact" };
const LOCATION = { name: "The Foundry", description: "An abandoned Detroit auto factory, rusted assembly lines and broken skylights, the Colt Clan's old muscle still using it as a meeting ground." };

const STATIC_CONTEXT = [
  "CHARACTERS:",
  `- ${PROTAGONIST.name} (${PROTAGONIST.role}): ${PROTAGONIST.personality}. Wants: ${PROTAGONIST.desires}. Fights exclusively with kinetically-charged playing cards (Soft Deck: paper, for misdirection/slicing; Hard Deck: tungsten/titanium alloy, for piercing/shielding), a documented biomechanical system -- laminar zero-drag airflow, 15,000+ RPM gyroscopic spin, a grounding-whip-terminal-release kinetic chain via a Thurston Grip, 400+ m/s velocities. Named trick shots: the Ricochet Cascade, the Iron Shield, the Deck Flash, the Card Splitter, the Boomerang Loop.`,
  `- ${ANTAGONIST.name} (${ANTAGONIST.role}), card designation 'The King of Spades': ${ANTAGONIST.personality}. Wants: ${ANTAGONIST.desires}.`,
  "",
  "LOCATIONS:",
  `- ${LOCATION.name}: ${LOCATION.description}`,
].join("\n");

const INTRO = "The Dealer -- the last of the Colt Clan's annihilated branch family, unable to touch a firearm since the night his family died -- has spent years hunting down everyone responsible, marking each target with a card from a self-assigned Dead Man's Hand. Roland Colt, the King of Spades, the Patriarch who sold out the branch family and was betrayed in turn by the coalition he sold them to, is the last King left on the list.";

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
function save(subdir, name, data) {
  writeFileSync(join(OUT_DIR, subdir, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}
async function generateWithConfirm(body) {
  const first = await req("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
  if (first.json?.requiresConfirmation) {
    console.log(`  [violation gate fired: ${first.json.violationType} -- confirming through]`);
    return req("/api/ai/generate", { method: "POST", body: JSON.stringify({ ...body, bypassViolationCheck: true }) });
  }
  return first;
}

async function runFormat(format, projectId, antagonistId) {
  const label = `the-dealer-redo-${format}`;
  console.log(`\n=== ${label} ===`);

  const { json: outlineRes } = await generateWithConfirm({ mode: "outline", prompt: `Premise: ${INTRO}\n\nOutline the first act.`, context: "", staticContext: STATIC_CONTEXT, dynamicContext: "", format, projectId });
  save(format.toLowerCase(), `${label}-outline.json`, outlineRes);
  console.log("outline:", outlineRes.text?.length ?? 0, "chars");

  let priorContent = "";
  let chapter1Content = "";
  const chapterIds = [];
  for (let i = 1; i <= 3; i++) {
    const { json: chapter } = await req(`/api/projects/${projectId}/chapters`, { method: "POST", body: JSON.stringify({ title: `Chapter ${i}` }) });
    chapterIds.push(chapter.id);
    const prompt = i === 1
      ? `Premise: ${INTRO}\n\nOutline so far:\n${outlineRes.text}\n\nWrite chapter 1.`
      : `Continue the story. Previous chapter ended:\n${priorContent.slice(-1500)}\n\nWrite chapter ${i}, advancing the plot.`;
    const { json: writeRes } = await generateWithConfirm({ mode: "write", prompt, context: "", staticContext: STATIC_CONTEXT, dynamicContext: "", format, projectId, chapterId: chapter.id });
    save(format.toLowerCase(), `${label}-chapter${i}.json`, writeRes);
    priorContent = writeRes.text ?? "";
    if (i === 1) chapter1Content = priorContent;
    console.log(`chapter ${i}:`, priorContent.length, "chars");
    await req(`/api/projects/${projectId}/chapters/${chapter.id}`, { method: "PATCH", body: JSON.stringify({ content: priorContent }) });
  }

  const { json: villainRes } = await req(`/api/projects/${projectId}/villain-pov`, {
    method: "POST", body: JSON.stringify({ characterId: antagonistId, sceneDescription: "Roland Colt learns The Dealer has already reached his outer circle and realizes, for the first time, that he might actually be found." }),
  });
  save(format.toLowerCase(), `${label}-villain-pov.json`, villainRes);
  console.log("villain-pov:", villainRes.text?.length ?? 0, "chars");

  const { json: tensionRes } = await req(`/api/projects/${projectId}/tension-curve`, { method: "POST" });
  save(format.toLowerCase(), `${label}-tension-curve.json`, tensionRes);
  console.log("tension-curve:", tensionRes.scores ? `${tensionRes.scores.length} chapters scored` : JSON.stringify(tensionRes).slice(0, 150));

  const { json: refineRes } = await req("/api/ai/refine", { method: "POST", body: JSON.stringify({ text: chapter1Content, format, projectId, chapterId: chapterIds[0] }) });
  save(format.toLowerCase(), `${label}-refine.json`, refineRes);
  console.log("refine:", refineRes.text?.length ?? 0, "chars");

  return { projectId, chapterIds };
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

  const summary = {};
  summary.novel = await runFormat("Novel", PROJECT_INFO.projectId, PROJECT_INFO.antagonistId);

  // Fresh Screenplay project with the same corrected World Bible.
  const { json: spProject } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: "The Dealer (corrected premise, Screenplay)", format: "Screenplay" }) });
  await req(`/api/projects/${spProject.id}/characters`, { method: "POST", body: JSON.stringify(PROTAGONIST) });
  const { json: spAntagonist } = await req(`/api/projects/${spProject.id}/characters`, { method: "POST", body: JSON.stringify(ANTAGONIST) });
  await req(`/api/projects/${spProject.id}/locations`, { method: "POST", body: JSON.stringify(LOCATION) });
  summary.screenplay = await runFormat("Screenplay", spProject.id, spAntagonist.id);

  // Short-form spot check.
  const { json: sfProject } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: "The Dealer (corrected premise, short-form)", format: "TikTok Script" }) });
  const { json: sfRes } = await generateWithConfirm({ mode: "write", prompt: `Premise: ${INTRO}\n\nOpen the story with a hook.`, context: "", staticContext: STATIC_CONTEXT, dynamicContext: "", format: "TikTok Script", projectId: sfProject.id });
  save("short-form", "the-dealer-redo-shortform.json", sfRes);
  console.log("\n=== short-form ===\nshort-form:", sfRes.text?.length ?? 0, "chars");
  summary.shortform = { projectId: sfProject.id };

  writeFileSync(join(OUT_DIR, "track-b-SUMMARY.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

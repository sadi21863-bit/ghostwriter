/**
 * Output Test 2: "The Horizon Line" redo, Track B equivalent (format+role
 * rewrite) against the real "Ride Never Ends" premise. Reuses the existing
 * Novel project from the mode-sweep redo; creates fresh Screenplay + short-
 * form projects with the same corrected World Bible.
 *
 * Usage: node scripts/output-test-2-horizon-redo-track-b.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "horizon-redo");
mkdirSync(join(OUT_DIR, "novel"), { recursive: true });
mkdirSync(join(OUT_DIR, "screenplay"), { recursive: true });
mkdirSync(join(OUT_DIR, "short-form"), { recursive: true });

const PROJECT_INFO = JSON.parse(readFileSync(join(OUT_DIR, "project-info.json"), "utf8"));

const PROTAGONIST = { name: "Arthur", role: "protagonist", personality: "quiet, grieving, retreats inward under pressure, methodical", desires: "wanted to disappear for a little while after his wife's death; now wants only to survive the track and reach the platform" };
const SECONDARY = { name: "Maya", role: "supporting", personality: "sharp, analytical, keeps herself sane by measuring and tracking their reality", desires: "to understand the ride's exact mechanics as a way of keeping hope calculable rather than desperate" };
const LOCATION = { name: "The Horizon Line", description: "A luxury ultra-long-distance observation coaster inside a concrete dome so massive it generates its own weather. Thirty velvet-upholstered cars carrying 300 passengers, no conductor, no emergency brakes, elevated sixty feet above an artificial landscape of painted skies that never change. A cheerful synthesized voice speaks through track speakers." };

const STATIC_CONTEXT = [
  "CHARACTERS:",
  `- ${PROTAGONIST.name} (${PROTAGONIST.role}): ${PROTAGONIST.personality}. Wants: ${PROTAGONIST.desires}. His wife died a year before boarding.`,
  `- ${SECONDARY.name} (${SECONDARY.role}): ${SECONDARY.personality}. Wants: ${SECONDARY.desires}. Rides in Car 14 alongside Arthur; keeps a tally scratched into the velvet wall.`,
  "",
  "LOCATIONS:",
  `- ${LOCATION.name}: ${LOCATION.description}`,
  "",
  "WORLD RULES:",
  "- 9mph around a 9,000-meter circuit inside the dome = exactly 4 years (1,460 days) per full loop, confirmed by track-length math.",
  "- Every midnight, a hatch dispenses nutrient-dense protein blocks and distilled water. The ride does not want passengers to die - only to stay.",
  "- Intercom: 'We hope you are enjoying your journey. Current guest satisfaction rating: Excellent.'",
  "- The twist: after 4 years, the exit corridor (lined with plastic skeleton props) does not lead outside - it loops directly back into the boarding queue for the same train. A sign reads THE RIDE NEVER ENDS. An automated wall seals the exit corridor the instant the truth is visible.",
].join("\n");

const INTRO = "Arthur boarded The Horizon Line a year after his wife died, wanting only to disappear for an afternoon. What he and 299 other passengers discover is that the ride takes exactly four years to complete a single circuit -- and that reaching the platform does not mean reaching the exit.";

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
  const label = `the-horizon-redo-${format}`;
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
    method: "POST", body: JSON.stringify({ characterId: antagonistId, sceneDescription: "The ride's cheerful synthesized voice-system - the closest thing this story has to an antagonist - registers the exit corridor's confusion and calmly reroutes the 300 passengers back toward the boarding queue, framing it as routine." }),
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
  summary.novel = await runFormat("Novel", PROJECT_INFO.projectId, PROJECT_INFO.secondaryId);

  // Fresh Screenplay project with the same corrected World Bible.
  const { json: spProject } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: "The Horizon Line (corrected premise, Screenplay)", format: "Screenplay" }) });
  await req(`/api/projects/${spProject.id}/characters`, { method: "POST", body: JSON.stringify(PROTAGONIST) });
  const { json: spSecondary } = await req(`/api/projects/${spProject.id}/characters`, { method: "POST", body: JSON.stringify(SECONDARY) });
  await req(`/api/projects/${spProject.id}/locations`, { method: "POST", body: JSON.stringify(LOCATION) });
  summary.screenplay = await runFormat("Screenplay", spProject.id, spSecondary.id);

  // Short-form spot check.
  const { json: sfProject } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: "The Horizon Line (corrected premise, short-form)", format: "TikTok Script" }) });
  const { json: sfRes } = await generateWithConfirm({ mode: "write", prompt: `Premise: ${INTRO}\n\nOpen the story with a hook.`, context: "", staticContext: STATIC_CONTEXT, dynamicContext: "", format: "TikTok Script", projectId: sfProject.id });
  save("short-form", "the-horizon-redo-shortform.json", sfRes);
  console.log("\n=== short-form ===\nshort-form:", sfRes.text?.length ?? 0, "chars");
  summary.shortform = { projectId: sfProject.id };

  writeFileSync(join(OUT_DIR, "track-b-SUMMARY.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

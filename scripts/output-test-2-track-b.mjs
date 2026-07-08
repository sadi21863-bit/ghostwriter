/**
 * Output Test 2, Track B: format + role rewrite through the real pipeline.
 * Novel track reuses Track A's exact projects/characters (including Kessler's
 * Krav Maga skill, to validate villain-pov's combat-style auto-inference
 * against real data). Screenplay track creates fresh same-premise projects
 * with BOTH a protagonist and antagonist character.
 *
 * v2 fix (first run's data was invalid for its stated purpose): every
 * /api/ai/generate call now carries a real staticContext string built from
 * the actual World Bible character/location rows, on every chapter -- not
 * just chapter 1. The first version of this script never passed staticContext
 * at all, so the model had zero knowledge that Kessler/Mara/etc. existed as
 * characters and invented its own cast instead. This is the exact "synthetic
 * weak-context harness" failure mode Track B was built to avoid.
 *
 * Usage: node scripts/output-test-2-track-b.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2");
mkdirSync(join(OUT_DIR, "novel"), { recursive: true });
mkdirSync(join(OUT_DIR, "screenplay"), { recursive: true });
mkdirSync(join(OUT_DIR, "short-form"), { recursive: true });

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
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 2000); }
  return { status: res.status, json };
}
function save(subdir, name, data) {
  writeFileSync(join(OUT_DIR, subdir, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

const STORIES = {
  "the-dealer": {
    intro: `Mara Voss returns to her family's arms-dealing operation after her father's death, only to find Kessler -- her father's second-in-command -- has already moved to consolidate control before the funeral is even over.`,
    protagonist: { name: "Mara Voss", role: "protagonist", personality: "guarded, methodical, haunted by her father's legacy", desires: "escape the family business without getting anyone killed" },
    antagonist: { name: "Kessler", role: "antagonist", personality: "calculating, controlled, dangerous", desires: "consolidate control over the regional arms trade" },
    antagonistSkill: { name: "Krav Maga", category: "physical", level: 4, acquisitionPath: "deliberate_practice", traumaLinked: false },
    location: { name: "The Armory", description: "A decommissioned grain silo converted into a weapons cache on the edge of town, corrugated steel and sodium light." },
    villainScene: "Kessler corners Mara in the Armory at night to make clear who is really in charge now, and the conversation turns physical.",
  },
  "the-horizon-line": {
    intro: `Dr. Elena Marsh discovers that Horizon Station's official founding date is a fabrication -- the structure beneath the ice predates any human expedition by centuries, and The Warden has known the whole time.`,
    protagonist: { name: "Dr. Elena Marsh", role: "protagonist", personality: "rational, increasingly unraveling, fiercely loyal to her research", desires: "prove the anomaly is real before she's discredited or worse" },
    antagonist: { name: "The Warden", role: "antagonist", personality: "patient, inhuman logic wearing a human voice", desires: "keep the station's true purpose hidden" },
    antagonistSkill: null,
    location: { name: "Horizon Station", description: "An isolated arctic research outpost built over a structure that predates any human expedition." },
    villainScene: "The Warden confronts Elena in the station's lower levels after she accesses files she was never meant to see.",
  },
};

// Track A's real projects -- reused for Novel so villain-pov exercises the
// real combat-style auto-inference against Kessler's actual Krav Maga skill,
// and so this track's 3 chapters overwrite (not duplicate) Track A's chapters.
const TRACK_A_PROJECTS = {
  "the-dealer": {
    projectId: "c109dd81-13c4-4f0b-98d3-cebc7a6afad0",
    protagonistId: "e68470e0-7304-4269-8dc8-73f482437cdf",
    antagonistId: "4a082c34-6a70-4c2c-a94e-1e1e3bc324b3",
    chapterIds: ["415d76d1-80cb-4cfc-9b14-0978006b6acd", "49e99e7c-e24e-4714-a3f4-3fe59dd2bd60", "9eb30315-3d76-4d9f-9ee5-624d45f31eed"],
    hasSkill: true,
  },
  "the-horizon-line": {
    projectId: "4bbfd6fe-bc07-4394-a4db-9bd5c8da39e3",
    protagonistId: "9a2d341a-d226-483d-8800-ec82946f6329",
    antagonistId: "a8b5cff7-4c2d-443b-8d3d-f0884125e9e0",
    chapterIds: ["e75a0606-d49d-486e-863c-0dd93b1682f6", "50adcbe9-8a01-4187-8b6a-eb359cfa13d5", "4f60b42c-ff19-4e2b-829a-4afcaa501898"],
    hasSkill: false,
  },
};

// Calls /api/ai/generate normally first. Only if the app's own content-
// violation confirmation gate actually fires (requiresConfirmation: true) does
// this retry the SAME call with bypassViolationCheck -- mirroring exactly what
// a real user would do by reading the flagMessage and clicking confirm, not a
// blanket bypass applied to every call regardless of whether the gate ever fires.
async function generateWithConfirm(body) {
  const first = await req("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
  if (first.json?.requiresConfirmation) {
    console.log(`  [violation gate fired: ${first.json.violationType} -- confirming through, matching a real user's click]`);
    return req("/api/ai/generate", { method: "POST", body: JSON.stringify({ ...body, bypassViolationCheck: true }) });
  }
  return first;
}

function buildStaticContext(story) {
  const lines = ["CHARACTERS:"];
  lines.push(`- ${story.protagonist.name} (${story.protagonist.role}): ${story.protagonist.personality}. Wants: ${story.protagonist.desires}.`);
  lines.push(`- ${story.antagonist.name} (${story.antagonist.role}): ${story.antagonist.personality}. Wants: ${story.antagonist.desires}.`);
  lines.push("", "LOCATIONS:");
  lines.push(`- ${story.location.name}: ${story.location.description}`);
  return lines.join("\n");
}

async function runNovelOrScreenplay(key, format) {
  const label = `${key}-${format}`;
  console.log(`\n=== ${label} ===`);
  const story = STORIES[key];
  const staticContext = buildStaticContext(story);

  let projectId, antagonistId, chapterIds, useAutoInference;
  if (format === "Novel" && TRACK_A_PROJECTS[key]) {
    ({ projectId, antagonistId, chapterIds } = TRACK_A_PROJECTS[key]);
    useAutoInference = TRACK_A_PROJECTS[key].hasSkill;
    console.log("reusing Track A project:", projectId, "auto-inference test:", useAutoInference, "overwriting chapters:", chapterIds);
  } else {
    const { json: project } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: `${key} (${format}, Output Test 2 v2)`, format }) });
    projectId = project.id;
    const { json: protagonist } = await req(`/api/projects/${projectId}/characters`, {
      method: "POST", body: JSON.stringify({ name: story.protagonist.name, role: story.protagonist.role, personality: story.protagonist.personality, desires: story.protagonist.desires }),
    });
    const { json: antagonist } = await req(`/api/projects/${projectId}/characters`, {
      method: "POST", body: JSON.stringify({ name: story.antagonist.name, role: story.antagonist.role, personality: story.antagonist.personality, desires: story.antagonist.desires }),
    });
    antagonistId = antagonist.id;
    await req(`/api/projects/${projectId}/locations`, { method: "POST", body: JSON.stringify({ name: story.location.name, description: story.location.description }) });
    chapterIds = [];
    for (let i = 1; i <= 3; i++) {
      const { json: chapter } = await req(`/api/projects/${projectId}/chapters`, { method: "POST", body: JSON.stringify({ title: `Chapter ${i}` }) });
      chapterIds.push(chapter.id);
    }
    useAutoInference = false;
    console.log("project:", projectId, "protagonist:", protagonist.id, "antagonist:", antagonistId);
  }

  const { json: outlineRes } = await generateWithConfirm({ mode: "outline", prompt: `Premise: ${story.intro}\n\nOutline the first act.`, context: "", staticContext, dynamicContext: "", format, projectId });
  save(format.toLowerCase(), `${label}-outline.json`, outlineRes);
  console.log("outline:", outlineRes.text?.length ?? 0, "chars");

  let priorContent = "";
  let chapter1Content = "";
  for (let i = 1; i <= 3; i++) {
    const chapterId = chapterIds[i - 1];
    const prompt = i === 1
      ? `Premise: ${story.intro}\n\nOutline so far:\n${outlineRes.text}\n\nWrite chapter 1.`
      : `Continue the story. Previous chapter ended:\n${priorContent.slice(-1500)}\n\nWrite chapter ${i}, advancing the plot.`;
    // staticContext on EVERY chapter (not just chapter 1) -- the model has no
    // memory between calls; the character sheet must be present in every request.
    const { json: writeRes } = await generateWithConfirm({ mode: "write", prompt, context: "", staticContext, dynamicContext: "", format, projectId, chapterId });
    save(format.toLowerCase(), `${label}-chapter${i}.json`, writeRes);
    priorContent = writeRes.text ?? "";
    if (i === 1) chapter1Content = priorContent;
    console.log(`chapter ${i}:`, priorContent.length, "chars");
    await req(`/api/projects/${projectId}/chapters/${chapterId}`, { method: "PATCH", body: JSON.stringify({ content: priorContent }) });
  }

  // Director: villain-pov -- the auto-inference test for the-dealer/Novel
  // (no combatStyleA/B supplied, relies entirely on Kessler's real skill data).
  const { json: villainRes } = await req(`/api/projects/${projectId}/villain-pov`, {
    method: "POST", body: JSON.stringify({ characterId: antagonistId, sceneDescription: story.villainScene }),
  });
  save(format.toLowerCase(), `${label}-villain-pov${useAutoInference ? "-AUTO-INFERENCE" : ""}.json`, villainRes);
  console.log("villain-pov:", villainRes.text?.length ?? 0, "chars", useAutoInference ? "(auto-inference test)" : "");

  const { json: tensionRes } = await req(`/api/projects/${projectId}/tension-curve`, { method: "POST" });
  save(format.toLowerCase(), `${label}-tension-curve.json`, tensionRes);
  console.log("tension-curve:", tensionRes.scores ? `${tensionRes.scores.length} chapters scored` : JSON.stringify(tensionRes).slice(0, 150));

  const { json: refineRes } = await req("/api/ai/refine", { method: "POST", body: JSON.stringify({ text: chapter1Content, format, projectId, chapterId: chapterIds[0] }) });
  save(format.toLowerCase(), `${label}-refine.json`, refineRes);
  console.log("refine:", refineRes.text?.length ?? 0, "chars");

  return { projectId, chapterIds, antagonistId };
}

async function runShortFormSpotCheck(key) {
  const story = STORIES[key];
  const format = "TikTok Script";
  console.log(`\n=== ${key}-shortform ===`);
  const staticContext = buildStaticContext(story);
  const { json: project } = await req("/api/projects", { method: "POST", body: JSON.stringify({ name: `${key} (short-form, Output Test 2 v2)`, format }) });
  const { json: writeRes } = await generateWithConfirm({ mode: "write", prompt: `Premise: ${story.intro}\n\nOpen the story with a hook.`, context: "", staticContext, dynamicContext: "", format, projectId: project.id });
  save("short-form", `${key}-shortform.json`, writeRes);
  console.log("short-form:", writeRes.text?.length ?? 0, "chars");
  return { projectId: project.id };
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
  for (const key of Object.keys(STORIES)) {
    summary[`${key}-novel`] = await runNovelOrScreenplay(key, "Novel");
    summary[`${key}-screenplay`] = await runNovelOrScreenplay(key, "Screenplay");
    summary[`${key}-shortform`] = await runShortFormSpotCheck(key);
  }

  writeFileSync(join(OUT_DIR, "TRACK-B-SUMMARY.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

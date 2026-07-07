/**
 * Output Test 2, Track A: full 26-mode sweep against two fresh test stories
 * (mirroring Output Test 1's "The Dealer" / "The Horizon Line" premises, but
 * created fresh per-run rather than depending on the original DB rows).
 * Uses the disposable ghostwriter-test-runner account, same as
 * novel-screenplay-test.mjs. Real character/location data is fetched from the
 * created World Bible rows and passed as staticContext -- not byte-identical
 * to context-builder.ts's exact format, but real project data, not empty.
 *
 * Usage: node scripts/output-test-2-track-a.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const EMAIL = "ghostwriter-test-runner@example.com";
const PASSWORD = "GhostwriterTestRunner-2026!";
const OUT_DIR = join(process.cwd(), "outputtestresults", "output-test-2", "mode-sweep");
mkdirSync(OUT_DIR, { recursive: true });

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
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

function save(name, data) {
  writeFileSync(join(OUT_DIR, name), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

const STORIES = [
  {
    key: "the-dealer",
    projectName: "The Dealer (Output Test 2)",
    format: "Novel",
    characters: [
      { name: "Mara Voss", role: "protagonist", personality: "guarded, methodical, haunted by her father's legacy", desires: "escape the family business without getting anyone killed" },
      { name: "Kessler", role: "antagonist", personality: "calculating, controlled, dangerous", desires: "consolidate control over the regional arms trade", skills: [{ name: "Krav Maga", category: "physical", level: 4, acquisitionPath: "deliberate_practice", traumaLinked: false }] },
    ],
    locations: [
      { name: "The Armory", description: "A decommissioned grain silo converted into a weapons cache on the edge of town, corrugated steel and sodium light." },
    ],
  },
  {
    key: "the-horizon-line",
    projectName: "The Horizon Line (Output Test 2)",
    format: "Novel",
    characters: [
      { name: "Dr. Elena Marsh", role: "protagonist", personality: "rational, increasingly unraveling, fiercely loyal to her research", desires: "prove the anomaly is real before she's discredited or worse" },
      { name: "The Warden", role: "antagonist", personality: "patient, inhuman logic wearing a human voice", desires: "keep the station's true purpose hidden" },
    ],
    locations: [
      { name: "Horizon Station", description: "An isolated arctic research outpost built over a structure that predates any human expedition." },
    ],
  },
];

const MODE_PROMPTS = {
  brainstorm: "Brainstorm three different directions the next scene could take.",
  outline: "Outline the next three story beats.",
  write: "Write the next scene, continuing directly from where the story left off.",
  dialogue: "Write a tense dialogue exchange between the protagonist and the antagonist.",
  combat: "Write a fight scene between the protagonist and the antagonist.",
  emotional: "Write a scene where the protagonist breaks down after a devastating loss.",
  atmosphere: "Describe the story's central location in vivid, multi-sensory detail.",
  tension: "Write a suspenseful scene where the protagonist realizes they're being watched.",
  composition: "Write a scene where tension and atmosphere operate together as the protagonist searches the location alone at night.",
  horror: "Write a horror scene where the protagonist realizes something is deeply wrong.",
  comedy: "Write a comedic beat of awkward banter between two characters.",
  mystery: "Write a scene where the protagonist discovers a hidden clue that raises more questions than it answers.",
  romance: "Write a moment of unexpected romantic tension between two characters.",
  action: "Write a high-stakes chase scene through the story's setting.",
  monologue: "Write an internal monologue as the protagonist grapples with a hard decision.",
  voice: "Write an opening paragraph that establishes the narrator's distinct voice.",
  thriller: "Write a scene where the protagonist realizes the danger is closing in faster than expected.",
  sports: "Write a scene involving a tense, competitive physical contest between two characters.",
  setting: "Describe the story's central location as a character first arrives there.",
  historical: "Write a scene that incorporates a real historical detail relevant to the story's world.",
  scitech: "Write a scene involving a real scientific or technological concept central to the story.",
  ethics: "Write a scene where the protagonist faces a genuine ethical dilemma with no clean answer.",
  endings: "Write a possible ending for this story.",
  isekai: "Write a scene where a character is unexpectedly transported into a wholly unfamiliar world.",
  interrogation: "Write an interrogation scene between the protagonist and someone who knows more than they're saying.",
  chase: "Write a tense pursuit scene through the story's setting.",
};

function buildStaticContext(characters, locations) {
  const lines = ["CHARACTERS:"];
  for (const c of characters) {
    lines.push(`- ${c.name} (${c.role}): ${c.personality}. Wants: ${c.desires}.`);
  }
  lines.push("", "LOCATIONS:");
  for (const l of locations) {
    lines.push(`- ${l.name}: ${l.description}`);
  }
  return lines.join("\n");
}

async function setupStory(story) {
  console.log(`\n=== Setting up ${story.key} ===`);
  const { json: project } = await req("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: story.projectName, format: story.format }),
  });
  if (!project?.id) throw new Error(`Project creation failed for ${story.key}: ${JSON.stringify(project)}`);
  console.log("project:", project.id);

  const createdCharacters = [];
  for (const c of story.characters) {
    const { json: created } = await req(`/api/projects/${project.id}/characters`, {
      method: "POST",
      body: JSON.stringify({ name: c.name, role: c.role, personality: c.personality, desires: c.desires }),
    });
    if (c.skills) {
      await req(`/api/projects/${project.id}/characters/${created.id}`, {
        method: "PATCH",
        body: JSON.stringify({ skills: c.skills }),
      });
    }
    createdCharacters.push({ ...c, id: created.id });
    console.log("character:", created.id, c.name, c.skills ? `(skill: ${c.skills[0].name})` : "");
  }

  for (const l of story.locations) {
    await req(`/api/projects/${project.id}/locations`, {
      method: "POST",
      body: JSON.stringify({ name: l.name, description: l.description }),
    });
  }

  const staticContext = buildStaticContext(story.characters, story.locations);
  return { projectId: project.id, staticContext, characters: createdCharacters };
}

async function runModeSweep(story, setup) {
  const results = [];
  let totalTokens = 0;
  for (const [mode, prompt] of Object.entries(MODE_PROMPTS)) {
    process.stdout.write(`  ${story.key} / ${mode} ... `);
    const { status, json } = await req("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({
        mode, prompt, context: "", staticContext: setup.staticContext, dynamicContext: "",
        format: story.format, projectId: setup.projectId,
      }),
    });
    save(`${story.key}-${mode}.json`, json);
    const tokens = json?.tokensUsed ?? 0;
    totalTokens += tokens;
    const textLen = json?.text?.length ?? 0;
    console.log(`status=${status} chars=${textLen} tokens=${tokens}`);
    results.push({ mode, status, textLen, tokens, model: json?.model, error: status !== 200 ? json : undefined });
  }
  return { results, totalTokens };
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

  const session = await req("/api/auth/session");
  console.log("session user:", session.json?.user?.email ?? "NONE — sign-in likely failed");

  const summary = { stories: {} };
  for (const story of STORIES) {
    const setup = await setupStory(story);
    console.log(`\n--- Mode sweep: ${story.key} (${Object.keys(MODE_PROMPTS).length} modes) ---`);
    const { results, totalTokens } = await runModeSweep(story, setup);
    const failures = results.filter(r => r.status !== 200);
    summary.stories[story.key] = { projectId: setup.projectId, totalTokens, failCount: failures.length, results };
    console.log(`\n${story.key}: ${results.length - failures.length}/${results.length} succeeded, ${totalTokens} total tokens`);
    if (failures.length) console.log("FAILURES:", failures.map(f => `${f.mode}: ${f.status}`).join(", "));
  }

  save("SUMMARY.json", summary);
  console.log("\nAll output saved to", OUT_DIR);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });

// scripts/eval-generate.ts
//
// Phase 2 of the quality-stack port (docs/superpowers/specs — see CLAUDE.md
// item 23 / product-history.md "Quality-stack port"): generates BLIND A/B
// scene pairs for OFFLINE judging. This script never judges anything itself
// — it only generates, randomizes file labels, and reports word counts.
//
// Run with: npx tsx scripts/eval-generate.ts
//
// What it does:
//   1. Finds-or-creates a single seeded eval project (real characters/
//      locations/plot threads/prior chapters/story memories) so context is
//      non-trivial, exactly like a real user's project.
//   2. For each of ~18 scenes (diverse modes/genres), generates TWICE:
//      baseline (quality_stack OFF — base context only) and treatment
//      (quality_stack ON — + scene blueprint + promise ledger + voice
//      exemplars), calling the same generate()/builder functions the real
//      /api/ai/generate route calls. Does NOT go through the HTTP route or
//      GrowthBook at all, so there's no risk of touching the live flag.
//   3. Writes blind, neutral files: eval-output/scene_NN_A.md / _B.md (which
//      of baseline/treatment is A vs B is coin-flipped per scene).
//   4. Writes eval-output/_KEY.md (hidden answer key + word counts) and
//      eval-output/_JUDGE_INSTRUCTIONS.md (rubric + both-orderings protocol).
//   5. Prints a report: word counts per scene/version, average length delta.
//      Never judges quality.

import { db } from "../src/db";
import { users, projects, characters, locations, plotThreads, chapters, storyMemories } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { buildStaticContext, buildDynamicContext, type ContextProject } from "../src/lib/ai/context-builder";
import { generate } from "../src/lib/ai/engine";
import { buildSceneBlueprint } from "../src/lib/ai/scene-blueprint";
import { buildPromiseLedger } from "../src/lib/ai/promise-ledger";
import { buildVoiceExemplars } from "../src/lib/ai/exemplars";
import { isProseMode } from "../src/lib/modes/registry";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const EVAL_USER_EMAIL = "eval-quality-stack@ghostwriter.internal";
const EVAL_PROJECT_NAME = "[EVAL] Quality Stack Test — Vesper Protocol";
const OUTPUT_DIR = join(__dirname, "..", "eval-output");
const FORMAT = "Novel";

interface Scene {
  id: string; // e.g. "01"
  mode: string;
  label: string; // human description for the report only
  prompt: string;
}

// 18 scenes spanning the modes the port spec named as examples
// (combat, quiet dialogue, atmospheric opener, tense confrontation,
// emotional beat, action, etc.) plus enough Sonnet-tier write/dialogue
// scenes to anchor the set. All on the SAME seeded bible so context reuse
// across scenes is realistic, not 18 unrelated premises.
const SCENES: Scene[] = [
  { id: "01", mode: "write", label: "write — opening continuation", prompt: "Continue the story: Mira reads Daniel's message about the docks and has to decide whether to go alone." },
  { id: "02", mode: "write", label: "write — later continuation", prompt: "Write the scene where Mira breaks into the Foundation's archive room looking for the shell-company list." },
  { id: "03", mode: "dialogue", label: "dialogue — quiet two-hander", prompt: "Write a quiet conversation between Mira and Daniel where he admits he's been talking to Kane's office behind her back." },
  { id: "04", mode: "dialogue", label: "dialogue — tense exchange", prompt: "Write the conversation where Mira confronts Senator Kane directly for the first time, in his office." },
  { id: "05", mode: "combat", label: "combat — physical confrontation", prompt: "Write the scene where Mira fights off two of Kane's security contractors at the Riverside Docks." },
  { id: "06", mode: "atmosphere", label: "atmosphere — atmospheric opener", prompt: "Write an atmospheric opening scene set in the abandoned dock warehouse at night, before anything happens." },
  { id: "07", mode: "tension", label: "tension — tense confrontation", prompt: "Write the scene where Mira waits in the dark of her safehouse, certain Kane's car is about to pull up outside." },
  { id: "08", mode: "emotional", label: "emotional — emotional beat", prompt: "Write the scene where Mira finally learns what actually happened to Priya the night she disappeared." },
  { id: "09", mode: "action", label: "action — action beat", prompt: "Write the scene where Mira runs through the Foundation tower as the alarms go off, trying to reach the stairwell before security seals the floor." },
  { id: "10", mode: "horror", label: "horror — dread beat", prompt: "Write the scene where Mira is trapped in the flooded sub-basement of her safehouse and realizes she isn't alone down there." },
  { id: "11", mode: "mystery", label: "mystery — investigation beat", prompt: "Write the scene where Mira finally decodes the shell-company list and realizes it connects directly to Kane's confirmation hearing." },
  { id: "12", mode: "romance", label: "romance — charged moment", prompt: "Write a charged, vulnerable moment between Mira and Daniel in the safehouse after a near-miss with Kane's people." },
  { id: "13", mode: "monologue", label: "monologue — internal reckoning", prompt: "Write Mira's internal monologue as she admits to herself how far she's willing to go to find Priya." },
  { id: "14", mode: "thriller", label: "thriller — net closing in", prompt: "Write the scene where Mira realizes Kane's men have found the safehouse and are closing in from both ends of the street." },
  { id: "15", mode: "interrogation", label: "interrogation — questioning scene", prompt: "Write the scene where Mira interrogates a captured Foundation operative about Priya's location." },
  { id: "16", mode: "chase", label: "chase — pursuit", prompt: "Write a foot chase across the Riverside Docks as Mira tries to lose Kane's men among the shipping containers." },
  { id: "17", mode: "setting", label: "setting — location establishing", prompt: "Write a scene establishing the Aldric Foundation Tower from the inside, through Mira's eyes, on her first visit." },
  { id: "18", mode: "comedy", label: "comedy — dark humor beat", prompt: "Write a darkly funny exchange between Mira and Daniel while they're patching up a wound, to relieve the tension." },
];

async function findOrCreateEvalProject() {
  let user = await db.query.users.findFirst({ where: eq(users.email, EVAL_USER_EMAIL) });
  if (!user) {
    [user] = await db.insert(users).values({ email: EVAL_USER_EMAIL, name: "Quality Stack Eval (internal)" }).returning();
    console.log(`Created eval user ${user!.id}`);
  }

  let project = await db.query.projects.findFirst({ where: eq(projects.name, EVAL_PROJECT_NAME) });
  if (project) {
    console.log(`Reusing existing eval project ${project.id}`);
    return project.id;
  }

  [project] = await db.insert(projects).values({
    userId: user!.id,
    name: EVAL_PROJECT_NAME,
    format: FORMAT,
    genres: ["Thriller", "Mystery"],
    controllingIdea: "A disgraced intelligence analyst must expose the senator who buried the truth about her sister's disappearance before he buries her too.",
  }).returning();
  const projectId = project!.id;

  await db.insert(characters).values([
    { projectId, name: "Mira Voss", role: "Protagonist — disgraced intelligence analyst", age: "34", appearance: "Lean, watchful, a thin scar through one eyebrow from a redacted op gone wrong.", personality: "Controlled, relentless, allergic to being underestimated.", desires: "To find Priya alive and expose Kane.", fears: "That she's already too late, and that she's becoming the kind of person who burns everyone to get there.", backstory: "Forced out of the agency after a leak she didn't cause was pinned on her.", arc: "Learns that justice and vengeance are not the same thing, and has to choose." },
    { projectId, name: "Daniel Reyes", role: "Ally — Mira's former partner", age: "37", appearance: "Broad-shouldered, tired eyes, a habit of standing between Mira and any door.", personality: "Loyal but burned by Mira once before; trusts slowly.", desires: "To protect Mira without becoming complicit in what she's willing to do.", fears: "Losing her the way he lost his own sense of who he is." },
    { projectId, name: "Senator Aldric Kane", role: "Antagonist — sitting senator, founder of the Aldric Foundation", age: "58", appearance: "Silver-haired, unhurried, the kind of calm that reads as menace once you know him.", personality: "Charismatic, patient, genuinely believes he's the only adult in the room.", desires: "To bury the surveillance program before the confirmation hearing.", fears: "Being exposed as someone who let an asset disappear to protect his career." },
    { projectId, name: "Priya Nandi", role: "Mira's younger sister — missing", age: "29", appearance: "Sharper-dressed than Mira, used to being underestimated for it.", personality: "Idealistic, sharper than people give her credit for.", desires: "Before she vanished: to blow the whistle herself." },
  ]);

  await db.insert(locations).values([
    { projectId, name: "The Aldric Foundation Tower", description: "A glass spire downtown, all transparency on the outside and none on the inside.", atmosphere: "Cold, surveilled, performatively open." },
    { projectId, name: "Mira's Safehouse", description: "A flooded basement apartment in the old garment district, accessible only through a laundromat.", atmosphere: "Damp, cramped, smells of mildew and gun oil." },
    { projectId, name: "The Riverside Docks", description: "A half-abandoned shipping yard where the Foundation moves things it doesn't want on record.", atmosphere: "Fog, rust, sodium light, the sound of water against hulls." },
  ]);

  await db.insert(plotThreads).values([
    { projectId, name: "Who leaked the surveillance files", description: "An anonymous leak exposed the Foundation's surveillance program — Mira was blamed for it, but didn't do it.", stakes: "If Kane finds out who actually leaked it, he'll bury them instead of just their career." },
    { projectId, name: "Priya's location", description: "Priya went dark after her last message mentioned 'the docks.'", stakes: "Every day she's missing, the odds she's still alive drop." },
    { projectId, name: "Kane's real motive", description: "Kane's panic feels disproportionate to a routine leak.", stakes: "If it's bigger than self-preservation, no one is safe once the hearing passes." },
  ]);

  const [chap1] = await db.insert(chapters).values({
    projectId, title: "The Leak", sortOrder: 0,
    content: "Mira Voss had three days left on her badge when the story broke, and exactly none of it was true the way they printed it. She read the headline twice in the parking garage before she let herself feel anything, because feeling anything in that garage was how you ended up on camera feeling it. By the time she reached her car she had already decided who she was going to become for the next however-long this took: someone with nothing left to protect, which made her very hard to threaten.",
    wordCount: 75,
  }).returning();

  const [chap2] = await db.insert(chapters).values({
    projectId, title: "The Call", sortOrder: 1,
    content: "Daniel's text came in at 2 a.m.: Priya's phone just pinged near the docks. First time in six days. Mira was dressed before she'd finished reading it. She didn't call him back. She knew exactly what he'd say — wait, verify, don't go alone — and she didn't have it in her to promise any of those things and mean them.",
    wordCount: 60,
  }).returning();

  await db.insert(storyMemories).values([
    { projectId, chapterId: chap1.id, chapterIndex: 0, fact: "Mira was forced out after being blamed for a leak she didn't commit.", category: "event", structuredData: { openPromisesCreated: ["Find out who actually leaked the surveillance files"], openPromisesResolved: [] } },
    { projectId, chapterId: chap2.id, chapterIndex: 1, fact: "Priya's phone pinged near the docks after six days dark.", category: "event", structuredData: { openPromisesCreated: ["Priya's location at the docks", "Mira implicitly promised Daniel she'd involve him, then didn't"], openPromisesResolved: [] } },
  ]);

  console.log(`Created eval project ${projectId} with 4 characters, 3 locations, 3 plot threads, 2 prior chapters.`);
  return projectId;
}

async function loadContextProject(projectId: string): Promise<ContextProject> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  const projChars = await db.query.characters.findMany({ where: eq(characters.projectId, projectId) });
  const projLocs = await db.query.locations.findMany({ where: eq(locations.projectId, projectId) });
  const projPlots = await db.query.plotThreads.findMany({ where: eq(plotThreads.projectId, projectId) });
  const projChapters = await db.query.chapters.findMany({ where: eq(chapters.projectId, projectId) });
  const projMemories = await db.query.storyMemories.findMany({ where: eq(storyMemories.projectId, projectId) });
  const sortedChapters = [...projChapters].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  return {
    ...(project as any),
    characters: projChars as any, locations: projLocs as any, plotThreads: projPlots as any,
    chapters: sortedChapters as any, storyMemories: projMemories as any,
    activeChapter: sortedChapters[sortedChapters.length - 1]?.id,
    referenceWorks: [],
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function generateVariant(opts: {
  scene: Scene; ctxProject: ContextProject; userId: string; projectId: string; variant: "baseline" | "treatment";
}): Promise<{ text: string; words: number }> {
  const { scene, ctxProject, userId, projectId, variant } = opts;
  // activeMode/currentPrompt drive realism-domain injection and accuracy-domain
  // detection inside buildDynamicContext/buildStaticContext (they read these
  // fields, not the `mode` function parameter) — without them, combat/horror/
  // action scenes silently lose their realism context, the exact thing the
  // real /api/ai/generate client-side context build sets per request.
  const scenedProject: ContextProject = { ...ctxProject, activeMode: scene.mode, currentPrompt: scene.prompt };
  const staticContext = buildStaticContext(scenedProject, scene.mode);
  const dynamicContext = buildDynamicContext(scenedProject, scene.mode);

  // Matches the real route's `|| undefined` fallback: an empty-string dynamic
  // context (not undefined) makes generate() emit a second, empty system text
  // block, which the Anthropic API rejects outright (400).
  let finalDynamic: string | undefined = dynamicContext || undefined;
  if (variant === "treatment" && isProseMode(scene.mode)) {
    const [blueprint, promiseLedger, voiceExemplars] = await Promise.all([
      buildSceneBlueprint({ prompt: scene.prompt, staticContext, dynamicContext, format: FORMAT }),
      buildPromiseLedger(projectId),
      buildVoiceExemplars(userId, scene.prompt),
    ]);
    finalDynamic = [dynamicContext, promiseLedger, voiceExemplars, blueprint].filter(Boolean).join("\n\n") || undefined;
  }

  const r = await generate({ mode: scene.mode, prompt: scene.prompt, staticContext, dynamicContext: finalDynamic, format: FORMAT });
  return { text: r.text.trim(), words: wordCount(r.text) };
}

async function main() {
  const scenes = process.env.EVAL_SMOKE_TEST === "1" ? SCENES.slice(0, 1) : SCENES;
  if (scenes.length < SCENES.length) console.log(`SMOKE TEST: running ${scenes.length}/${SCENES.length} scene(s) only.`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const projectId = await findOrCreateEvalProject();
  const user = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  const userId = user!.userId;
  const ctxProject = await loadContextProject(projectId);

  const report: { id: string; label: string; mode: string; baselineWords: number; treatmentWords: number; aIsBaseline: boolean }[] = [];
  const keyLines: string[] = ["# Hidden Answer Key — do not open until after judging\n"];

  for (const scene of scenes) {
    console.log(`Generating scene ${scene.id} (${scene.label})...`);
    const [baseline, treatment] = await Promise.all([
      generateVariant({ scene, ctxProject, userId, projectId, variant: "baseline" }),
      generateVariant({ scene, ctxProject, userId, projectId, variant: "treatment" }),
    ]);

    const aIsBaseline = Math.random() < 0.5;
    const aText = aIsBaseline ? baseline.text : treatment.text;
    const bText = aIsBaseline ? treatment.text : baseline.text;
    const aWords = aIsBaseline ? baseline.words : treatment.words;
    const bWords = aIsBaseline ? treatment.words : baseline.words;

    writeFileSync(join(OUTPUT_DIR, `scene_${scene.id}_A.md`), `# Scene ${scene.id} — Version A\n\n**Prompt:** ${scene.prompt}\n\n**Word count:** ${aWords}\n\n---\n\n${aText}\n`);
    writeFileSync(join(OUTPUT_DIR, `scene_${scene.id}_B.md`), `# Scene ${scene.id} — Version B\n\n**Prompt:** ${scene.prompt}\n\n**Word count:** ${bWords}\n\n---\n\n${bText}\n`);

    keyLines.push(`## Scene ${scene.id} (${scene.label}, mode: ${scene.mode})`);
    keyLines.push(`- A = ${aIsBaseline ? "BASELINE (quality_stack OFF)" : "TREATMENT (quality_stack ON)"} — ${aWords} words`);
    keyLines.push(`- B = ${aIsBaseline ? "TREATMENT (quality_stack ON)" : "BASELINE (quality_stack OFF)"} — ${bWords} words`);
    keyLines.push("");

    report.push({ id: scene.id, label: scene.label, mode: scene.mode, baselineWords: baseline.words, treatmentWords: treatment.words, aIsBaseline });
  }

  writeFileSync(join(OUTPUT_DIR, "_KEY.md"), keyLines.join("\n"));
  writeFileSync(join(OUTPUT_DIR, "_JUDGE_INSTRUCTIONS.md"), JUDGE_INSTRUCTIONS);

  console.log("\n=== Report (word counts only — this script does not judge quality) ===");
  let totalBaselineWords = 0, totalTreatmentWords = 0;
  for (const r of report) {
    console.log(`Scene ${r.id} (${r.label}, ${r.mode}): baseline=${r.baselineWords}w, treatment=${r.treatmentWords}w, delta=${r.treatmentWords - r.baselineWords}w`);
    totalBaselineWords += r.baselineWords;
    totalTreatmentWords += r.treatmentWords;
  }
  const avgDelta = (totalTreatmentWords - totalBaselineWords) / report.length;
  console.log(`\nAverage length delta (treatment − baseline): ${avgDelta.toFixed(1)} words/scene`);
  console.log(`Total: baseline=${totalBaselineWords}w, treatment=${totalTreatmentWords}w across ${report.length} scenes.`);
  console.log(`\nFiles written to ${OUTPUT_DIR}. Do NOT open _KEY.md until all scenes are judged blind.`);
}

const JUDGE_INSTRUCTIONS = `# Judge Instructions — Quality Stack Eval (Phase 3)

You are judging BLIND A/B scene pairs. Do NOT open _KEY.md until you have recorded a verdict for
every scene below in BOTH orderings.

## Rubric (craft, NOT length)

For each pair, judge A vs B on:
- Specificity / concreteness (not generic)
- Character voice distinctiveness
- Specific (not generic) sensory grounding
- Scene movement — is there a real turn / change, not just description?
- Absence of cliché / filler / AI-tells (vague emotion-naming, throat-clearing transitions,
  repetitive sentence rhythm, purple metaphors)

**Do NOT reward length or fluency for their own sake.** If the longer passage isn't better on
craft, prefer the shorter one.

## Both-orderings protocol (kills position bias)

Judge each pair TWICE: read A then B, record a verdict; then read B then A, record a verdict
again. A version only wins if it wins OR ties in BOTH readings. A flip between orderings counts
as a tie for that scene.

Verdict per scene per reading: "A better" / "B better" / "tie".

## Recording verdicts

For each scene (01-18), record:
- Reading 1 (A then B): verdict
- Reading 2 (B then A): verdict
- Final: A / B / tie (per the both-orderings rule above)

Only after all 18 scenes have a final verdict, open _KEY.md and map A/B back to
baseline/treatment. Count how many scenes treatment won, lost, or tied, and note whether any
treatment wins correlate with treatment simply being longer (check the word counts in _KEY.md) —
a length-driven win is NOT a craft win.

## Self-preference caveat

Both versions are Claude-written and (if Claude is the judge) the judge is also Claude — this
carries a self-preference bias a human judge wouldn't have. Treat results accordingly:
- CLEAR result (treatment wins ≥13/18, both orderings, not length-driven) → trustworthy →
  consider defaulting quality_stack ON.
- CLOSE result (e.g. 10/8, or length-driven wins) → treat as a WASH. Do not default-on a costly
  pipeline (the Haiku blueprint call) on a wash — consider defaulting on only the zero-cost
  subset (promise-ledger + rhythm) and leaving the blueprint optional until it earns its cost.
`;

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

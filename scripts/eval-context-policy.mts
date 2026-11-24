import { buildContextForGeneration } from "@/lib/ai/context-shadow";
import { setContextShadowSink, type ContextShadowDiff } from "@/lib/ai/context-policy-version";
import { MODE_REGISTRY } from "@/lib/modes/registry";
import type { ContextProject } from "@/lib/ai/context-builder";

/**
 * Phase 0 / v4 §5.2 — ContextPolicy shadow evaluation.
 *
 * Runs every registered mode against a deliberately rich fixture project under
 * both the legacy full policy and the mode-aware candidate, and reports what the
 * switch would actually change. Stage A (shadow) has zero behavioural effect, so
 * this is safe to run: it only reads.
 *
 * Usage: npx tsx scripts/eval-context-policy.mts
 */

// ---------------------------------------------------------------- fixtures
function makeCharacter(i: number, name: string, role: string, alwaysInContext = true) {
  return {
    id: `c${i}`, projectId: "p1", name, role, age: String(28 + i),
    appearance: `Weathered face, scar across the left brow, dark hair greying at the temple.`,
    personality: `Guarded, precise, hides panic behind competence.`,
    thinkingStyle: `Thinks in contingencies, never in absolutes.`,
    behavior: `Checks exits first. Speaks last.`,
    habits: `Taps two fingers when lying.`,
    fears: `Being the reason someone else dies.`,
    desires: `To be told she was right about the station.`,
    speechPattern: `Clipped. Uses naval cadence without noticing.`,
    backstory: `Grew up on the docks; joined the service at fifteen.`,
    arc: `From lone operator to someone who accepts help.`,
    portraitUrl: "", sortOrder: i, alwaysInContext,
    linkedLocationIds: ["l1"], linkedPlotThreadIds: ["t1"],
  } as any;
}

function makeLocation(i: number, name: string, description: string) {
  return {
    id: `l${i}`, projectId: "p1", name, description,
    rules: `Gravity is slightly off. Ceilings are low by design.`,
    sortOrder: i, alwaysInContext: true,
  } as any;
}

function makeChapter(i: number, title: string, words: number) {
  return {
    id: `ch${i}`, projectId: "p1", title, sortOrder: i, content: "",
    summary: `Chapter ${i}: the crew regroups and the signal repeats.`,
    wordCount: words, chapterType: "chapter", reviewStatus: "draft",
  } as any;
}

function makeMemory(i: number, category: string, fact: string, chapterId: string) {
  return {
    id: `m${i}`, projectId: "p1", chapterId, category, fact,
    keyEvents: [], objectsIntroduced: [], knowledgeShifts: [],
    decisions: [], consequences: [], emotionalState: {},
    openPromisesCreated: [], createdAt: new Date(0),
  } as any;
}

/** Builds a project with `chapterCount` chapters and `memoryCount` memories. */
function buildProject(chapterCount: number, memoryCount: number): ContextProject {
  const chapters = Array.from({ length: chapterCount }, (_, i) => makeChapter(i + 1, `Chapter ${i + 1}`, 1800 + i * 40));
  const characters = [
    makeCharacter(1, "Riya Anand", "Protagonist"),
    makeCharacter(2, "Arjun Mehta", "Antagonist"),
    makeCharacter(3, "Sam Okonkwo", "Ally"),
    makeCharacter(4, "The Warden", "Mentor"),
  ];
  const locations = [
    makeLocation(1, "Meridian Station", "A decaying orbital relay."),
    makeLocation(2, "Low Gravity Dock", "Where cargo is loaded under 0.3g."),
    makeLocation(3, "Signal Room B", "Sealed after the second incident."),
  ];
  const plotThreads = [
    { id: "t1", projectId: "p1", name: "The repeating signal", description: "Someone answers, then stops.", status: "Active", stakes: "Everyone aboard.", alwaysInContext: true, sortOrder: 1 } as any,
    { id: "t2", projectId: "p1", name: "Arjun's bargain", description: "A trade he cannot afford.", status: "Active", alwaysInContext: true, sortOrder: 2 } as any,
  ];
  const worldEntities = [
    { id: "w1", projectId: "p1", kind: "object", name: "The black notebook", summary: "Every captain has one. None explain why.", alwaysInContext: true } as any,
    { id: "w2", projectId: "p1", kind: "faction", name: "Station Authority", summary: "Technically responsible for everything.", alwaysInContext: true } as any,
    { id: "w3", projectId: "p1", kind: "concept", name: "The Long Count", summary: "Debt measured in favours, never money.", alwaysInContext: true } as any,
  ];
  const storyMemories = Array.from({ length: memoryCount }, (_, i) =>
    makeMemory(i + 1, ["event", "character_decision", "world_rule", "relationship"][i % 4],
      `Fact ${i}: the crew learned something that changes the plan.`,
      chapters[i % Math.max(1, chapters.length)].id)
  );
  const storyPromises = [
    { id: "sp1", projectId: "p1", setup: "The notebook is opened", status: "open", priority: "A" } as any,
    { id: "sp2", projectId: "p1", setup: "Arjun's debt comes due", status: "open", priority: "B" } as any,
  ];
  const characterRelationships = [
    { id: "cr1", projectId: "p1", characterId: "c1", relatedCharacterId: "c2", relationshipType: "antagonist", trust: 2, power: -3, notes: "Mutual professional respect." } as any,
  ];

  return {
    id: "p1", name: "The Long Count", format: "Novel", skillLevel: "expert",
    genres: ["Science Fiction", "Thriller"], notes: "",
    characters, locations, plotThreads, chapters, referenceWorks: [],
    worldEntities, storyMemories, storyPromises, characterRelationships,
    activeChapter: chapters[0].id,
    currentPrompt: "Write the scene where Riya decides whether to open the notebook.",
    narrativeStructure: "linear",
    controllingIdea: "Trust is the only currency that cannot be minted.",
  } as any;
}

/** A representative working project: every context section has content. */
function richProject(): ContextProject {
  return buildProject(8, 16);
}

/** A small project, to show how the policy behaves with little data. */
function sparseProject(): ContextProject {
  return buildProject(3, 2);
}

/** A long-running project, where Headroom trimming also comes into play. */
function longProject(): ContextProject {
  const p = buildProject(40, 60);
  // Inflate prose so budget packing has real pressure.
  p.characters = p.characters.map((c: any) => ({
    ...c, backstory: c.backstory.repeat(6), personality: c.personality.repeat(4),
  }));
  return p;
}

// ------------------------------------------------------------------ run
const collected: ContextShadowDiff[] = [];
setContextShadowSink((d) => collected.push(d));

const MODES = Object.keys(MODE_REGISTRY);
const FIXTURES: Array<{ label: string; make: () => ContextProject }> = [
  { label: "sparse", make: sparseProject },
  { label: "rich", make: richProject },
  { label: "long-running", make: longProject },
];

type Row = {
  mode: string; fixture: string;
  dropped: string; added: string;
  tokLegacy: number; tokMode: number; saved: number; pct: number;
  realismLost: boolean; worldLost: boolean; canonLost: boolean;
};

const rows: Row[] = [];

for (const fx of FIXTURES) {
  for (const mode of MODES) {
    collected.length = 0;
    const project = fx.make();
    const built = buildContextForGeneration(project, mode, "all_access");
    const d = collected.at(-1);
    if (!d) throw new Error(`no shadow diff emitted for ${mode}/${fx.label}`);
    if (!d.modeIsRegistered) throw new Error(`mode ${mode} not in registry — diff uninformative`);

    // Which content classes the switch removes entirely.
    const lost = (k: string) => d.presence.legacy[k] && !d.presence.modeAware[k];
    rows.push({
      mode, fixture: fx.label,
      dropped: d.droppedByPolicy.join(",") || "-",
      added: d.addedByPolicy.join(",") || "-",
      tokLegacy: d.estimatedTokens.legacy,
      tokMode: d.estimatedTokens.modeAware,
      saved: d.estimatedTokens.saved,
      pct: d.estimatedTokens.legacy === 0 ? 0 : Math.round((d.estimatedTokens.saved / d.estimatedTokens.legacy) * 100),
      realismLost: lost("memories") || d.droppedByPolicy.includes("plots"),
      worldLost: lost("worldElements"),
      canonLost: lost("characters"),
    });
  }
}

// ------------------------------------------------------------------ report
console.log("ContextPolicy shadow evaluation (v4 §5.2)");
console.log("==========================================");
console.log(`policy version : shadow (legacy text is what generation uses)`);
console.log(`modes evaluated : ${MODES.length}`);
console.log(`fixtures       : ${FIXTURES.map((f) => f.label).join(", ")}`);
console.log(`combinations   : ${rows.length}`);
console.log("");

const P = (n: number, w = 6) => String(n).padStart(w);
console.log("mode          fixture       tokLegacy tokMode  saved  pct  world-lost  canon-lost");
console.log("------------- ------------ -------- -------- ------ ----- ----------- -----------");
for (const r of rows) {
  if (r.fixture !== "rich") continue;
  console.log(
    `${r.mode.padEnd(13)} ${r.fixture.padEnd(12)} ${P(r.tokLegacy, 8)} ${P(r.tokMode, 8)} ${P(r.saved, 6)} ${P(r.pct, 4)}% ${(r.worldLost ? "YES" : "-").padEnd(11)} ${r.canonLost ? "YES" : "-"}`
  );
}

console.log("\nAggregate (all fixtures)");
console.log("-----------------------");
const avgPct = Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length);
console.log(`mean token reduction      : ${avgPct}%`);
console.log(`modes losing WORLD ELEMENTS: ${new Set(rows.filter((r) => r.worldLost).map((r) => r.mode)).size} of ${MODES.length}`);
console.log(`modes losing characters    : ${new Set(rows.filter((r) => r.canonLost).map((r) => r.mode)).size} of ${MODES.length}`);
console.log(`modes with any dropped section: ${new Set(rows.filter((r) => r.dropped !== "-").map((r) => r.mode)).size} of ${MODES.length}`);

const worldLosers = [...new Set(rows.filter((r) => r.worldLost).map((r) => r.mode))];
const canonLosers = [...new Set(rows.filter((r) => r.canonLost).map((r) => r.mode))];
console.log(`\nWorld-element losers (${worldLosers.length}): ${worldLosers.join(", ")}`);
console.log(`Character-canon losers (${canonLosers.length}): ${canonLosers.join(", ")}`);

// Behaviour-preservation assertion: in shadow mode the ACTIVE context must be
// byte-identical to what the pre-rollout code produced.
console.log("\nBehaviour preservation");
console.log("----------------------");
let violations = 0;
for (const fx of FIXTURES) {
  for (const mode of MODES) {
    const project = fx.make();
    const built = buildContextForGeneration(project, mode, "all_access");
    if (built.staticCtx !== built.legacy!.staticCtx || built.dynamicCtx !== built.legacy!.dynamicCtx) {
      console.log(`  x ${mode}/${fx.label}: active context differs from legacy — behaviour changed during shadow!`);
      violations++;
    }
  }
}
if (violations === 0) {
  console.log(`  OK: in shadow mode the active context is byte-identical to legacy for all ${rows.length} combinations.`);
} else {
  process.exitCode = 1;
}
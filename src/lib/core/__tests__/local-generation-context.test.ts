/**
 * Phase 4 slice 4d — the §2.7 local context half, suite two: the local
 * composition of the cloud context builders (`buildSeriesUniverseContext` /
 * `buildSeriesBibleContext` / `buildPromiseLedger`) over the SQLite twins,
 * plus the mount's mapping-friendly `loadViolations` read and the
 * `generations`-table `persist` port — all verified over REAL in-memory
 * SQLite databases.
 *
 * Every byte-parity claim below is seeded EXPLICITLY — owner rows, project
 * chains, memories with distinct createdAt instants, character states, canon
 * events, bibles — so the exact expected static/dynamic strings are composed
 * by hand from the seeds, never inferred. Helpers are tripled from scratch
 * (never imported across test files), mirroring the snapshot suite's
 * conventions: `createSqliteDb(":memory:")` per fixture, insert-grade
 * seeding with real field values, 20000 ms test timeouts, and the mirrored
 * source-purity block reading the module's source text. NO network of any
 * kind; no real mode registry side effects (the registry module is pure
 * consts/types and rides in through the cloud module's own pure exports).
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import {
  chapters,
  generations,
  projectCharacterStates,
  projects,
  seriesBibles,
  storyMemories,
  universeCharacters,
  universeEvents,
  universes,
  users,
} from "@/db/sqlite-schema";
import type { StageOutcome } from "@/lib/ai/generation-service";
import { makeLocalContextBuilder } from "@/lib/core/local-generation-context";
import type { GenerateChapterInput } from "@/lib/core/handlers/generate-chapter";

/** The composition half's NEW optional carry on GenerateChapterInput. */
type CarryInput = GenerateChapterInput & { readonly additionalContext?: string };

type Built = { static?: string; dynamic?: string };

/** The local buildContext never stops — narrow the StageOutcome union. */
function builtOrThrow(out: StageOutcome<Built>): Built {
  if ("stop" in out) throw new Error("the local buildContext never stops");
  return out;
}

/** The exact generate-mode header the cloud ledger always answers with. */
const PROMISE_HEADER =
  "OPEN STORY PROMISES (honor these threads — advance or deepen them; do NOT resolve prematurely or let them vanish):";

const created: SqliteDbHandle[] = [];
afterAll(() => {
  for (const h of created) h.sqlite.close();
  created.length = 0;
});

function freshDb(): SqliteDbHandle {
  const h = createSqliteDb(":memory:");
  created.push(h);
  return h;
}

let tick = 0;
function uid(label: string): string {
  tick += 1;
  return `${label}-${String(tick).padStart(4, "0")}`;
}

let stampTick = 0;
/** Distinct increasing instants — createdAt ordering stays deterministic. */
function stamp(): Date {
  stampTick += 1;
  return new Date(Date.UTC(2026, 0, 1, 12, 0, 0) + stampTick * 60_000);
}

async function seedOwner(handle: SqliteDbHandle, email: string): Promise<string> {
  const [row] = await handle.db.insert(users).values({ id: uid("u"), email }).returning();
  return row!.id;
}

type ProjectSeed = {
  name?: string;
  storyType?: string;
  seriesParentId?: string | null;
  universeId?: string | null;
  timelineSort?: number | null;
  intentionalViolations?: Record<string, { confirmed: boolean; purpose: string; timestamp: string }>;
};

async function seedProject(handle: SqliteDbHandle, ownerId: string, seed: ProjectSeed = {}): Promise<string> {
  const [row] = await handle.db
    .insert(projects)
    .values({
      id: uid("p"),
      userId: ownerId,
      name: seed.name ?? uid("p-name"),
      storyType: seed.storyType ?? "linear",
      ...(seed.seriesParentId !== undefined ? { seriesParentId: seed.seriesParentId } : {}),
      ...(seed.universeId !== undefined ? { universeId: seed.universeId } : {}),
      ...(seed.timelineSort !== undefined ? { timelineSort: seed.timelineSort } : {}),
      ...(seed.intentionalViolations !== undefined ? { intentionalViolations: seed.intentionalViolations } : {}),
      createdAt: stamp(),
      updatedAt: stamp(),
    })
    .returning();
  return row!.id;
}

interface MemorySeed {
  projectId: string;
  fact: string;
  chapterIndex?: number;
  /** db-controlled JSON — garbage shapes are exactly what one test seeds. */
  structuredData?: unknown;
}

async function seedMemory(handle: SqliteDbHandle, seed: MemorySeed): Promise<void> {
  await handle.db.insert(storyMemories).values({
    id: uid("sm"),
    projectId: seed.projectId,
    fact: seed.fact,
    category: "general",
    autoExtracted: false,
    chapterIndex: seed.chapterIndex ?? 0,
    structuredData: (seed.structuredData ?? null) as never,
    createdAt: stamp(),
  });
}

describe("local context binder — the §2.7 series chain (owner-scoped walk)", () => {
  it("byte-pins the full static assembly: an undefined static becomes exactly '\\n\\n---\\n' + the series context, with keyEvents and fact memory variants in desc(createdAt) order", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-series");
    const grandId = await seedProject(h, ownerId, { name: "The Grey Years", storyType: "linear" });
    const parentId = await seedProject(h, ownerId, {
      name: "The Quiet Coast", storyType: "series", seriesParentId: grandId,
    });
    const projId = await seedProject(h, ownerId, {
      name: "The New Sea", storyType: "series", seriesParentId: parentId,
    });

    // Book 1 (grandparent): a fact-only memory.
    await seedMemory(h, { projectId: grandId, fact: "The kingdom froze two winters" });
    // Book 2 (parent): the fact-only memory seeded FIRST (older), the
    // keyEvents memory LAST (newest) — desc(createdAt) must render the
    // keyEvents line first, and the fact branch must skip it.
    await seedMemory(h, { projectId: parentId, fact: "The delegate stayed behind" });
    await seedMemory(h, {
      projectId: parentId,
      fact: "Heir vanished from the tower",
      structuredData: { keyEvents: ["the heir vanished", "the fleet burned"] },
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Sail east", projectId: projId }));

    const expectedStatic =
      "\n\n---\n" +
      "\n\n--- STORY UNIVERSE ---\n" +
      [
        "SERIES CONTEXT — events from previous books that inform this story:",
        "\nBook 1: The Grey Years",
        "  - The kingdom froze two winters",
        "\nBook 2: The Quiet Coast",
        "  Key: the heir vanished | the fleet burned",
        "  - The delegate stayed behind",
      ].join("\n");

    // The EXACT cloud shape { static, dynamic } — both keys PRESENT even when
    // the values are undefined (presence-keyed omits are deliberately NOT
    // this shape).
    expect(Object.keys(out).sort()).toEqual(["dynamic", "static"]);
    expect("static" in out).toBe(true);
    expect("dynamic" in out).toBe(true);
    expect(out.static).toBe(expectedStatic);
    // No promises anywhere in this fixture → the ledger contributes nothing.
    expect(out.dynamic).toBeUndefined();
  }, 20000);

  it("caps each walked book at its 5 latest memories (desc createdAt) — 7 seeded, only the 5 newest render", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-cap");
    const parentId = await seedProject(h, ownerId, { name: "The Ledger Keepers", storyType: "linear" });
    const projId = await seedProject(h, ownerId, {
      name: "The New Sea", storyType: "series", seriesParentId: parentId,
    });
    for (let i = 1; i <= 7; i++) {
      await seedMemory(h, { projectId: parentId, fact: `fact-${i}` });
    }

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Continue", projectId: projId }));

    const expectedStatic =
      "\n\n---\n" +
      "\n\n--- STORY UNIVERSE ---\n" +
      [
        "SERIES CONTEXT — events from previous books that inform this story:",
        "\nBook 1: The Ledger Keepers",
        "  - fact-7",
        "  - fact-6",
        "  - fact-5",
        "  - fact-4",
        "  - fact-3",
      ].join("\n");
    expect(out.static).toBe(expectedStatic);
  }, 20000);

  it("stops the walk at the depth-10 guard — an 11-deep ancestor chain renders exactly 10 books, the oldest never visited", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-depth");
    const linkIds: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const seed: ProjectSeed = { name: `Link-${String(i).padStart(2, "0")}`, storyType: "linear" };
      if (i >= 2) seed.seriesParentId = linkIds[i - 2];
      linkIds.push(await seedProject(h, ownerId, seed));
      await seedMemory(h, { projectId: linkIds[i - 1], fact: `L-fact-${String(i).padStart(2, "0")}` });
    }
    const projId = await seedProject(h, ownerId, {
      name: "The New Sea", storyType: "series", seriesParentId: linkIds[10],
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "p", projectId: projId }));

    expect((out.static?.match(/Book \d+:/g) ?? []).length).toBe(10);
    expect(out.static).toContain("Book 1: Link-02");
    expect(out.static).toContain("Book 10: Link-11");
    expect(out.static).not.toContain("Link-01");
    expect(out.static).not.toContain("Book 11");
  }, 20000);

  it("a parent owned by ANOTHER owner breaks the walk silently — the chain shortens and the owner-owned grandparent never leaks", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-foreign");
    const strangerId = await seedOwner(h, "stranger@ctx-foreign");
    const grandId = await seedProject(h, ownerId, { name: "Owned Grand Book", storyType: "linear" });
    await seedMemory(h, { projectId: grandId, fact: "GRAND SECRET the owner owns" });
    const foreignParentId = await seedProject(h, strangerId, {
      name: "Foreign Parent", storyType: "series", seriesParentId: grandId,
    });
    const projId = await seedProject(h, ownerId, {
      name: "The New Sea", storyType: "series", seriesParentId: foreignParentId,
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "p", projectId: projId }));

    expect("static" in out).toBe(true);
    expect(out.static).toBeUndefined();
    expect("dynamic" in out).toBe(true);
    expect(out.dynamic).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("GRAND SECRET");
  }, 20000);
});

// ── universe-entity seed helpers (tripled from scratch, like every fixture) ──

type UniverseSeed = {
  name: string;
  premise?: string;
  tone?: string;
  sharedRules?: string[];
};

async function seedUniverse(handle: SqliteDbHandle, ownerId: string, seed: UniverseSeed): Promise<string> {
  const [row] = await handle.db
    .insert(universes)
    .values({
      id: uid("uni"),
      userId: ownerId,
      name: seed.name,
      ...(seed.premise !== undefined ? { premise: seed.premise } : {}),
      ...(seed.tone !== undefined ? { tone: seed.tone } : {}),
      ...(seed.sharedRules !== undefined ? { sharedRules: seed.sharedRules } : {}),
      createdAt: stamp(),
      updatedAt: stamp(),
    })
    .returning();
  return row!.id;
}

async function seedUniverseCharacter(
  handle: SqliteDbHandle,
  universeId: string,
  name: string,
  baseProfile: Record<string, unknown>,
): Promise<string> {
  const [row] = await handle.db
    .insert(universeCharacters)
    .values({ id: uid("uc"), universeId, name, baseProfile: baseProfile as never, createdAt: stamp() })
    .returning();
  return row!.id;
}

type CharacterStateSeed = {
  projectId: string;
  universeCharId: string;
  emotionalState?: string;
  stateNotes?: string;
  isDeceased?: boolean;
};

async function seedCharacterState(handle: SqliteDbHandle, seed: CharacterStateSeed): Promise<void> {
  await handle.db.insert(projectCharacterStates).values({
    id: uid("pcs"),
    projectId: seed.projectId,
    universeCharId: seed.universeCharId,
    ...(seed.emotionalState !== undefined ? { emotionalState: seed.emotionalState } : {}),
    ...(seed.stateNotes !== undefined ? { stateNotes: seed.stateNotes } : {}),
    ...(seed.isDeceased !== undefined ? { isDeceased: seed.isDeceased } : {}),
    createdAt: stamp(),
  });
}

type UniverseEventSeed = {
  name: string;
  timelineSort: number;
  description?: string;
  isCanon?: boolean;
  projectId?: string | null;
};

async function seedUniverseEvent(handle: SqliteDbHandle, universeId: string, seed: UniverseEventSeed): Promise<void> {
  await handle.db.insert(universeEvents).values({
    id: uid("ue"),
    universeId,
    name: seed.name,
    timelineSort: seed.timelineSort,
    ...(seed.description !== undefined ? { description: seed.description } : {}),
    ...(seed.isCanon !== undefined ? { isCanon: seed.isCanon } : {}),
    ...(seed.projectId !== undefined ? { projectId: seed.projectId } : {}),
    createdAt: stamp(),
  });
}

describe("local context binder — the §2.7 universe composition (canon, character states, §5.6 scoping)", () => {
  it("byte-pins the whole universe-story static — universe block → canon events (canon ∧ sort ≤ projSort-1, asc) → prior-state characters, where the newest state decides (Vera), a foreign same-universe state never leaks (Moss), and a deceased state in a NON-prior book does not kill (Late)", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-universe");
    const strangerId = await seedOwner(h, "stranger@ctx-universe");
    const universeId = await seedUniverse(h, ownerId, {
      name: "Velt",
      premise: "A drowned archipelago",
      tone: "salt and iron",
      sharedRules: ["The dead speak only across running water", "No machines newer than sail"],
    });
    // Prior-positioned (sort 1), non-prior (sort 6), and a FOREIGN same-universe
    // book at sort 0 — which the CLOUD would treat as prior (sort 0 < 5) and
    // the §5.6 owner predicate must exclude.
    const p1Id = await seedProject(h, ownerId, {
      name: "First Tide", storyType: "universe-story", universeId, timelineSort: 1,
    });
    const p2Id = await seedProject(h, ownerId, {
      name: "Late Tide", storyType: "universe-story", universeId, timelineSort: 6,
    });
    const foreignId = await seedProject(h, strangerId, {
      name: "Foreign Tide", storyType: "universe-story", universeId, timelineSort: 0,
    });
    const projId = await seedProject(h, ownerId, {
      name: "The Half Tide", storyType: "universe-story", universeId, timelineSort: 5,
    });

    // Canon pool: 5 events — two pass, one empty-description pass (no suffix),
    // the boundary-exact sort passes, a future sort and a non-canon row never do.
    await seedUniverseEvent(h, universeId, { name: "The Sundering", description: "the sky cracked", timelineSort: 1, isCanon: true });
    await seedUniverseEvent(h, universeId, { name: "The Long Winter", timelineSort: 2, isCanon: true });
    await seedUniverseEvent(h, universeId, { name: "Future War", description: "after this story", timelineSort: 9, isCanon: true });
    await seedUniverseEvent(h, universeId, { name: "Unsealed Oath", description: "not canon", timelineSort: 1, isCanon: false });
    await seedUniverseEvent(h, universeId, { name: "Boundary Sort", description: "sort exactly 4", timelineSort: 4, isCanon: true });

    // Vera: TWO prior states — the older alive, the NEWER deceased. The
    // desc(createdAt)[0] pick must land on the deceased one.
    const veraId = await seedUniverseCharacter(h, universeId, "Vera", { role: "Warden" });
    await seedCharacterState(h, { projectId: p1Id, universeCharId: veraId, emotionalState: "Calm", stateNotes: "Old warden years", isDeceased: false });
    await seedCharacterState(h, { projectId: p1Id, universeCharId: veraId, emotionalState: "Rigor", stateNotes: "Newer state — the one that must be picked", isDeceased: true });
    // Moss: its ONLY state lives on the foreign book (newest global stamp) —
    // must never leak into the owner's read.
    const mossId = await seedUniverseCharacter(h, universeId, "Moss", { role: "Keeper" });
    await seedCharacterState(h, { projectId: foreignId, universeCharId: mossId, emotionalState: "POSSESSED", stateNotes: "foreign book state", isDeceased: false });
    // Newly: one ordinary prior state → live with State + History lines.
    const newlyId = await seedUniverseCharacter(h, universeId, "Newly", { role: "Scout" });
    await seedCharacterState(h, { projectId: p1Id, universeCharId: newlyId, emotionalState: "Restless", stateNotes: "Scouted the fen", isDeceased: false });
    // Late: deceased-state ONLY in the NON-prior book (sort 6 > 5) → renders
    // alive with just the base-profile role line.
    const lateId = await seedUniverseCharacter(h, universeId, "Late", { role: "Ghostwright" });
    await seedCharacterState(h, { projectId: p2Id, universeCharId: lateId, emotionalState: "Ghost", stateNotes: "Died in the newest book", isDeceased: true });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Cross the strait", projectId: projId }));

    const expectedStatic =
      "\n\n---\n" +
      "\n\n--- STORY UNIVERSE ---\n" +
      [
        'UNIVERSE: "Velt"',
        "Premise: A drowned archipelago",
        "Tone: salt and iron",
        "Shared rules (must hold across every story in this universe):",
        "- The dead speak only across running water",
        "- No machines newer than sail",
        "UNIVERSE CANON — events established before this story:",
        "- The Sundering: the sky cracked",
        "- The Long Winter",
        "- Boundary Sort: sort exactly 4",
        "\nUNIVERSE CHARACTERS — state at the start of this story:",
        "Vera: DECEASED (do not include in this story)",
        "Moss:\n  Role: Keeper",
        "Newly:\n  Role: Scout\n  State: Restless\n  History: Scouted the fen",
        "Late:\n  Role: Ghostwright",
      ].join("\n");
    expect(out.static).toBe(expectedStatic);
    // No memories seeded → the ledger answers nothing.
    expect(out.dynamic).toBeUndefined();
    // The leak pins, asserted twice for a loud failure message.
    expect(JSON.stringify(out)).not.toContain("POSSESSED");
    expect(JSON.stringify(out)).not.toContain("foreign book state");
  }, 20000);

  it("the §5.6 tightening on the universes read: a FOREIGN-owned universe of the same id composes nothing — no UNIVERSE block, and the whole static stays undefined", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-uniforeign");
    const strangerId = await seedOwner(h, "stranger@ctx-uniforeign");
    const universeId = await seedUniverse(h, strangerId, {
      name: "Eld", premise: "The foreign premise", tone: "foreign tone",
    });
    const projId = await seedProject(h, ownerId, {
      name: "The Half Tide", storyType: "universe-story", universeId, timelineSort: 5,
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "p", projectId: projId }));

    // The cloud read the universe by id alone and would have rendered
    // `UNIVERSE: "Eld"` + premise/tone — the owner predicate refuses it,
    // so lines stay empty and appendSeriesContext returns the input: undefined.
    expect("static" in out).toBe(true);
    expect(out.static).toBeUndefined();
    expect("dynamic" in out).toBe(true);
    expect(out.dynamic).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("Eld");
    expect(JSON.stringify(out)).not.toContain("foreign premise");
  }, 20000);
});

describe("local context binder — the §2.7 series bible (user-level, per-projectIds selection)", () => {
  it("byte-pins the full bible wiring: the exact cloud lines in the exact order, cut to a linear project (the bible is user-level, independent of storyType), and the '\\n\\n--- SERIES BIBLE ---\\n' wrap", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-bible");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });
    await h.db.insert(seriesBibles).values({
      id: uid("sb"),
      userId: ownerId,
      name: "The Grey Archive",
      premise: "Records of the grey tide",
      tone: "archival",
      worldRules: ["The archive never lies", "Every keeper dies within sight of it"],
      seriesCharacterArcs: [
        { characterName: "Mirren", arcSummary: "from keeper to fugitive", booksInvolved: ["Book One", "Book Three"] },
      ],
      continuityNotes: "The lantern in chapter 1 is the same lantern in Book Three",
      timeline: [
        { event: "The tide first reached the stacks", period: "Book One" },
        // period-less entry — the staged shape permits it run-time even though
        // the schema $type requires it; the line must render WITHOUT a bracket.
        { event: "The archive burned" } as never,
      ],
      projectIds: [projId],
      createdAt: stamp(),
      updatedAt: stamp(),
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Enter the stacks", projectId: projId }));

    const expectedStatic =
      "\n\n---\n" +
      "\n\n--- SERIES BIBLE ---\n" +
      [
        'Series: "The Grey Archive"',
        "Premise: Records of the grey tide",
        "Tone: archival",
        "World rules (must hold across every book in this series):",
        "- The archive never lies",
        "- Every keeper dies within sight of it",
        "Series-spanning character arcs:",
        "- Mirren: from keeper to fugitive (books: Book One, Book Three)",
        "Continuity notes: The lantern in chapter 1 is the same lantern in Book Three",
        "Series timeline:",
        "- [Book One] The tide first reached the stacks",
        "- The archive burned",
      ].join("\n");
    expect(out.static).toBe(expectedStatic);
    expect(out.dynamic).toBeUndefined();
  }, 20000);

  it("selection and guards: a bible whose projectIds miss, a name-only hit under the lines>1 guard, and a FOREIGN-owned bible carrying this projectId all compose nothing", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-bible-sel");
    const strangerId = await seedOwner(h, "stranger@ctx-bible-sel");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });

    // MISS — owned, full content, but projectIds points elsewhere.
    await h.db.insert(seriesBibles).values({
      id: uid("sb"), userId: ownerId, name: "Other Series",
      premise: "never selected content", projectIds: ["unrelated-project"],
      createdAt: stamp(), updatedAt: stamp(),
    });
    // GUARD — hit by projectIds, but ONLY the Series line → lines.length is 1 → "".
    await h.db.insert(seriesBibles).values({
      id: uid("sb"), userId: ownerId, name: "Named Only", projectIds: [projId],
      createdAt: stamp(), updatedAt: stamp(),
    });
    // FOREIGN OWNER — carries this projectId, full content, wrong user row.
    await h.db.insert(seriesBibles).values({
      id: uid("sb"), userId: strangerId, name: "Foreign Series",
      premise: "stranger-owned content", projectIds: [projId],
      createdAt: stamp(), updatedAt: stamp(),
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "p", projectId: projId }));

    expect("static" in out).toBe(true);
    expect(out.static).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("Other Series");
    expect(JSON.stringify(out)).not.toContain("Named Only");
    expect(JSON.stringify(out)).not.toContain("Foreign Series");
    expect(JSON.stringify(out)).not.toContain("stranger-owned content");
  }, 20000);
});

describe("local context builder — the translated promise ledger (P1, DB-only)", () => {
  it("byte-pins the ledger resolution open set — the exact header, fuzzy inclusion (either direction), whitespace filtering, and Set dedupe — with nothing else joining the dynamic", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-ledger");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });

    // m1 (chapterIndex 0): two created promises.
    await seedMemory(h, {
      projectId: projId, fact: "m1", chapterIndex: 0,
      structuredData: { openPromisesCreated: ["The lighthouse keeper will confess", "A blue finch follows the guest"] },
    });
    // m2 (chapterIndex 1): a fuzzy resolution — strict enough to be neither
    // a full promise nor an exact entry, it must still match "The lighthouse
    // keeper will confess" via promise.includes(resolution).
    await seedMemory(h, {
      projectId: projId, fact: "m2", chapterIndex: 1,
      structuredData: { openPromisesResolved: ["lighthouse keeper"] },
    });
    // m3 (chapterIndex 2): re-creates the finch verbatim (Set dedupe target)
    // plus a genuinely open promise that must SURVIVE resolution checking.
    await seedMemory(h, {
      projectId: projId, fact: "m3", chapterIndex: 2,
      structuredData: { openPromisesCreated: ["A blue finch follows the guest", "The door in the cliff stays shut"] },
    });
    // m4 (chapterIndex 3): whitespace-only and empty creations are dropped.
    await seedMemory(h, {
      projectId: projId, fact: "m4", chapterIndex: 3,
      structuredData: { openPromisesCreated: ["  ", ""] },
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Continue east", projectId: projId }));

    const expectedLedger =
      PROMISE_HEADER +
      "\n" +
      ["- A blue finch follows the guest", "- The door in the cliff stays shut"].join("\n");
    expect(out.dynamic).toBe(expectedLedger);
    expect(out.static).toBeUndefined();
  }, 20000);

  it("keeps only the 8 most recent creations (slice(-8)) — 12 seeded in one chapter's structuredData, k-05 through k-12 render", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-ledger-cap");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });

    const twelve = Array.from({ length: 12 }, (_, i) => `k-${String(i + 1).padStart(2, "0")}`);
    await seedMemory(h, { projectId: projId, fact: "one memory carrying all twelve", structuredData: { openPromisesCreated: twelve } });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "p", projectId: projId }));

    const kept = twelve.slice(-8);
    const expectedLedger = PROMISE_HEADER + "\n" + kept.map((p) => `- ${p}`).join("\n");
    expect(out.dynamic).toBe(expectedLedger);
    expect(out.dynamic).not.toContain("k-01");
    expect(out.dynamic).not.toContain("k-04");
    expect((out.dynamic!.match(/^- /gm) ?? []).length).toBe(8);
  }, 20000);

  it("the augmentation gate holds the ledger out entirely: a brainstorm mode request and a free-tier write both answer an empty dynamic even with open promises seeded", async () => {
    const h1 = freshDb();
    const ownerId1 = await seedOwner(h1, "owner@ctx-gate-brainstorm");
    const projId1 = await seedProject(h1, ownerId1, { name: "The New Sea", storyType: "linear" });
    await seedMemory(h1, { projectId: projId1, fact: "gate-fixture", structuredData: { openPromisesCreated: ["The storm never arrives"] } });

    const ports1 = makeLocalContextBuilder({ db: h1.db, ownerId: ownerId1 });
    const brainstorm = builtOrThrow(await ports1.buildContext({ mode: "brainstorm", prompt: "Three options", projectId: projId1 }));
    expect("dynamic" in brainstorm).toBe(true);
    expect(brainstorm.dynamic).toBeUndefined();

    const h2 = freshDb();
    const ownerId2 = await seedOwner(h2, "owner@ctx-gate-free");
    const projId2 = await seedProject(h2, ownerId2, { name: "The New Sea", storyType: "linear" });
    await seedMemory(h2, { projectId: projId2, fact: "gate-fixture", structuredData: { openPromisesCreated: ["The storm never arrives"] } });

    const ports2 = makeLocalContextBuilder({ db: h2.db, ownerId: ownerId2, tier: "free" });
    const free = builtOrThrow(await ports2.buildContext({ mode: "write", prompt: "p", projectId: projId2 }));
    expect("dynamic" in free).toBe(true);
    expect(free.dynamic).toBeUndefined();
  }, 20000);

  it("fail-open: a garbage structuredData (non-array creation set) reaching the loop resolves the WHOLE ledger to empty — the valid promise seeded after it never renders either", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-ledger-bad");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });

    // The db-controlled JSON is garbage: (42 || []).forEach throws inside the
    // loop, exactly as the cloud's `(m as any).structuredData || {}` path did.
    await seedMemory(h, {
      projectId: projId, fact: "corrupt", chapterIndex: 0,
      structuredData: { openPromisesCreated: 42 } as never,
    });
    await seedMemory(h, {
      projectId: projId, fact: "after", chapterIndex: 1,
      structuredData: { openPromisesCreated: ["should never render"] },
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "p", projectId: projId }));

    expect("dynamic" in out).toBe(true);
    expect(out.dynamic).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("should never render");
  }, 20000);
});

describe("local context builder — buildContext assembly (ports shape, additionalContext carry, dynamic order)", () => {
  it("a request without a projectId composes nothing and passthroughs untouched — no table is touched at all (a stray project query would throw on eq(undefined)) — and the additionalContext carry joins the dynamic", async () => {
    const h = freshDb();
    const ports = makeLocalContextBuilder({ db: h.db, ownerId: "unused-owner-no-project-path" });

    const plain = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Scene one", staticContext: "SC", dynamicContext: "DC" }));
    expect(Object.keys(plain).sort()).toEqual(["dynamic", "static"]);
    expect(plain.static).toBe("SC");
    expect(plain.dynamic).toBe("DC");

    const carried = builtOrThrow(await ports.buildContext({
      mode: "write", prompt: "Scene one", staticContext: "SC", dynamicContext: "DC", additionalContext: "ADD",
    } as CarryInput));
    expect(carried.static).toBe("SC");
    expect(carried.dynamic).toBe("DC\n\nADD");

    const bare = builtOrThrow(await ports.buildContext({ mode: "write", prompt: "Scene one" }));
    expect("static" in bare).toBe(true);
    expect(bare.static).toBeUndefined();
    expect("dynamic" in bare).toBe(true);
    expect(bare.dynamic).toBeUndefined();
  }, 20000);

  it("the final dynamic order is exactly client dynamic → additionalContext → promise ledger, joined '\\n\\n'", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-order");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });
    await seedMemory(h, {
      projectId: projId, fact: "context-less memory", chapterIndex: 0,
      structuredData: { openPromisesCreated: ["p rose"] },
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const out = builtOrThrow(await ports.buildContext({
      mode: "write", prompt: "go", dynamicContext: "Dyn first", additionalContext: "Added second", projectId: projId,
    } as CarryInput));

    // The ledger is ONE string (header + "\n" + "- p rose"); the final compose
    // join adds '\n\n' BETWEEN parts, not inside the ledger's own list block.
    expect(out.dynamic).toBe(
      ["Dyn first", "Added second", PROMISE_HEADER + "\n- p rose"].join("\n\n"),
    );
    // staticContext absent + linear project → the static stays undefined.
    expect(out.static).toBeUndefined();
  }, 20000);
});

describe("local context builder — loadViolations (the §5.6 owner-scoped read)", () => {
  it("returns the owner project's intentionalViolations record verbatim, and the actorId argument is IGNORED (the owner IS the actor)", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-viols");
    const violations = {
      "rule-1": { confirmed: true, purpose: "The old god's name must be spoken aloud", timestamp: "2026-06-01T00:00:00.000Z" },
      "rule-2": { confirmed: false, purpose: "Draft-only anachronism", timestamp: "2026-06-02T00:00:00.000Z" },
    };
    const projId = await seedProject(h, ownerId, { name: "Vowel Project", intentionalViolations: violations });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const rec = await ports.loadViolations(projId, "not-even-the-owner");
    expect(rec).toEqual(violations);
  }, 20000);

  it("a foreign projectId or a missing row reads as an EMPTY record — never as another user's confirmations", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-viols2");
    const strangerId = await seedOwner(h, "stranger@ctx-viols2");
    const strangerProjId = await seedProject(h, strangerId, {
      name: "Stranger Book",
      intentionalViolations: { "s-1": { confirmed: true, purpose: "stranger's confirmed record", timestamp: "2026-06-03T00:00:00.000Z" } },
    });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const foreign = await ports.loadViolations(strangerProjId, ownerId);
    expect(foreign).toEqual({});
    expect(JSON.stringify(foreign)).toBe("{}");
    expect(JSON.stringify(foreign)).not.toContain("stranger's confirmed record");

    const missing = await ports.loadViolations("p-does-not-exist", ownerId);
    expect(missing).toEqual({});
  }, 20000);
});

describe("local context builder — persist (the generations-table write)", () => {
  it("writes the exact row: projectId/chapterId FKs, the RAW req.prompt as the record, out.text as output, and the supplied model/tokensUsed — returning undefined", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-persist");
    const projId = await seedProject(h, ownerId, { name: "The New Sea", storyType: "linear" });
    const chapterId = uid("c");
    await h.db.insert(chapters).values({ id: chapterId, projectId: projId, title: "One" });

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    const ret = await ports.persist(
      { text: "The tide returned.", model: "test-model", tokensUsed: 421 },
      { mode: "write", prompt: "RAW body prompt (never the directive-suffixed one)", projectId: projId, chapterId },
    );
    expect(ret).toBeUndefined();

    const [row] = await h.db.select().from(generations);
    expect(row!.projectId).toBe(projId);
    expect(row!.chapterId).toBe(chapterId);
    expect(row!.mode).toBe("write");
    expect(row!.prompt).toBe("RAW body prompt (never the directive-suffixed one)");
    expect(row!.output).toBe("The tide returned.");
    expect(row!.model).toBe("test-model");
    expect(row!.tokensUsed).toBe(421);
  }, 20000);

  it("omitted optionals ride their DDL defaults into the row: null project/chapter FKs, output '' from text ?? '', model 'claude-sonnet-5', tokensUsed NULL", async () => {
    const h = freshDb();
    const ownerId = await seedOwner(h, "owner@ctx-persist2");

    const ports = makeLocalContextBuilder({ db: h.db, ownerId });
    await ports.persist({ text: "" }, { mode: "brainstorm", prompt: "p2" });

    const [row] = await h.db.select().from(generations);
    expect(row!.projectId).toBeNull();
    expect(row!.chapterId).toBeNull();
    expect(row!.mode).toBe("brainstorm");
    expect(row!.prompt).toBe("p2");
    expect(row!.output).toBe("");
    expect(row!.model).toBe("claude-sonnet-5");
    expect(row!.tokensUsed).toBeNull();
  }, 20000);
});

describe("local context builder — module purity (source text pins)", () => {
  it("reads @/db/sqlite only as a TYPE, and never @/db, next/*, @neondatabase/serverless, or relations(", () => {
    const source = readFileSync(join(__dirname, "..", "local-generation-context.ts"), "utf-8");
    expect(source).not.toContain('"@/db"');
    expect(source).not.toContain("next/");
    expect(source).not.toContain("@neondatabase/serverless");
    expect(source).not.toContain("relations(");
    expect(source).toContain('import type { DrizzleSqliteDb } from "@/db/sqlite"');
  }, 20000);
});

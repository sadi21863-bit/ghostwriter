import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import * as sqliteSchema from "@/db/sqlite-schema";
import {
  accounts,
  audioExports,
  characterEvolutionLog,
  characterRelationships,
  characters,
  chapters,
  comicPages,
  comicPanels,
  creatorBibles,
  editorNotes,
  emailVerificationTokens,
  generations,
  locations,
  passwordResetTokens,
  platformEvents,
  plotThreads,
  productionShots,
  projectCharacterStates,
  projects,
  readerReactions,
  readerSessions,
  referenceWorks,
  referrals,
  seriesBibles,
  semanticCache,
  sessions,
  showcases,
  storyChanges,
  storyCheckpoints,
  storyMemories,
  storyPlans,
  storyPromises,
  storyThreads,
  storyTransactions,
  subscriptions,
  universeCharacters,
  universeEvents,
  universes,
  users,
  videoAnalysisJobs,
  workPackets,
  workPatterns,
  worldEntities,
} from "@/db/sqlite-schema";
import type { StoryTransaction } from "@/lib/core/handlers/apply-story-transaction";
import { makeSqliteStoryTransactionRepository } from "@/lib/core/sqlite-repositories";

/**
 * §4.3 — the full-surface SQLite round-trip fixture ("SQLite round-trip
 * preserves canonical story data", quoted from legacy-db-status.md).
 *
 * The nine parity suites pin ADAPTER-VERB truths per adapter surface. This file
 * is the different thing legacy-db-status.md demanded: a per-table canonical-
 * data round-trip over the WHOLE sqlite-schema.ts surface (43 tables) — write
 * one fully-typed row per table, read it back, and pin shape/type fidelity for
 * the wave-1 tracer's bug classes (jsonb→TEXT `mode:"json"` decoders, uuid via
 * `$defaultFn`, `integer(mode:"timestamp_ms")` Date round-trips,
 * `integer(mode:"boolean")` booleans, real columns, notNull/DDL defaults,
 * nullable-null) plus FK-cascade reachability for the parents whose children
 * the parity files never covered.
 *
 * The table list is ENUMERATED from the module's exports at runtime (`@/db/
 * sqlite-schema` namespace + drizzle's `Symbol.for("drizzle:Name")` tag) — not
 * a hand-kept list — and cross-checked against the vendored DDL. The inserts
 * are hand-written per table's real required columns, and a coverage pin at the
 * bottom fails if a table export ever stops being exercised here.
 *
 * Per-table disposition (adapter verbs → their parity file; everything → this
 * fixture's raw row):
 *  - characters, locations            → pair 1 (character-location parity)
 *  - plot_threads, reference_works    → pair 2 (thread-reference parity)
 *  - world_entities                   → pair 3 (world-entity parity)
 *  - character_relationships          → pair 4 (relationship parity)
 *  - projects                         → pairs 3/5 (project parity)
 *  - comic_pages, comic_panels        → pair 6 (comic parity)
 *  - production_shots                 → pair 7 (production-shot parity)
 *  - story_threads/promises/memories/checkpoints/plans → pair 8 (story-OS parity)
 *  - chapters, story_transactions, story_changes → pair 9 (trio parity); the
 *    transaction pair is produced HERE through the REAL `record()` adapter
 *    (its shape cannot be produced legitimately any other way — audit rows are
 *    adapter-owned, handler-supplied transaction id, wire-string values).
 *  - semantic_cache                   → pair 1 pins only its composite unique;
 *                                       the full row round-trips here.
 *  - users (FK parent only — no adapter ever reads it) and the rest of the
 *    never-adapter-read surface (accounts, sessions, editor_notes, generations,
 *    creator_bibles, character_evolution_log, audio_exports, video_analysis_
 *    jobs, reader_sessions/reactions, showcases, work_packets/patterns,
 *    subscriptions, series_bibles, referrals, password/email tokens,
 *    platform_events, universes, universe_characters, project_character_states,
 *    universe_events) exist in the baseline but are written nowhere in the
 *    sqlite layer — THIS fixture's raw row is their only exercise, which is
 *    exactly the §4.3 "empty tables" guarantee: the insert/read-back proves
 *    their shape is self-consistent.
 *
 * The legacy "17 empty tables" verdict, keyed to the code (2026-10-31): the
 * probed Neon DB held 41 tables with 17 at zero rows (legacy-db-status.md's
 * list is internally consistent with its own rowCounts), but the DDL has since
 * grown by two — story_transactions + story_changes (43 today, §13.1) — and
 * six of the 17 "empty" tables (world_entities, story_threads, story_promises,
 * story_plans, story_checkpoints, reference_works) now carry full adapter
 * parity coverage. So the HONEST code disposition is: 18 adapter-exercised
 * tables, 1 seed-only FK parent (users), and 24 never-adapter-read tables
 * whose shape is proven here. The fixture still writes EVERY story-domain
 * table regardless — per the standing rule.
 *
 * FK-cascade scope: the parity suites already pin projects→(characters/
 * locations | plot_threads/reference_works | world_entities | relationships |
 * chapters/comics | shots | story-OS five | transaction machinery) and
 * users→projects(+level-two). This file adds ONLY the skipped ones —
 * users→its periphery (accounts/sessions/subscriptions/referrals/tokens/
 * platform_events[set null]/work_packets/video_analysis/series/universe
 * chains), projects→(editor_notes/generations/audio_exports/reader rows/
 * creator bible/character_evolution_log/project_character_states/
 * universe_events[set null]), and chapters→(editor_notes/comic_pages/
 * reader_reactions cascades + generations/story_memories/production_shots
 * set-nulls + the FK-LESS audio_exports.chapterId and story_threads.
 * openedAtChapterId/parent_chapter_id pinned as honest dangling strings,
 * mirrored verbatim from pg). story_threads→story_promises set-null is pinned
 * behaviorally by pair 8 — here only its DDL clause is re-asserted.
 */

// One fresh in-memory database per test; disposed afterEach so vitest reports
// no open async handles (mirrors the parity suites).
const created: SqliteDbHandle[] = [];
function fresh() {
  const handle = createSqliteDb(":memory:");
  created.push(handle);
  return handle;
}
afterEach(() => {
  for (const h of created) h.sqlite.close();
  created.length = 0;
});

// The tables this file round-trips, tracked at each insert site; the coverage
// pin at the bottom holds this set EQUAL to the module's runtime-exported
// table list, so a new table cannot be declared without this fixture growing.
const ROUND_TRIPPED = new Set<string>();
const mark = (key: keyof typeof sqliteSchema) => {
  ROUND_TRIPPED.add(key);
};

/** Enumerate the module's TABLE exports at runtime — the list this file drives. */
const tableName = (candidate: unknown): string | undefined => {
  if (candidate === null || typeof candidate !== "object") return undefined;
  const name = (candidate as Record<PropertyKey, unknown>)[Symbol.for("drizzle:Name")];
  return typeof name === "string" ? name : undefined;
};
function enumeratedTables(): { key: string; name: string }[] {
  return Object.entries(sqliteSchema)
    .map(([key, value]) => ({ key, name: tableName(value) }))
    .filter((entry): entry is { key: string; name: string } => typeof entry.name === "string");
}

// Canonical fixture dates — pinned exactly, because epoch-ms columns arrive
// back as real Date instances with the SAME instant.
const EMAIL_VERIFIED_AT = new Date("2026-10-01T00:00:00.000Z");
const TRIAL_END = new Date("2027-01-31T00:00:00.000Z");
const SESSION_EXPIRES = new Date("2027-03-01T00:00:00.000Z");
const READER_EXPIRY = new Date("2026-12-15T00:00:00.000Z");
const PERIOD_END = new Date("2027-02-01T00:00:00.000Z");
const TOKEN_EXPIRY = new Date("2026-11-15T09:00:00.000Z");
const VERIFY_USED_AT = new Date("2026-10-31T08:00:00.000Z");
const LAST_HIT_AT = new Date("2026-10-31T07:00:00.000Z");
const TX_TIME = new Date("2026-10-31T09:30:00.000Z");

// Canonical fixture payloads — round-tripped deep-equal per column kind.
const PROJECT_GENRES = ["gothic thriller", "historical"];
const DISMISSED_GUIDES = ["guide:plan-chapter", "guide:draft-chapter"];
const INTENTIONAL = {
  pov_headhop: { confirmed: true, purpose: "line-level voice bleed", timestamp: "2026-10-30T08:00:00.000Z" },
};
const AI_RULES = ["Never open on weather", "Withhold mercy"];
const MEMORY_STRUCTURED = {
  chapterTitle: "Low Water",
  charactersPresent: ["Marah Vance"],
  keyEvents: ["the ledger pact"],
  openPromisesCreated: ["the tide takes its due"],
  emotionalStateEnd: { "Marah Vance": "resolved" },
};
const HORSEMEN = { criticism: 2, contempt: 0, defensiveness: 1, stonewalling: 5 };
const SYNC_SNAPSHOT = {
  totalWordCount: 4110,
  chapterCount: 1,
  chapters: [{ id: "ch-low-water", title: "Low Water", wordCount: 4110, arcPosition: "dawn of desire" }],
  openThreadCount: 1,
  openPromises: 1,
  healthScore: 88,
};
const PLAN_BEATS = [
  { id: "b1", order: 1, label: "the ledger wakes" },
  { id: "b2", order: 2, label: "the tide argues" },
];

describe("table inventory — enumerated from the module's exports, cross-checked against the vendored DDL", () => {
  it("43 tables: every export is a drizzle table; export keys and physical names agree with SQLITE_DDL one-to-one", () => {
    const enumerated = enumeratedTables();
    const exportKeys = enumerated.map((t) => t.key).sort();
    const physicalNames = enumerated.map((t) => t.name).sort();

    // The hand-written amenity below is the EXPECTED list the runtime
    // enumeration must equal — a renamed/new/removed export fails here loudly
    // until the fixture (and the disposition map above) are updated.
    expect(exportKeys).toEqual(
      [
        "users", "accounts", "sessions", "projects", "characters", "locations", "plotThreads",
        "chapters", "editorNotes", "worldEntities", "referenceWorks", "generations",
        "storyTransactions", "storyChanges", "creatorBibles", "storyMemories",
        "characterEvolutionLog", "comicPages", "comicPanels", "productionShots", "audioExports",
        "videoAnalysisJobs", "readerSessions", "readerReactions", "showcases",
        "characterRelationships", "workPackets", "workPatterns", "storyThreads", "storyPromises",
        "subscriptions", "storyCheckpoints", "storyPlans", "seriesBibles", "referrals",
        "passwordResetTokens", "emailVerificationTokens", "platformEvents", "universes",
        "universeCharacters", "projectCharacterStates", "universeEvents", "semanticCache",
      ].sort(),
    );
    expect(physicalNames).toEqual(
      [
        "users", "accounts", "sessions", "projects", "characters", "locations", "plot_threads",
        "chapters", "editor_notes", "world_entities", "reference_works", "generations",
        "story_transactions", "story_changes", "creator_bibles", "story_memories",
        "character_evolution_log", "comic_pages", "comic_panels", "production_shots",
        "audio_exports", "video_analysis_jobs", "reader_sessions", "reader_reactions",
        "showcases", "character_relationships", "work_packets", "work_patterns", "story_threads",
        "story_promises", "subscriptions", "story_checkpoints", "story_plans", "series_bibles",
        "referrals", "password_reset_tokens", "email_verification_tokens", "platform_events",
        "universes", "universe_characters", "project_character_states", "universe_events",
        "semantic_cache",
      ].sort(),
    );

    // Schema ↔ DDL agreement: every enumerated table ships in the vendored DDL
    // and the DDL carries exactly 43 tables (the phase-2 baseline that grew
    // past the legacy probe's 41 with the §13.1 pair).
    const ddlNames = new Set(
      [...SQLITE_DDL.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]!),
    );
    expect(ddlNames.size).toBe(43);
    const missingFromDdl = enumerated.filter((t) => !ddlNames.has(t.name));
    expect(missingFromDdl).toEqual([]);
  });
});

describe("canonical fixture rows — parents (the seed-only FK-parent users table included)", () => {
  it("users + projects round-trip every column kind: $defaultFn uuid, real decimals, epoch-ms Dates, typed jsonb, boolean, nullable-null", async () => {
    const handle = fresh();
    const db = handle.db;

    const [user] = await db
      .insert(users)
      .values({
        email: "owner@round-trip.test",
        name: "Pagemaster",
        image: "https://cdn.test/avatars/owner.png",
        hashedPassword: "hash-fixture-not-a-real-secret",
        higgsfieldApiKey: "hf-key-fixture-not-real",
        higgsfieldApiSecret: "hf-secret-fixture-not-real",
        segmindApiKey: "seg-key-fixture-not-real",
        openaiApiKey: "oai-key-fixture-not-real",
        imageProviderId: "segmind_soul",
        ttsProviderId: "openai",
        trendIntelligenceKey: "trend-key-fixture-not-real",
        referralCode: "PAGE24",
        // real — decimals must survive (no integer squatting)
        monthlyGenerations: 12.75,
        monthlyGenerationsResetAt: LAST_HIT_AT,
        emailVerified: EMAIL_VERIFIED_AT,
        trialEndAt: TRIAL_END,
      })
      .returning();
    mark("users");

    // uuid via $defaultFn — generated at insert, a real uuid on the way out.
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    // notNullNow epoch-ms defaults arrive as real Dates.
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
    expect(user.monthlyGenerations).toBe(12.75);
    expect(user.monthlyGenerationsResetAt).toEqual(LAST_HIT_AT);
    expect(user.emailVerified).toEqual(EMAIL_VERIFIED_AT);
    expect(user.trialEndAt).toEqual(TRIAL_END);
    expect(user.imageProviderId).toBe("segmind_soul");

    const [project] = await db
      .insert(projects)
      .values({
        userId: user.id,
        name: "The Sundered Coast",
        genres: PROJECT_GENRES,
        format: "Novel",
        skillLevel: "advanced",
        notes: "tide tables on page 3",
        controllingIdea: "The past is a debt with compounding interest",
        dismissedGuideIds: DISMISSED_GUIDES,
        intentionalViolations: INTENTIONAL,
        aiRules: AI_RULES,
        isHiggsfieldProject: true,
        narratorVoice: "drop-cap romantic",
        narrativeStructure: "three-act",
        qualityGradingEnabled: true,
        aiismsCheck: true,
        storyType: "series",
        timelineSort: 3,
        phase: "phase-2",
        biggestChallenge: "calendar logic",
        aiInitiative: "Leads",
        densityLevel: "full",
      })
      .returning();
    mark("projects");

    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
    // jsonb→TEXT decoders arrive as the SAME typed shapes — never strings.
    expect(project.genres).toEqual(PROJECT_GENRES);
    expect(project.dismissedGuideIds).toEqual(DISMISSED_GUIDES);
    expect(project.intentionalViolations).toEqual(INTENTIONAL);
    expect(project.aiRules).toEqual(AI_RULES);
    // integer(mode:"boolean") arrives as true/false, never 0/1.
    expect(project.isHiggsfieldProject).toBe(true);
    expect(project.qualityGradingEnabled).toBe(true);
    expect(project.aiismsCheck).toBe(true);
    expect(project.timelineSort).toBe(3);
    // nullable columns never written stay null (not a default lie).
    expect(project.universeId).toBeNull();
    expect(project.contentRevision).toBeNull();
    expect(project.createdAt).toBeInstanceOf(Date);

    // The OMITTED notNull default pin: a project insert touching nothing but
    // the user reads back pg's every default, including the string default.
    const [other] = await db.insert(users).values({ email: "other@round-trip.test" }).returning();
    const [bare] = await db.insert(projects).values({ userId: other.id }).returning();
    expect(bare.name).toBe("Untitled Project");
    expect(bare.format).toBe("Novel");
    expect(bare.skillLevel).toBe("beginner");
    // json-mode zero-arg $type default decodes back to its [] / {} shapes.
    expect(bare.genres).toEqual([]);
    expect(bare.dismissedGuideIds).toEqual([]);
    expect(bare.intentionalViolations).toEqual({});
    expect(bare.aiRules).toEqual([]);
    expect(bare.isHiggsfieldProject).toBe(false);
  });
});

describe("canonical fixture rows — world bible + continuity cluster", () => {
  it("characters/locations/plot_threads/chapters/editor_notes/world_entities/reference_works/character_relationships round-trip their typed shapes", async () => {
    const handle = fresh();
    const db = handle.db;
    const [user] = await db.insert(users).values({ email: "bible@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: user.id }).returning();

    const [mara] = await db
      .insert(characters)
      .values({
        projectId: project.id,
        name: "Marah Vance",
        // the nullable-null pin: written null reads null — NOT the "" default.
        role: null,
        age: "34",
        appearance: "salt-stiffened braid",
        personality: "brisk, ledgered grief",
        thinkingStyle: "compartmentalised",
        behavior: "counts exits",
        habits: "annotates margins",
        fears: "calm water",
        desires: "a coast that stays mapped",
        speechPattern: "clipped nautical idiom",
        backstory: "survived the fan-flats",
        arc: "wants → needs",
        portraitUrl: "https://cdn.test/portraits/marah.png",
        soulId: "soul-marah",
        soulIdTrainingJobId: "job-marah",
        visualProfile: "warm dusk palette",
        voiceProfile: "steel with low resonance",
        voiceId: "voice-marah",
        structuralFunction: "proxagonist",
        voiceRegister: "low",
        voiceCompression: "tight",
        verbalTic: "quotes tide tables",
        linkedLocationIds: ["loc:fan-flats"],
        linkedPlotThreadIds: ["thread:gull-road"],
        alwaysInContext: true,
        sortOrder: 2,
        antagonistToggle: false,
        antagonistType: "",
        significantFlaws: ["can't witness grief unaided"],
        skills: [{ label: "surveying", level: 5 }],
        knowledgeMap: { "tidal debt": ["chapter 3", "chapter 7"] },
        intelligenceProfile: { pattern: "deductive", blindspot: "self-worth" },
        culturalWorldview: "wet pragmatism",
        characterWant: "a coast that stays mapped",
        characterNeed: "to stop counting",
        contradiction: "cartographs what she intends to abandon",
        narratorBlindSpot: "her own ledger humor",
        firstImpressionNote: "arrives counting",
        contextVisibility: "always",
      })
      .returning();
    mark("characters");

    expect(mara.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mara.role).toBeNull(); // null ≠ ""
    // json-mode typed shapes round-trip as the same arrays/objects.
    expect(mara.linkedLocationIds).toEqual(["loc:fan-flats"]);
    expect(mara.linkedPlotThreadIds).toEqual(["thread:gull-road"]);
    expect(mara.significantFlaws).toEqual(["can't witness grief unaided"]);
    expect(mara.skills).toEqual([{ label: "surveying", level: 5 }]);
    expect(mara.knowledgeMap).toEqual({ "tidal debt": ["chapter 3", "chapter 7"] });
    expect(mara.intelligenceProfile).toEqual({ pattern: "deductive", blindspot: "self-worth" });
    // booleans as booleans.
    expect(mara.alwaysInContext).toBe(true);
    expect(mara.antagonistToggle).toBe(false);
    expect(mara.sortOrder).toBe(2);

    const [sole] = await db
      .insert(characters)
      .values({ projectId: project.id, name: "Sole Attano" })
      .returning();
    // Omitted nullable-with-default string reads its default, not null.
    expect(sole.role).toBe("");
    expect(sole.alwaysInContext).toBe(true); // boolean DEFAULT true

    const [fanFlats] = await db
      .insert(locations)
      .values({
        projectId: project.id,
        name: "The Fan Flats",
        description: "terraced slums above the tide wall",
        atmosphere: "persistent brine",
        history: "founded on salvage rights",
        sensoryDetails: "cold iron, kelp smoke",
        linkedCharacterIds: [mara.id],
        alwaysInContext: false,
        sortOrder: 4,
      })
      .returning();
    mark("locations");
    expect(fanFlats.linkedCharacterIds).toEqual([mara.id]);
    expect(fanFlats.alwaysInContext).toBe(false);
    expect(fanFlats.sortOrder).toBe(4);

    const [gullRoad] = await db
      .insert(plotThreads)
      .values({
        projectId: project.id,
        name: "The Gull Road",
        description: "smuggling route ledger",
        status: "Active",
        stakes: "the whole ward's immunity",
        connections: "ties to Marah's salvage debt",
        alwaysInContext: true,
        sortOrder: 1,
        lastMentionedChapterId: "ch-low-water", // plain text on sqlite AND plain uuid on pg — no FK either side
        starvationWarning: true,
      })
      .returning();
    mark("plotThreads");
    expect(gullRoad.status).toBe("Active");
    expect(gullRoad.lastMentionedChapterId).toBe("ch-low-water");
    expect(gullRoad.starvationWarning).toBe(true);

    const [lowWater] = await db
      .insert(chapters)
      .values({
        projectId: project.id,
        title: "Chapter 1 — Low Water",
        content: "Marah counted the exits like debts.",
        summary: "Marah takes a job on a sinking coast",
        tags: ["low-water", "ledger"],
        sortOrder: 1,
        wordCount: 4110,
        branchLabel: "clean line",
        alternateDrafts: [{ revision: 2, excerpt: "She counted exits." }],
        emotionalTone: "tense",
        arcPosition: "dawn of desire",
        scenes: [{ slug: "tide-gate", wordTarget: 800 }],
        reviewStatus: "in_review",
      })
      .returning();
    mark("chapters");
    expect(lowWater.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(lowWater.tags).toEqual(["low-water", "ledger"]);
    expect(lowWater.alternateDrafts).toEqual([{ revision: 2, excerpt: "She counted exits." }]);
    expect(lowWater.scenes).toEqual([{ slug: "tide-gate", wordTarget: 800 }]);
    expect(lowWater.reviewStatus).toBe("in_review");
    expect(lowWater.wordCount).toBe(4110);
    expect(lowWater.parentChapterId).toBeNull();

    // The OMITTED notNull-defaults pin for chapters: a bare insert reads pg's
    // string defaults AND the json-mode [] defaults decoded from TEXT '[]'.
    const [bareChapter] = await db
      .insert(chapters)
      .values({ projectId: project.id })
      .returning();
    expect(bareChapter.title).toBe("Chapter 1");
    expect(bareChapter.chapterType).toBe("chapter");
    expect(bareChapter.reviewStatus).toBe("draft");
    expect(bareChapter.branchId).toBe("main");
    expect(bareChapter.wordCount).toBe(0);
    expect(bareChapter.sortOrder).toBe(0);
    expect(bareChapter.tags).toEqual([]);
    expect(bareChapter.alternateDrafts).toEqual([]);
    expect(bareChapter.scenes).toEqual([]);

    const [note] = await db
      .insert(editorNotes)
      .values({
        projectId: project.id,
        chapterId: lowWater.id,
        severity: "high",
        category: "continuity",
        message: "Marah's ledger count drifts from ch 3",
        suggestedFix: "recount via beat 4",
        status: "open",
        source: "quality-review",
      })
      .returning();
    mark("editorNotes");
    expect(note.severity).toBe("high");
    expect(note.message).toBe("Marah's ledger count drifts from ch 3");
    expect(note.status).toBe("open");
    // Omitted notNull-with-default column reads its default ("issue").
    expect(note.type).toBe("issue");

    const [ledger] = await db
      .insert(worldEntities)
      .values({
        projectId: project.id,
        kind: "weapon",
        name: "The Ledger",
        summary: "a pocket tally of debts",
        description: "clockwork attention",
        properties: { material: "brass", charge: "kinetic", rings: 3 },
        linkedCharacterIds: [mara.id],
        linkedEntityIds: [],
        alwaysInContext: false,
        sortOrder: 1,
      })
      .returning();
    mark("worldEntities");
    expect(ledger.kind).toBe("weapon");
    expect(ledger.properties).toEqual({ material: "brass", charge: "kinetic", rings: 3 });
    expect(ledger.linkedCharacterIds).toEqual([mara.id]);
    expect(ledger.linkedEntityIds).toEqual([]);
    expect(ledger.alwaysInContext).toBe(false);

    const [almanac] = await db
      .insert(referenceWorks)
      .values({
        projectId: project.id,
        title: "Tide Tables 1962",
        attributes: { genre: "nautical almanac", voice: "registry" },
      })
      .returning();
    mark("referenceWorks");
    expect(almanac.attributes).toEqual({ genre: "nautical almanac", voice: "registry" });

    const [relationship] = await db
      .insert(characterRelationships)
      .values({
        projectId: project.id,
        characterAId: mara.id,
        characterBId: sole.id,
        trustLevel: 62,
        relationshipType: "co-signers",
        fourHorsemen: HORSEMEN,
        notes: "shares one umbrella",
        powerDifferential: -2,
        emotionalRegister: "warmed coals",
        knowledgeAsymmetry: "Sole reads the tally by heart",
        dependencyStructure: "mutual owe",
        attachmentStyleA: "anxious",
        arcTrajectory: "toward repair",
      })
      .returning();
    mark("characterRelationships");
    expect(relationship.trustLevel).toBe(62);
    expect(relationship.fourHorsemen).toEqual(HORSEMEN);
    expect(relationship.powerDifferential).toBe(-2);
    expect(relationship.dependencyStructure).toBe("mutual owe");
  });
});

describe("canonical fixture rows — story OS cluster + the §13.1 audit pair through the REAL record adapter", () => {
  it("story_threads/promises/memories/checkpoints/plans round-trip typed shapes; the transaction rows ride makeSqliteStoryTransactionRepository.record()", async () => {
    const handle = fresh();
    const db = handle.db;
    const [user] = await db.insert(users).values({ email: "os@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: user.id }).returning();
    const [chapter] = await db
      .insert(chapters)
      .values({ id: "ch-low-water", projectId: project.id, title: "Low Water" })
      .returning();
    const [mara] = await db
      .insert(characters)
      .values({ id: "c-mara", projectId: project.id, name: "Marah Vance", age: "34" })
      .returning();
    const [ledger] = await db
      .insert(worldEntities)
      .values({
        id: "we-ledger",
        projectId: project.id,
        kind: "weapon",
        name: "The Ledger",
        properties: { material: "brass", rings: 3 },
      })
      .returning();

    const [thread] = await db
      .insert(storyThreads)
      .values({
        projectId: project.id,
        name: "The Long Night",
        threadType: "subplot",
        status: "open",
        openedAtChapterId: chapter.id, // plain text — NOT an FK on either engine
        notes: "sky lanterns",
      })
      .returning();
    mark("storyThreads");
    expect(thread.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(thread.threadType).toBe("subplot");
    expect(thread.status).toBe("open");
    expect(thread.openedAtChapterId).toBe(chapter.id);
    expect(thread.resolvedAtChapterId).toBeNull();

    const [promise] = await db
      .insert(storyPromises)
      .values({
        projectId: project.id,
        threadId: thread.id,
        setup: "the ledger settles debts nightly",
        payoffIntent: "the tide takes its due",
      })
      .returning();
    mark("storyPromises");
    expect(promise.threadId).toBe(thread.id);
    // Omitted notNull-with-default columns read their defaults.
    expect(promise.status).toBe("open");
    expect(promise.priority).toBe("B");
    expect(promise.payoffChapterId).toBeNull();

    const [memory] = await db
      .insert(storyMemories)
      .values({
        projectId: project.id,
        chapterId: chapter.id,
        fact: "The ledger settles debts nightly",
        category: "world rule",
        autoExtracted: false,
        chapterIndex: 4,
        structuredData: MEMORY_STRUCTURED,
      })
      .returning();
    mark("storyMemories");
    expect(memory.structuredData).toEqual(MEMORY_STRUCTURED);
    expect(memory.autoExtracted).toBe(false);
    expect(memory.chapterIndex).toBe(4);

    // The second memory: structuredData omitted → REAL null (no default lies).
    const [bareMemory] = await db
      .insert(storyMemories)
      .values({ projectId: project.id, fact: "Second memory" })
      .returning();
    expect(bareMemory.structuredData).toBeNull();
    expect(bareMemory.autoExtracted).toBe(true);
    expect(bareMemory.category).toBe("general");

    const [evolution] = await db
      .insert(characterEvolutionLog)
      .values({
        projectId: project.id,
        characterId: mara.id,
        chapterIndex: 5,
        triggerMemoryIds: ["memory:ledger"],
        previousState: { trust: 3 },
        updatedTraits: { trust: 4, voice: "quieter" },
        evolutionSummary: "she starts telling the truth",
      })
      .returning();
    mark("characterEvolutionLog");
    expect(evolution.triggerMemoryIds).toEqual(["memory:ledger"]);
    expect(evolution.previousState).toEqual({ trust: 3 });
    expect(evolution.updatedTraits).toEqual({ trust: 4, voice: "quieter" });

    const [checkpoint] = await db
      .insert(storyCheckpoints)
      .values({
        projectId: project.id,
        name: "After low water",
        notes: "before the ward",
        snapshot: SYNC_SNAPSHOT,
      })
      .returning();
    mark("storyCheckpoints");
    // The typed snapshot JSON rides back as the same object.
    expect(checkpoint.snapshot).toEqual(SYNC_SNAPSHOT);

    const [plan] = await db
      .insert(storyPlans)
      .values({
        projectId: project.id,
        kind: "beat_sheet",
        title: "Low Water beats",
        beats: PLAN_BEATS,
        status: "draft",
      })
      .returning();
    mark("storyPlans");
    expect(plan.beats).toEqual(PLAN_BEATS);
    expect(plan.status).toBe("draft");

    // §13.1 audit pair — legitimately produced ONLY through the adapter's
    // record() (handler-supplied transaction id, wire-string change values,
    // one atomic insert of the transaction AND its changes).
    const transactions = makeSqliteStoryTransactionRepository(db);
    const recorded: StoryTransaction = {
      id: "tx-fixture-1", // the deliberate non-$defaultFn PK: supplied verbatim
      projectId: project.id,
      source: "user-edit",
      createdAt: TX_TIME,
      sourceGenerationId: "gen-fixture-1",
      changes: [
        { entityKey: "characters", entityId: mara.id, field: "age", oldValue: "34", newValue: "late 30s" },
        {
          entityKey: "worldEntities",
          entityId: ledger.id,
          field: "properties",
          oldValue: "",
          newValue: '{"material":"brass","rings":3}',
        },
      ],
    };
    await transactions.record(recorded);
    mark("storyTransactions");

    const [txRow] = await db.select().from(storyTransactions);
    expect(txRow.id).toBe("tx-fixture-1"); // plain text PK, no uuid generation
    expect(txRow.projectId).toBe(project.id);
    expect(txRow.source).toBe("user-edit");
    expect(txRow.sourceGenerationId).toBe("gen-fixture-1");
    // The record's Date is verbatim — epoch-ms instant equality.
    expect(txRow.createdAt).toEqual(TX_TIME);

    mark("storyChanges");
    const changeRows = await db.select().from(storyChanges);
    expect(changeRows).toHaveLength(2);
    expect(changeRows.map((c) => c.seq)).toEqual([0, 1]);
    expect(changeRows.every((c) => c.transactionId === "tx-fixture-1")).toBe(true);
    // Denormalized project scoping rides on every change row.
    expect(changeRows.every((c) => c.projectId === project.id)).toBe(true);
    // Wire values stored verbatim as TEXT (audit strings, not decoded blobs —
    // the decode is applyChanges' moment, pinned by the trio suite).
    expect(changeRows.every((c) => typeof c.oldValue === "string")).toBe(true);
    expect(changeRows.every((c) => typeof c.newValue === "string")).toBe(true);
    expect(changeRows.map((c) => c.entityId).sort()).toEqual([ledger.id, mara.id].sort());
    // story_changes ids ride $defaultFn — the contrast with the transaction's
    // supplied plain-text id.
    expect(changeRows.every((c) => /^[0-9a-f-]{36}$/.test(c.id))).toBe(true);
    const ageChange = changeRows.find((c) => c.field === "age")!;
    expect(ageChange.entityKey).toBe("characters");
    expect(ageChange.oldValue).toBe("34");
    expect(ageChange.newValue).toBe("late 30s");
  });
});

describe("canonical fixture rows — media, sharing + generation cluster", () => {
  it("comic_pages/panels, production_shots, generations, audio_exports, reader sessions/reactions round-trip reals incl. decimals and candidate arrays", async () => {
    const handle = fresh();
    const db = handle.db;
    const [user] = await db.insert(users).values({ email: "media@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: user.id }).returning();
    const [chapter] = await db
      .insert(chapters)
      .values({ projectId: project.id, title: "Low Water" })
      .returning();
    const [mara] = await db
      .insert(characters)
      .values({ projectId: project.id, name: "Marah Vance" })
      .returning();

    const [page] = await db
      .insert(comicPages)
      .values({ projectId: project.id, chapterId: chapter.id, pageNumber: 2, artStyle: "ink wash" })
      .returning();
    mark("comicPages");
    expect(page.pageNumber).toBe(2);
    expect(page.artStyle).toBe("ink wash");

    const [panel] = await db
      .insert(comicPanels)
      .values({
        pageId: page.id,
        projectId: project.id,
        panelIndex: 3,
        imageUrl: "https://cdn.test/panels/low-water-3.png",
        panelPrompt: "the ledger in the lamplight",
        referenceImageUrl: "https://cdn.test/ref/marah.png",
        characterName: "Marah Vance",
        artStylePreset: "ink wash",
        dialogue: "Kinetic brass.",
        caption: "Night again, and the ledger wakes.",
        speakerName: "Marah Vance",
        letteredImageUrl: "https://cdn.test/panels/low-water-3-lettered.png",
        bubbleType: "shout",
        qualityScore: 0.87,
        qualityWeakest: "lamp glow coherence",
        qualityNote: "redraw the lamp pool",
        reviewStatus: "approved",
        candidateImageUrls: [
          "https://cdn.test/panels/low-water-3-c.png",
          "https://cdn.test/panels/low-water-3-d.png",
        ],
      })
      .returning();
    mark("comicPanels");
    expect(panel.panelIndex).toBe(3);
    // real keeps decimals.
    expect(panel.qualityScore).toBe(0.87);
    expect(panel.candidateImageUrls).toEqual([
      "https://cdn.test/panels/low-water-3-c.png",
      "https://cdn.test/panels/low-water-3-d.png",
    ]);
    expect(panel.reviewStatus).toBe("approved");

    // The bare panel pin: omitted notNull defaults + NULL-only real + the
    // json-mode [] DEFAULT decoded from TEXT '[]'.
    const [barePanel] = await db
      .insert(comicPanels)
      .values({
        pageId: page.id,
        projectId: project.id,
        panelIndex: 4,
        imageUrl: "https://cdn.test/panels/low-water-4.png",
        panelPrompt: "the door, counting",
      })
      .returning();
    expect(barePanel.qualityScore).toBeNull();
    expect(barePanel.reviewStatus).toBe("draft");
    expect(barePanel.candidateImageUrls).toEqual([]);
    expect(barePanel.bubbleType).toBe("speech");
    expect(barePanel.letteredImageUrl).toBe("");
    expect(barePanel.qualityNote).toBe("");

    const [shot] = await db
      .insert(productionShots)
      .values({
        projectId: project.id,
        chapterId: chapter.id,
        sceneNumber: 2,
        shotNumber: 5,
        shotType: "Low wide",
        cameraMovement: "slow push",
        lightingMood: "cold lantern",
        timeOfDay: "night",
        subject: "the ledger",
        action: "it rings",
        location: "The Fan Flats",
        mood: "held breath",
        primaryCharacterId: mara.id,
        soulPrompt: "Marah, cold lantern",
        videoPrompt: "push in: the ledger wakes",
        multiShotScript: "Shot 5: the ledger. Shot 6: the door.",
        dialogue: "It rings",
        speaker: "Marah Vance",
        previewImageUrl: "https://cdn.test/shots/low-water-5.png",
        generationStatus: "queued",
        higgsfieldJobId: "job-shot-low-water-5",
        cameraPreset: "35mm",
        characterEmotion: "resolve",
        focalLength: "35mm",
        duration: 6,
        qualityScore: 0.74,
        qualityWeakest: "lamp shimmer",
        reviewStatus: "needs_rework",
        candidatePreviewUrls: ["https://cdn.test/shots/low-water-5-c.png"],
        trimStartSec: 0.5,
        trimEndSec: 12.75,
        sceneAudioTrackUrl: "https://cdn.test/audio/tide-loop.mp3",
      })
      .returning();
    mark("productionShots");
    expect(shot.duration).toBe(6);
    expect(shot.primaryCharacterId).toBe(mara.id);
    expect(shot.trimStartSec).toBe(0.5);
    expect(shot.trimEndSec).toBe(12.75);
    expect(shot.candidatePreviewUrls).toEqual(["https://cdn.test/shots/low-water-5-c.png"]);
    expect(shot.qualityScore).toBe(0.74);
    expect(shot.reviewStatus).toBe("needs_rework");

    const [generation] = await db
      .insert(generations)
      .values({
        projectId: project.id,
        chapterId: chapter.id,
        mode: "write",
        prompt: "Continue: Marah counted the exits like debts.",
        output: "…the ledger rang.",
        model: "claude-sonnet-5",
        tokensUsed: 4821,
      })
      .returning();
    mark("generations");
    expect(generation.model).toBe("claude-sonnet-5");
    expect(generation.tokensUsed).toBe(4821);

    // audio_exports.chapterId is a bare NOT NULL text — NO FK on either engine
    // (pg's column is a plain uuid there too) — the value is the real chapter
    // id here, and the "honest dangling" behaviour is pinned in the cascade
    // block below.
    const [audio] = await db
      .insert(audioExports)
      .values({
        projectId: project.id,
        chapterId: chapter.id,
        mode: "podcast",
        status: "ready",
        audioUrl: "https://cdn.test/audio/low-water.mp3",
        durationSeconds: 1642,
        characterCount: 28890,
        estimatedCost: "$0.03",
        lipsyncVideoUrl: "https://cdn.test/lipsync/low-water.mp4",
        lipsyncJobId: "lipsync-low-water",
        lipsyncStatus: "done",
      })
      .returning();
    mark("audioExports");
    expect(audio.durationSeconds).toBe(1642);
    expect(audio.mode).toBe("podcast");

    const [session] = await db
      .insert(readerSessions)
      .values({
        projectId: project.id,
        token: "reader-token-fixture-low-water",
        expiresAt: READER_EXPIRY,
      })
      .returning();
    mark("readerSessions");
    expect(session.expiresAt).toEqual(READER_EXPIRY);

    const [reaction] = await db
      .insert(readerReactions)
      .values({ sessionId: session.id, chapterId: chapter.id, textOffset: 412, reactionType: "spine_tingler" })
      .returning();
    mark("readerReactions");
    expect(reaction.textOffset).toBe(412);
    expect(reaction.reactionType).toBe("spine_tingler");

    const [showcase] = await db
      .insert(showcases)
      .values({
        projectId: project.id,
        userId: user.id,
        slug: "sundered-coast",
        title: "The Sundered Coast",
        blurb: "gothic maritime thriller about compounding debts",
        visibility: "public",
        flagged: true,
        flagReason: "tone flag from the moderation queue",
      })
      .returning();
    mark("showcases");
    expect(showcase.visibility).toBe("public");
    expect(showcase.flagged).toBe(true);
    expect(showcase.flagReason).toBe("tone flag from the moderation queue");
  });
});

describe("canonical fixture rows — platform perimeter (the never-adapter-read surface)", () => {
  it("accounts/sessions/subscriptions/referrals/token rows/platform_events/work tables/video_analysis_jobs/creator bible/semantic_cache round-trip", async () => {
    const handle = fresh();
    const db = handle.db;
    const [owner] = await db.insert(users).values({ email: "perimeter@round-trip.test" }).returning();
    const [referee] = await db.insert(users).values({ email: "referee@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: owner.id }).returning();

    const [account] = await db
      .insert(accounts)
      .values({
        userId: owner.id,
        type: "oauth",
        provider: "google",
        providerAccountId: "10987654321",
        refresh_token: "refresh-fixture",
        access_token: "access-fixture",
        expires_at: 4102444800,
        token_type: "bearer",
        scope: "openid email profile",
        id_token: "id-token-fixture",
        session_state: "state-fixture",
      })
      .returning();
    mark("accounts");
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(account.expires_at).toBe(4102444800); // plain integer round-trips

    const [session] = await db
      .insert(sessions)
      .values({ sessionToken: "session-token-fixture", userId: owner.id, expires: SESSION_EXPIRES })
      .returning();
    mark("sessions");
    expect(session.expires).toEqual(SESSION_EXPIRES);

    const [subscription] = await db
      .insert(subscriptions)
      .values({
        userId: owner.id,
        razorpaySubscriptionId: "sub-fixture-rzp",
        razorpayPaymentId: "pay-fixture-rzp",
        tier: "story_pro",
        status: "active",
        currentPeriodEnd: PERIOD_END,
      })
      .returning();
    mark("subscriptions");
    expect(subscription.currentPeriodEnd).toEqual(PERIOD_END);
    expect(subscription.tier).toBe("story_pro");

    const [referral] = await db
      .insert(referrals)
      .values({ referrerId: owner.id, refereeId: referee.id, status: "rewarded", rewardApplied: true })
      .returning();
    mark("referrals");
    expect(referral.rewardApplied).toBe(true);
    expect(referral.status).toBe("rewarded");

    // password token: usedAt written null reads null (not an invented Date).
    const [reset] = await db
      .insert(passwordResetTokens)
      .values({ userId: owner.id, token: "reset-token-fixture", expiresAt: TOKEN_EXPIRY, usedAt: null })
      .returning();
    mark("passwordResetTokens");
    expect(reset.usedAt).toBeNull();
    expect(reset.expiresAt).toEqual(TOKEN_EXPIRY);

    const [verify] = await db
      .insert(emailVerificationTokens)
      .values({
        userId: owner.id,
        token: "verify-token-fixture",
        expiresAt: TOKEN_EXPIRY,
        usedAt: VERIFY_USED_AT,
      })
      .returning();
    mark("emailVerificationTokens");
    expect(verify.usedAt).toEqual(VERIFY_USED_AT);

    const [event] = await db
      .insert(platformEvents)
      .values({
        userId: owner.id,
        event: "generation.completed",
        properties: { tier: "story_pro", tokens: 4821, cacheHit: true },
      })
      .returning();
    mark("platformEvents");
    expect(event.properties).toEqual({ tier: "story_pro", tokens: 4821, cacheHit: true });

    const [packet] = await db
      .insert(workPackets)
      .values({
        userId: owner.id,
        title: "The Vulnerable Narrator",
        creator: "Carla Mendes",
        medium: "novel",
        genres: ["gothic"],
        craftPrinciples: [{ title: "withhold mercy", source: "act 2" }],
        structuralNotes: "pentad of debts",
        characterNotes: "everyone undercounts",
        dialogueNotes: "tidal cadence",
        thematicCore: "the sea keeps books",
        isPublic: true,
        status: "seeded",
      })
      .returning();
    mark("workPackets");
    expect(packet.craftPrinciples).toEqual([{ title: "withhold mercy", source: "act 2" }]);
    expect(packet.isPublic).toBe(true);

    const [pattern] = await db
      .insert(workPatterns)
      .values({
        name: "Counted Debt",
        description: "objects as ledgers of harm",
        medium: "cross-medium",
        genres: ["gothic"],
        supportingPacketIds: ["packet:the-vulnerable-narrator"],
        generationDirective: "surface the tally in scene endings",
        applicableTo: ["novel", "screenplay"],
        isPublic: true,
      })
      .returning();
    mark("workPatterns");
    expect(pattern.supportingPacketIds).toEqual(["packet:the-vulnerable-narrator"]);
    expect(pattern.applicableTo).toEqual(["novel", "screenplay"]);
    expect(pattern.isPublic).toBe(true);

    const [analysis] = await db
      .insert(videoAnalysisJobs)
      .values({
        userId: owner.id,
        youtubeUrl: "https://youtube.com/watch?v=round-trip-fixture",
        status: "done",
        result: { beats: 62, bridges: ["the ledger"], density: "high" },
      })
      .returning();
    mark("videoAnalysisJobs");
    expect(analysis.result).toEqual({ beats: 62, bridges: ["the ledger"], density: "high" });
    expect(analysis.errorMessage).toBeNull();

    const [bible] = await db
      .insert(creatorBibles)
      .values({
        projectId: project.id,
        channelName: "The Ledgership",
        niche: "nautical debt stories",
        audienceAge: "25-38",
        audienceInterests: "history, cartography",
        audiencePainPoints: "thin endings",
        channelVoice: "dry",
        contentPillars: ["cartography", "debt", "tides"],
        competitorNotes: "",
        defaultCta: "read on",
        cohostVoice: "none",
        hookMemory: ["first hook: the tide"],
        tiktokHandle: "@ledgership",
        tiktokNiche: "storycraft",
        soundStrategy: "tide loop",
      })
      .returning();
    mark("creatorBibles");
    expect(bible.contentPillars).toEqual(["cartography", "debt", "tides"]);
    expect(bible.hookMemory).toEqual(["first hook: the tide"]);
    expect(bible.cohostVoice).toBe("none");

    const [cacheHit] = await db
      .insert(semanticCache)
      .values({
        cacheType: "continuity-summary",
        inputKey: "hash:low-water:v1",
        cachedOutput: { summary: "…the ledger woke.", revision: 1 },
        hitCount: 2,
        lastHitAt: LAST_HIT_AT,
      })
      .returning();
    mark("semanticCache");
    expect(cacheHit.cachedOutput).toEqual({ summary: "…the ledger woke.", revision: 1 });
    expect(cacheHit.hitCount).toBe(2);
    expect(cacheHit.lastHitAt).toEqual(LAST_HIT_AT);

    // The omitted-default row: hitCount reads its 0 default, lastHitAt stays null.
    const [bareCache] = await db
      .insert(semanticCache)
      .values({ cacheType: "continuity-summary", inputKey: "hash:bare:v1", cachedOutput: { summary: "" } })
      .returning();
    expect(bareCache.hitCount).toBe(0);
    expect(bareCache.lastHitAt).toBeNull();
  });
});

describe("canonical fixture rows — series + universe cluster", () => {
  it("universes/universe_characters/project_character_states/universe_events/series_bibles round-trip typed shapes", async () => {
    const handle = fresh();
    const db = handle.db;
    const [user] = await db.insert(users).values({ email: "series@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: user.id }).returning();

    const [universe] = await db
      .insert(universes)
      .values({
        userId: user.id,
        name: "The Tidewright Sea",
        premise: "the sea keeps books",
        sharedRules: ["the ledger cannot lie", "tides settle at midnight"],
        tone: "brine and brass",
      })
      .returning();
    mark("universes");
    expect(universe.sharedRules).toEqual(["the ledger cannot lie", "tides settle at midnight"]);

    const [universeChar] = await db
      .insert(universeCharacters)
      .values({
        universeId: universe.id,
        name: "Marah Vance (universal)",
        baseProfile: { craft: "cartography", age: "34" },
        isAlive: true,
      })
      .returning();
    mark("universeCharacters");
    expect(universeChar.baseProfile).toEqual({ craft: "cartography", age: "34" });
    expect(universeChar.isAlive).toBe(true);

    const [state] = await db
      .insert(projectCharacterStates)
      .values({
        projectId: project.id,
        universeCharId: universeChar.id,
        knowledgeOverride: { knows: "the pact" },
        emotionalState: "resolute",
        stateNotes: "after low water",
        isDeceased: false,
      })
      .returning();
    mark("projectCharacterStates");
    expect(state.knowledgeOverride).toEqual({ knows: "the pact" });
    expect(state.isDeceased).toBe(false);
    expect(state.emotionalState).toBe("resolute");

    const [event] = await db
      .insert(universeEvents)
      .values({
        universeId: universe.id,
        projectId: project.id,
        name: "The pact at the tide gate",
        description: "sealing",
        timelineSort: 7,
        isCanon: true,
      })
      .returning();
    mark("universeEvents");
    expect(event.timelineSort).toBe(7);
    expect(event.isCanon).toBe(true);
    expect(event.projectId).toBe(project.id);

    const [seriesBible] = await db
      .insert(seriesBibles)
      .values({
        userId: user.id,
        name: "Tidewright Cycle",
        premise: "the sea keeps books",
        tone: "brine and brass",
        worldRules: ["tides settle debts at midnight"],
        seriesCharacterArcs: [
          { characterName: "Marah Vance", arcSummary: "wants → needs", booksInvolved: ["Low Water"] },
        ],
        continuityNotes: "the ledger never skips a name",
        projectIds: [project.id],
        timeline: [{ event: "the pact", period: "before ch 1", projectId: project.id }],
      })
      .returning();
    mark("seriesBibles");
    expect(seriesBible.worldRules).toEqual(["tides settle debts at midnight"]);
    expect(seriesBible.seriesCharacterArcs).toEqual([
      { characterName: "Marah Vance", arcSummary: "wants → needs", booksInvolved: ["Low Water"] },
    ]);
    expect(seriesBible.projectIds).toEqual([project.id]);
    expect(seriesBible.timeline).toEqual([
      { event: "the pact", period: "before ch 1", projectId: project.id },
    ]);
  });
});

describe("real-DB-specific — FK cascade reachability for the GRANDPARENTS the parity suites never covered", () => {
  it("deleting the USER kills its periphery (accounts/sessions/subscriptions/referrals/books/patterns/tokens/video jobs + the universe chain); platform_events survives with the FK NULLed (set null)", async () => {
    const handle = fresh();
    const db = handle.db;
    const [owner] = await db.insert(users).values({ email: "owner@cascade.test" }).returning();
    const [other] = await db.insert(users).values({ email: "other@cascade.test" }).returning();
    const [ownerEvent] = await db
      .insert(platformEvents)
      .values({ userId: owner.id, event: "generation.completed", properties: { tier: "story_pro" } })
      .returning();
    await db
      .insert(platformEvents)
      .values({ userId: other.id, event: "generation.completed", properties: { tier: "free" } });

    const [project] = await db.insert(projects).values({ userId: owner.id }).returning();
    await db.insert(accounts).values({ userId: owner.id, type: "oauth", provider: "google", providerAccountId: "1" });
    await db.insert(sessions).values({ sessionToken: "token-owner", userId: owner.id, expires: SESSION_EXPIRES });
    await db.insert(subscriptions).values({ userId: owner.id, tier: "story_pro", status: "active" });
    // Both referral positions die with the owner; the other→other row survives.
    await db.insert(referrals).values({ referrerId: owner.id, refereeId: other.id });
    await db.insert(referrals).values({ referrerId: other.id, refereeId: owner.id });
    await db.insert(referrals).values({ referrerId: other.id, refereeId: other.id });
    const [universe] = await db.insert(universes).values({ userId: owner.id, name: "Tidewright Sea" }).returning();
    const [universeChar] = await db
      .insert(universeCharacters)
      .values({ universeId: universe.id, name: "Marah (universal)" })
      .returning();
    await db
      .insert(projectCharacterStates)
      .values({ projectId: project.id, universeCharId: universeChar.id });
    await db.insert(universeEvents).values({ universeId: universe.id, projectId: project.id, name: "the pact", timelineSort: 1 });
    await db.insert(seriesBibles).values({ userId: owner.id, name: "Tidewright Cycle" });
    await db.insert(workPackets).values({ userId: owner.id, title: "The Vulnerable Narrator", medium: "novel" });
    await db.insert(videoAnalysisJobs).values({ userId: owner.id, youtubeUrl: "https://youtube.com/watch?v=cascade" });
    await db.insert(passwordResetTokens).values({ userId: owner.id, token: "reset-owner", expiresAt: TOKEN_EXPIRY });
    await db.insert(emailVerificationTokens).values({ userId: owner.id, token: "verify-owner", expiresAt: TOKEN_EXPIRY });

    await db.delete(users).where(eq(users.id, owner.id));

    // Everything keyed to the user is gone — including the level-two chain
    // (project → projectCharacterStates, universe → universeCharacters/events).
    expect(await db.select().from(accounts)).toEqual([]);
    expect(await db.select().from(sessions)).toEqual([]);
    expect(await db.select().from(subscriptions)).toEqual([]);
    expect(await db.select().from(universes)).toEqual([]);
    expect(await db.select().from(universeCharacters)).toEqual([]);
    expect(await db.select().from(projectCharacterStates)).toEqual([]);
    expect(await db.select().from(universeEvents)).toEqual([]);
    expect(await db.select().from(seriesBibles)).toEqual([]);
    expect(await db.select().from(workPackets)).toEqual([]);
    expect(await db.select().from(videoAnalysisJobs)).toEqual([]);
    expect(await db.select().from(passwordResetTokens)).toEqual([]);
    expect(await db.select().from(emailVerificationTokens)).toEqual([]);
    expect(await db.select().from(projects)).toEqual([]);
    // referrals: both owner-positioned links die; the other→other row survives.
    const leftReferrals = await db.select().from(referrals);
    expect(leftReferrals.map((r) => `${r.referrerId}>${r.refereeId}`)).toEqual([`${other.id}>${other.id}`]);
    // The surviving user is untouched.
    expect((await db.select().from(users)).map((u) => u.id)).toEqual([other.id]);
    // platform_events is SET NULL: the owner's event survives with userId null
    // (a nullable FK cleared to NULL, never the row deleted, never "0").
    const events = await db.select().from(platformEvents);
    expect(events).toHaveLength(2);
    const survivedOwnerEvent = events.find((e) => e.id === ownerEvent.id)!;
    expect(survivedOwnerEvent.userId).toBeNull();
  });

  it("deleting the PROJECT kills the story-domain children the parity suites skipped; universe_events survives with projectId NULLed", async () => {
    const handle = fresh();
    const db = handle.db;
    const [owner] = await db.insert(users).values({ email: "proj-cascade@round-trip.test" }).returning();
    const [other] = await db.insert(users).values({ email: "alien-cascade@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: owner.id }).returning();
    const [alien] = await db.insert(projects).values({ userId: other.id }).returning();
    // Alien control: another project's rows never move.
    await db.insert(referenceWorks).values({ projectId: alien.id, title: "Alien control" });

    const [chapter] = await db
      .insert(chapters)
      .values({ projectId: project.id, title: "Low Water" })
      .returning();
    const [mara] = await db
      .insert(characters)
      .values({ projectId: project.id, name: "Marah Vance" })
      .returning();
    await db.insert(creatorBibles).values({ projectId: project.id, channelName: "The Ledgership" });
    await db.insert(editorNotes).values({ projectId: project.id, chapterId: chapter.id, message: "count drifts" });
    await db
      .insert(generations)
      .values({ projectId: project.id, chapterId: chapter.id, mode: "write", prompt: "p", output: "o" });
    await db.insert(audioExports).values({ projectId: project.id, chapterId: chapter.id });
    const [session] = await db
      .insert(readerSessions)
      .values({ projectId: project.id, token: "token-project-cascade", expiresAt: READER_EXPIRY })
      .returning();
    await db
      .insert(readerReactions)
      .values({ sessionId: session.id, chapterId: chapter.id, textOffset: 10, reactionType: "spine_tingler" });
    await db
      .insert(characterEvolutionLog)
      .values({ projectId: project.id, characterId: mara.id, chapterIndex: 4, evolutionSummary: "quieter" });
    // The universe chain: universe + character live under the USER (they must
    // survive the project), while the per-project join row dies with it.
    const [universe] = await db.insert(universes).values({ userId: owner.id, name: "Tidewright Sea" }).returning();
    const [universeChar] = await db
      .insert(universeCharacters)
      .values({ universeId: universe.id, name: "Marah (universal)" })
      .returning();
    await db
      .insert(projectCharacterStates)
      .values({ projectId: project.id, universeCharId: universeChar.id });
    const [events] = await db
      .insert(universeEvents)
      .values({ universeId: universe.id, projectId: project.id, name: "the pact", timelineSort: 1 })
      .returning();

    await db.delete(projects).where(eq(projects.id, project.id));

    // The clustered, never-pinned-elsewhere children die with the project.
    expect(await db.select().from(editorNotes)).toEqual([]);
    expect(await db.select().from(generations)).toEqual([]);
    expect(await db.select().from(audioExports)).toEqual([]);
    expect(await db.select().from(readerSessions)).toEqual([]);
    expect(await db.select().from(readerReactions)).toEqual([]);
    expect(await db.select().from(characterEvolutionLog)).toEqual([]);
    expect(await db.select().from(creatorBibles)).toEqual([]);
    expect(await db.select().from(projectCharacterStates)).toEqual([]);
    // But the universe-side rows above the project survive, and universe_events
    // is SET NULLed — its project link cleared to NULL without dying.
    expect((await db.select().from(universeCharacters)).map((u) => u.id)).toEqual([universeChar.id]);
    expect((await db.select().from(universes)).map((u) => u.id)).toEqual([universe.id]);
    const leftEvents = await db.select().from(universeEvents);
    expect(leftEvents).toHaveLength(1);
    expect(leftEvents[0]!.id).toBe(events.id);
    expect(leftEvents[0]!.projectId).toBeNull();
    // The alien project's control row never moved.
    const alienRows = await db.select().from(referenceWorks);
    expect(alienRows.map((r) => r.title)).toEqual(["Alien control"]);
  });

  it("deleting the CHAPTER cascades editor_notes/comic_pages/reader_reactions, SET NULLs generations/story_memories/production_shots, and leaves audio_exports' FK-LESS chapterId honestly dangling", async () => {
    const handle = fresh();
    const db = handle.db;
    const [user] = await db.insert(users).values({ email: "chapter-cascade@round-trip.test" }).returning();
    const [project] = await db.insert(projects).values({ userId: user.id }).returning();
    const [doomed] = await db
      .insert(chapters)
      .values({ id: "ch-doomed", projectId: project.id, title: "Low Water" })
      .returning();
    const [survivor] = await db
      .insert(chapters)
      .values({ projectId: project.id, title: "High Water" })
      .returning();

    await db.insert(editorNotes).values({ projectId: project.id, chapterId: doomed.id, message: "drift" });
    await db.insert(comicPages).values({ projectId: project.id, chapterId: doomed.id, pageNumber: 1 });
    const [session] = await db
      .insert(readerSessions)
      .values({ projectId: project.id, token: "token-chapter-cascade", expiresAt: READER_EXPIRY })
      .returning();
    await db
      .insert(readerReactions)
      .values({ sessionId: session.id, chapterId: doomed.id, textOffset: 5, reactionType: "spine_tingler" });
    await db
      .insert(generations)
      .values({ projectId: project.id, chapterId: doomed.id, mode: "write", prompt: "p", output: "o" });
    await db
      .insert(storyMemories)
      .values({ projectId: project.id, chapterId: doomed.id, fact: "the ledger settles nightly" });
    await db.insert(productionShots).values({ projectId: project.id, chapterId: doomed.id, subject: "the ledger" });
    const [audio] = await db
      .insert(audioExports)
      .values({ projectId: project.id, chapterId: doomed.id })
      .returning();
    const [thread] = await db
      .insert(storyThreads)
      .values({ projectId: project.id, openedAtChapterId: doomed.id, name: "The Gull Road" })
      .returning();
    await db
      .insert(storyPromises)
      .values({ projectId: project.id, threadId: thread.id, setup: "the tide takes its due" });

    await db.delete(chapters).where(eq(chapters.id, doomed.id));

    // Children whose FK is ON DELETE cascade die WITH the chapter.
    expect(await db.select().from(editorNotes)).toEqual([]);
    expect(await db.select().from(comicPages)).toEqual([]); // (page→panel cascade is pair 6's pin)
    expect(await db.select().from(readerReactions)).toEqual([]);
    // Children whose FK is ON DELETE SET NULL survive, links cleared to null.
    const [generation] = await db.select().from(generations);
    expect(generation.chapterId).toBeNull();
    const [memory] = await db.select().from(storyMemories);
    expect(memory.chapterId).toBeNull();
    const [shot] = await db.select().from(productionShots);
    expect(shot.chapterId).toBeNull();
    // The reader session itself never keyed to the chapter — it survives.
    expect((await db.select().from(readerSessions)).map((s) => s.id)).toEqual([session.id]);
    // And the FK-LESS id columns (audio_exports.chapterId, story_threads.
    // openedAtChapterId — bare text/uuid on pg IDENTICALLY) keep the dead
    // chapter's id verbatim: an honest dangling reference, never a lie.
    const [audioLeft] = await db.select().from(audioExports);
    expect(audioLeft.chapterId).toBe(doomed.id);
    const [threadLeft] = await db.select().from(storyThreads);
    expect(threadLeft.openedAtChapterId).toBe(doomed.id);
    // The chapter's sibling (same project) never moved — the cascade is
    // targeted at the deleted row, not the table.
    expect((await db.select().from(chapters)).map((c) => c.id)).toEqual([survivor.id]);
  });

  it("story_threads → story_promises ships as set null in the DDL (the behavioural pin belongs to the story-OS parity suite)", () => {
    const clauseBlock = SQLITE_DDL.slice(
      SQLITE_DDL.indexOf('CREATE TABLE "story_promises"'),
      SQLITE_DDL.indexOf("CREATE TABLE", SQLITE_DDL.indexOf('CREATE TABLE "story_promises"') + 1),
    );
    expect(clauseBlock).toContain('FOREIGN KEY ("thread_id") REFERENCES "story_threads"("id")');
    expect(clauseBlock).toContain("ON DELETE set null");
  });
});

describe("fixture coverage — the runtime table list is fully exercised by this file", () => {
  it("every enumerated table in sqlite-schema.ts was round-tripped above", () => {
    const keys = enumeratedTables().map((t) => t.key).sort();
    // Runs last among the data tests (declaration order): every insert site
    // above marks its table, so this pin holds the fixture surface EQUAL to
    // the module surface — a new table export fails here until a row is added.
    expect([...ROUND_TRIPPED].sort()).toEqual(keys);
  });
});

describe("source purity of the sqlite layer (live-shell-reachability convention)", () => {
  // This fixture lives in __tests__ and is deliberately NOT in the grep list;
  // the FILES set is the trio suite's cumulative list, mirrored unmodified so
  // pair-by-pair integration never touches an already-landed suite.
  const FILES = [
    join(__dirname, "../../../db/sqlite.ts"),
    join(__dirname, "../../../db/sqlite-schema.ts"),
    join(__dirname, "../../../db/sqlite-ddl.ts"),
    join(__dirname, "../sqlite-character-location-repos.ts"),
    join(__dirname, "../sqlite-thread-reference-repos.ts"),
    join(__dirname, "../sqlite-world-entity-repos.ts"),
    join(__dirname, "../sqlite-relationship-repos.ts"),
    join(__dirname, "../sqlite-project-crud.ts"),
    join(__dirname, "../sqlite-comic-repos.ts"),
    join(__dirname, "../sqlite-production-shot-repos.ts"),
    join(__dirname, "../sqlite-story-os-repos.ts"),
    join(__dirname, "../sqlite-repositories.ts"),
  ];

  it("the sqlite layer never imports the Neon side or the Next runtime", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf-8");
      // Exact `@/db` alias (quote-delimited) and the pg schema alias — the
      // sqlite layer's legitimate imports are `@/db/sqlite` /
      // `@/db/sqlite-schema` / `@/db/sqlite-ddl`, which these regexes
      // deliberately do not match.
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  }, 20000);
});

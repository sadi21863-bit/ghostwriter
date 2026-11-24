/**
 * Master-plan Phase 3's last §10/§10.1 piece — the canonical portable project
 * snapshot — verified at THREE layers over REAL SQLite databases:
 *
 *  - the envelope contract: versioned shape, kinds in FK order, SHA-256
 *    checksum self-consistency, the 20-collection include-list (and its
 *    documented exclusions riding NOWHERE);
 *  - the round-trip: export from a seeded canon across ALL 20 collections →
 *    import into a FRESH db → per-collection deep set-equality, ids preserved
 *    verbatim, the project re-owned by the destination's owner (never the
 *    source's cloud userId), ONE §11.1 contentRevision bump, and a re-export
 *    that byte-agrees with the original checksum (determinism across
 *    independent DBs, not just a same-row tautology);
 *  - validation + transport: the 400 family (bad format/version/missing/
 *    duplicated kind/tampered checksum/non-object rows), the 403 scoping rule,
 *    the 409 re-import conflict, the 404 foreign-owner read (stage (d)'s
 *    adversarial pin, now for reads too), and the 501-by-default mount pair —
 *    exercised through `dispatchLoopback` (no socket needed).
 *
 * The all-empty import doubles as the port's kind→table-map completeness pin:
 * the writer walks the HANDLER's own kind list, so an unmapped kind would
 * throw before any row lands.
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import {
  users,
  projects,
  chapters,
  characters,
  locations,
  plotThreads,
  storyThreads,
  storyPromises,
  editorNotes,
  worldEntities,
  referenceWorks,
  storyMemories,
  characterEvolutionLog,
  storyCheckpoints,
  storyPlans,
  comicPages,
  comicPanels,
  productionShots,
  storyTransactions,
  storyChanges,
  characterRelationships,
  // The deliberately EXCLUDED surfaces (seeded in the source db to prove the
  // include-list leaves them behind, not silently shipped):
  generations,
  showcases,
  audioExports,
  readerSessions,
  readerReactions,
  creatorBibles,
  universes,
  universeCharacters,
  universeEvents,
  projectCharacterStates,
} from "@/db/sqlite-schema";
import {
  SNAPSHOT_COLLECTIONS,
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  exportProjectSnapshot,
  importProjectSnapshot,
  snapshotChecksum,
  type ProjectSnapshotEnvelope,
} from "@/lib/core/handlers/portability";
import { makeSqliteProjectSnapshotPort } from "@/lib/core/sqlite-project-snapshot";
import { dispatchLoopback, defaultLocalRoutes, type DefaultRouteDeps } from "@/lib/core/local-host";
import type { RequestContext } from "@/lib/core/request-context";

const OWNED_AT = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));

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

async function seedOwner(handle: SqliteDbHandle, email: string): Promise<string> {
  const [row] = await handle.db
    .insert(users)
    .values({ id: uid("u"), email })
    .returning();
  return row!.id;
}

/**
 * A compact but REAL canon: at least one row in every included collection,
 * exercising the shape trap classes the §4.3 fixture pins (nulls, reals,
 * json-mode objects/arrays, set-null FKs, client-set transaction ids) — plus
 * rows in the EXCLUDED surfaces, which the export must leave behind.
 */
async function seedCanonicalProject(handle: SqliteDbHandle, ownerId: string): Promise<string> {
  const [project] = await handle.db
    .insert(projects)
    .values({
      id: uid("p"),
      userId: ownerId,
      name: "Snapshot Canon",
      format: "Novel",
      genres: ["thriller"],
      notes: "exported project",
      intentionalViolations: { continuity: { confirmed: true, purpose: "test", timestamp: OWNED_AT.toISOString() } },
      contentRevision: 5,
      createdAt: OWNED_AT,
      updatedAt: OWNED_AT,
    })
    .returning();
  const pid = project!.id;

  const [ch1] = await handle.db
    .insert(chapters)
    .values({
      id: uid("ch"), projectId: pid, title: "One", content: "first", summary: "s1",
      tags: ["a", "b"], scenes: [{ beat: "open" }], alternateDrafts: [],
      chapterType: "chapter", sortOrder: 1, wordCount: 120, reviewStatus: "approved",
      createdAt: OWNED_AT, updatedAt: OWNED_AT,
    })
    .returning();
  const [ch2] = await handle.db
    .insert(chapters)
    .values({ id: uid("ch"), projectId: pid, title: "Two", sortOrder: 2, reviewStatus: "draft", createdAt: OWNED_AT, updatedAt: OWNED_AT })
    .returning();
  const [ch3] = await handle.db
    .insert(chapters)
    .values({ id: uid("ch"), projectId: pid, title: "Three", sortOrder: 3, reviewStatus: "in_review", createdAt: OWNED_AT, updatedAt: OWNED_AT })
    .returning();
  void ch3;

  const [c1] = await handle.db
    .insert(characters)
    .values({
      id: uid("c"), projectId: pid, name: "Vera", role: "protagonist",
      linkedLocationIds: ["loc-1"], linkedPlotThreadIds: [], skills: [], significantFlaws: [],
      knowledgeMap: {}, intelligenceProfile: {}, alwaysInContext: true,
      createdAt: OWNED_AT, updatedAt: OWNED_AT,
    })
    .returning();
  const [c2] = await handle.db
    .insert(characters)
    .values({ id: uid("c"), projectId: pid, name: "Moss", role: "antagonist", alwaysInContext: true, createdAt: OWNED_AT, updatedAt: OWNED_AT })
    .returning();
  void c2;

  const [l1] = await handle.db
    .insert(locations)
    .values({ id: uid("loc"), projectId: pid, name: "Harbor", description: "docks", linkedCharacterIds: [c1!.id], createdAt: OWNED_AT, updatedAt: OWNED_AT })
    .returning();
  void l1;

  await handle.db.insert(plotThreads).values({
    id: uid("pt"), projectId: pid, name: "Debt", status: "Active",
    lastMentionedChapterId: ch2!.id, createdAt: OWNED_AT, updatedAt: OWNED_AT,
  });

  await handle.db.insert(storyThreads).values([
    { id: uid("st"), projectId: pid, name: "Knife thread", threadType: "subplot", openedAtChapterId: ch1!.id, createdAt: OWNED_AT },
    { id: uid("st"), projectId: pid, name: "Signal thread", status: "resolved", resolvedAtChapterId: ch2!.id, createdAt: OWNED_AT },
  ]);

  await handle.db.insert(storyPromises).values([
    { id: uid("sp"), projectId: pid, threadId: null, setup: "the knife must cut", setupChapterId: ch1!.id, payoffChapterId: null, createdAt: OWNED_AT },
    { id: uid("sp"), projectId: pid, setup: "signal resolves", status: "resolved", payoffChapterId: ch2!.id, createdAt: OWNED_AT },
  ]);

  await handle.db.insert(editorNotes).values([
    { id: uid("en"), projectId: pid, chapterId: ch1!.id, type: "issue", severity: "high", category: "continuity", message: "the knife vanished", createdAt: OWNED_AT, updatedAt: OWNED_AT },
    { id: uid("en"), projectId: pid, message: "tension flat in scene 2", createdAt: OWNED_AT, updatedAt: OWNED_AT },
  ]);

  await handle.db.insert(worldEntities).values([
    {
      id: uid("we"), projectId: pid, kind: "weapon", name: "Kinetic deck", summary: "cards as weapons",
      properties: { material: "laminate", rpm: 15000 },
      linkedCharacterIds: [c1!.id], linkedLocationIds: [], linkedPlotThreadIds: [], linkedEntityIds: [],
      createdAt: OWNED_AT, updatedAt: OWNED_AT,
    },
    { id: uid("we"), projectId: pid, kind: "organization", name: "Deck guild", properties: {}, createdAt: OWNED_AT, updatedAt: OWNED_AT },
  ]);

  await handle.db.insert(referenceWorks).values([
    { id: uid("rw"), projectId: pid, title: "Le Carre — The Spy", attributes: { medium: "novel" }, createdAt: OWNED_AT },
    { id: uid("rw"), projectId: pid, title: "John Wick", attributes: {}, createdAt: OWNED_AT },
  ]);

  await handle.db.insert(characterRelationships).values([
    {
      id: uid("cr"), projectId: pid, characterAId: c1!.id, characterBId: c2!.id, trustLevel: 12,
      fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
      relationshipType: "rivals", powerDifferential: -1, updatedAt: OWNED_AT,
    },
    { id: uid("cr"), projectId: pid, characterAId: c2!.id, characterBId: c1!.id, updatedAt: OWNED_AT },
  ]);

  await handle.db.insert(storyMemories).values([
    {
      id: uid("sm"), projectId: pid, chapterId: ch1!.id, fact: "Vera threw the Ricochet Cascade",
      category: "events", autoExtracted: false, chapterIndex: 1,
      structuredData: { chapterTitle: "One", keyEvents: ["throw"], emotionalStateEnd: { Vera: "cold" } },
      createdAt: OWNED_AT,
    },
    { id: uid("sm"), projectId: pid, chapterId: null, fact: "the harbor froze", structuredData: null, createdAt: OWNED_AT },
  ]);

  await handle.db.insert(characterEvolutionLog).values([
    {
      id: uid("ce"), projectId: pid, characterId: c1!.id, chapterIndex: 2,
      triggerMemoryIds: [uid("sm")], previousState: { calm: true }, updatedTraits: { calm: false },
      evolutionSummary: "hardened", createdAt: OWNED_AT,
    },
    { id: uid("ce"), projectId: pid, characterId: c2!.id, chapterIndex: 1, previousState: {}, updatedTraits: {}, evolutionSummary: "", createdAt: OWNED_AT },
  ]);

  await handle.db.insert(storyCheckpoints).values([
    {
      id: uid("scp"), projectId: pid, name: "midpoint", notes: "n",
      snapshot: { totalWordCount: 120, chapterCount: 3, chapters: [{ id: ch1!.id, title: "One", wordCount: 120, arcPosition: "act2" }], openThreadCount: 1, openPromises: 1, healthScore: 62 },
      createdAt: OWNED_AT,
    },
  ]);

  await handle.db.insert(storyPlans).values([
    { id: uid("spl"), projectId: pid, kind: "beat_sheet", title: "Beat Sheet", beats: [{ beat: "inciting" }], status: "final", createdAt: OWNED_AT, updatedAt: OWNED_AT },
    { id: uid("spl"), projectId: pid, beats: [], createdAt: OWNED_AT, updatedAt: OWNED_AT },
  ]);

  const [page1] = await handle.db
    .insert(comicPages)
    .values({ id: uid("cp"), projectId: pid, chapterId: ch1!.id, pageNumber: 1, artStyle: "manga", createdAt: OWNED_AT })
    .returning();
  const [page2] = await handle.db
    .insert(comicPages)
    .values({ id: uid("cp"), projectId: pid, chapterId: ch2!.id, createdAt: OWNED_AT })
    .returning();

  await handle.db.insert(comicPanels).values([
    {
      id: uid("cd"), pageId: page1!.id, projectId: pid, panelIndex: 1, imageUrl: "blob://panel-1",
      panelPrompt: "throw pose", dialogue: "watch", caption: "", speakerName: "Vera",
      letteredImageUrl: "blob://p1-lettered", bubbleType: "shout", qualityScore: 0.82,
      qualityWeakest: null, qualityNote: "", reviewStatus: "approved",
      candidateImageUrls: ["blob://panel-1a", "blob://panel-1b"], characterName: "Vera", createdAt: OWNED_AT,
    },
    {
      id: uid("cd"), pageId: page2!.id, projectId: pid, panelIndex: 2, imageUrl: "blob://panel-2",
      panelPrompt: "aftermath", qualityScore: null, reviewStatus: "draft", characterName: "", createdAt: OWNED_AT,
    },
  ]);

  await handle.db.insert(productionShots).values([
    {
      id: uid("shot"), projectId: pid, chapterId: ch1!.id, sceneNumber: 1, shotNumber: 1,
      subject: "Vera throws", action: "laminar card throw", primaryCharacterId: c1!.id,
      trimStartSec: 0.5, trimEndSec: null, qualityScore: 0.55, reviewStatus: "draft",
      candidatePreviewUrls: ["blob://s1a", "blob://s1b"], duration: 5, createdAt: OWNED_AT, updatedAt: OWNED_AT,
    },
    {
      id: uid("shot"), projectId: pid, chapterId: null, sceneNumber: 1, shotNumber: 2,
      primaryCharacterId: null, trimStartSec: null, trimEndSec: null, duration: 5,
      createdAt: OWNED_AT, updatedAt: OWNED_AT,
    },
  ]);

  await handle.db.insert(storyTransactions).values([
    {
      id: "tx-export-1", projectId: pid, source: "user-edit", sourceGenerationId: "gen-dangling-soft-ref",
      createdAt: OWNED_AT,
    },
    { id: "tx-export-2", projectId: pid, source: "model-proposal", sourceGenerationId: null, createdAt: OWNED_AT },
  ]);
  await handle.db.insert(storyChanges).values([
    {
      id: uid("sc"), transactionId: "tx-export-1", projectId: pid, seq: 1,
      entityKey: "characters", entityId: c1!.id, field: "role", oldValue: "", newValue: "protagonist",
    },
    {
      id: uid("sc"), transactionId: "tx-export-1", projectId: pid, seq: 2,
      entityKey: "characters", entityId: c1!.id, field: "name", oldValue: "", newValue: "Vera",
    },
    {
      id: uid("sc"), transactionId: "tx-export-2", projectId: pid, seq: 1,
      entityKey: "chapters", entityId: ch1!.id, field: "summary", oldValue: "", newValue: "s1",
    },
  ]);

  // ---- Excluded surfaces, all scoped to THIS project: the include-list must
  // drop every one of them (canonical story != platform/module artifacts).
  await handle.db.insert(generations).values({
    id: uid("g"), projectId: pid, chapterId: null, mode: "write", prompt: "p", output: "o", createdAt: OWNED_AT,
  });
  await handle.db.insert(showcases).values({
    id: uid("sh"), projectId: pid, userId: ownerId, slug: `snap-${pid}`, visibility: "private", flagged: false, createdAt: OWNED_AT, updatedAt: OWNED_AT,
  });
  await handle.db.insert(audioExports).values({
    id: uid("ae"), projectId: pid, chapterId: ch1!.id, mode: "narration", status: "pending", audioUrl: "", durationSeconds: 0, characterCount: 0, estimatedCost: "", lipsyncVideoUrl: "", lipsyncJobId: "", lipsyncStatus: "", createdAt: OWNED_AT,
  });
  const [rs] = await handle.db
    .insert(readerSessions)
    .values({ id: uid("rs"), projectId: pid, token: `tok-${pid}`, expiresAt: OWNED_AT, createdAt: OWNED_AT })
    .returning();
  await handle.db.insert(readerReactions).values({
    id: uid("rr"), sessionId: rs!.id, chapterId: ch1!.id, textOffset: 3, reactionType: "laugh", createdAt: OWNED_AT,
  });
  await handle.db.insert(creatorBibles).values({ id: uid("cb"), projectId: pid, channelName: "cha", contentPillars: [], hookMemory: [], createdAt: OWNED_AT, updatedAt: OWNED_AT });
  const [uni] = await handle.db
    .insert(universes)
    .values({ id: uid("uv"), userId: ownerId, name: "Canon universe", sharedRules: [], createdAt: OWNED_AT, updatedAt: OWNED_AT })
    .returning();
  const [uc] = await handle.db
    .insert(universeCharacters)
    .values({ id: uid("uvc"), universeId: uni!.id, name: "Vera prime", isAlive: true, createdAt: OWNED_AT })
    .returning();
  await handle.db.insert(universeEvents).values({
    id: uid("uve"), universeId: uni!.id, projectId: pid, name: "split event", description: "", timelineSort: 1, isCanon: true, createdAt: OWNED_AT,
  });
  await handle.db.insert(projectCharacterStates).values({
    id: uid("pcs"), projectId: pid, universeCharId: uc!.id, knowledgeOverride: {}, emotionalState: "calm", isDeceased: false, createdAt: OWNED_AT,
  });

  return pid;
}

const ctx = (): RequestContext => ({
  actor: { kind: "local-owner", id: "owner-actor" },
  environment: "local",
  permissions: [],
  services: {},
});

describe("canonical project snapshot — the §10/§10.1 exporter (envelope contract)", () => {
  it("exports the 20 FK-ordered collections with a self-consistent checksum, and leaves every excluded surface out", async () => {
    const source = freshDb();
    const ownerId = await seedOwner(source, "owner@source");
    const strangerId = await seedOwner(source, "stranger@source");
    const pid = await seedCanonicalProject(source, ownerId);
    // A second, foreign-owned project — never the export's cargo.
    await source.db.insert(projects).values({
      id: uid("p"), userId: strangerId, name: "Stranger's project", createdAt: OWNED_AT, updatedAt: OWNED_AT,
    });

    const port = makeSqliteProjectSnapshotPort(source.db, ownerId);
    const out = await exportProjectSnapshot(ctx(), { projectId: pid }, port);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const envelope = out.payload;

    expect(envelope.format).toBe(SNAPSHOT_FORMAT);
    expect(envelope.version).toBe(SNAPSHOT_VERSION);
    expect(envelope.meta.project).toEqual({ id: pid, name: "Snapshot Canon", format: "Novel" });
    expect(new Date(envelope.meta.exportedAt).toISOString()).toBe(envelope.meta.exportedAt);
    expect(envelope.meta.exportedBy).toBe("owner-actor");
    // Kinds ride exactly the handler's own list, in FK order — no drift, no
    // extras (which is also where every excluded table's absence is pinned).
    expect(envelope.collections.map((c) => c.kind)).toEqual([...SNAPSHOT_COLLECTIONS]);
    expect(envelope.collections[0]).toEqual({
      kind: "project",
      rows: [expect.objectContaining({ id: pid, userId: ownerId, contentRevision: 5 })],
    });
    // The checksum describes exactly the collections body that rides beside it.
    expect(envelope.meta.checksum).toBe(snapshotChecksum(JSON.stringify(envelope.collections)));
  }, 20000);

  it("a stranger or foreign-owner id reads as 404 (owner-bound read), a scope-pinned target is 403", async () => {
    const source = freshDb();
    const ownerId = await seedOwner(source, "owner@source");
    const strangerId = await seedOwner(source, "stranger@source");
    const pid = await seedCanonicalProject(source, ownerId);
    const foreign = uid("p");
    await source.db.insert(projects).values({
      id: foreign, userId: strangerId, name: "Foreign", createdAt: OWNED_AT, updatedAt: OWNED_AT,
    });

    // The port's owner predicate is the stage-(d) shape — readSnapshot is
    // factory-bound to ONE owner row, so the handler's 404 is real ownership.
    const port = makeSqliteProjectSnapshotPort(source.db, ownerId);
    expect((await port.readSnapshot(foreign)).project).toBeNull();
    const out = await exportProjectSnapshot(ctx(), { projectId: foreign }, port);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });

    // projectScope pins hits 403 BEFORE the port (the run-plan mount ordering).
    const scopedCtx = { ...ctx(), projectScope: "other-project" } as RequestContext;
    const scoped = await exportProjectSnapshot(scopedCtx, { projectId: pid }, port);
    expect(scoped).toEqual({ ok: false, status: 403, reason: "Project out of scope" });
  }, 20000);
});

describe("canonical project snapshot — the round-trip into a fresh db", () => {
  it("exports → imports → every included collection lands set-equal, re-owned, revision-bumped; every excluded surface stays out", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@source");
    const pid = await seedCanonicalProject(source, sourceOwnerId);
    const exportPort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const exported = await exportProjectSnapshot(ctx(), { projectId: pid }, exportPort);
    if (!exported.ok) throw exported;
    const envelope = exported.payload;

    const dest = freshDb();
    const destOwnerId = await seedOwner(dest, "owner@dest");
    const destPort = makeSqliteProjectSnapshotPort(dest.db, destOwnerId);
    const imported = await importProjectSnapshot(ctx(), { snapshot: envelope }, destPort);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.payload.project.id).toBe(pid);
    expect(imported.payload.project.name).toBe("Snapshot Canon");
    expect(imported.payload.project.format).toBe("Novel");
    // §11.1 — ONE bump per import, not per row.
    expect(imported.payload.project.contentRevision).toBe(6);

    // Set-equal on EVERY included collection: the same rows, driver-shaped,
    // compared as ordered-by-id arrays — ids preserved verbatim, Dates revived
    // to real Date instants, json-mode objects back as objects.
    // Loosely typed on purpose: every drizzle-sqlite table rides the same
    // select/from/orderBy mechanics — only the mapped row values matter here.
    const compareRows = async (
      handle: SqliteDbHandle,
      table: unknown,
    ): Promise<Record<string, unknown>[]> => {
      const id = (table as { id: unknown }).id as never;
      return (await handle.db.select().from(table as never).orderBy(id)) as Record<string, unknown>[];
    };

    const sourceRows = {
      chapters: await compareRows(source, chapters),
      characters: await compareRows(source, characters),
      locations: await compareRows(source, locations),
      plotThreads: await compareRows(source, plotThreads),
      storyThreads: await compareRows(source, storyThreads),
      storyPromises: await compareRows(source, storyPromises),
      editorNotes: await compareRows(source, editorNotes),
      worldEntities: await compareRows(source, worldEntities),
      referenceWorks: await compareRows(source, referenceWorks),
      storyMemories: await compareRows(source, storyMemories),
      characterEvolutionLog: await compareRows(source, characterEvolutionLog),
      storyCheckpoints: await compareRows(source, storyCheckpoints),
      storyPlans: await compareRows(source, storyPlans),
      comicPages: await compareRows(source, comicPages),
      comicPanels: await compareRows(source, comicPanels),
      productionShots: await compareRows(source, productionShots),
      storyTransactions: await compareRows(source, storyTransactions),
      storyChanges: await compareRows(source, storyChanges),
      characterRelationships: await compareRows(source, characterRelationships),
    };
    // The project itself: re-owned (§5.6 — the cloud userId must never tag
    // along), same id/fields, revision bumped.
    const destProjectRows = (await dest.db.select().from(projects)) as Record<string, unknown>[];
    expect(destProjectRows, "the destination carries exactly the imported project row").toHaveLength(1);
    const destProjectRow = destProjectRows[0]!;
    expect(destProjectRow["id"]).toBe(pid);
    expect(destProjectRow["userId"]).toBe(destOwnerId);
    expect(destProjectRow["userId"]).not.toBe(sourceOwnerId);
    expect(destProjectRow["name"]).toBe("Snapshot Canon");
    expect(destProjectRow["contentRevision"]).toBe(6);
    expect(destProjectRow["createdAt"]).toEqual(OWNED_AT);

    const childPairs: [typeof chapters, Record<string, unknown>[]][] = [
      [chapters as never, sourceRows.chapters],
      [characters as never, sourceRows.characters],
      [locations as never, sourceRows.locations],
      [plotThreads as never, sourceRows.plotThreads],
      [storyThreads as never, sourceRows.storyThreads],
      [storyPromises as never, sourceRows.storyPromises],
      [editorNotes as never, sourceRows.editorNotes],
      [worldEntities as never, sourceRows.worldEntities],
      [referenceWorks as never, sourceRows.referenceWorks],
      [characterRelationships as never, sourceRows.characterRelationships],
      [storyMemories as never, sourceRows.storyMemories],
      [characterEvolutionLog as never, sourceRows.characterEvolutionLog],
      [storyCheckpoints as never, sourceRows.storyCheckpoints],
      [storyPlans as never, sourceRows.storyPlans],
      [comicPages as never, sourceRows.comicPages],
      [comicPanels as never, sourceRows.comicPanels],
      [productionShots as never, sourceRows.productionShots],
      [storyTransactions as never, sourceRows.storyTransactions],
      [storyChanges as never, sourceRows.storyChanges],
    ];
    for (const [table, expected] of childPairs) {
      const actual = (await dest.db.select().from(table).orderBy(table.id as never)) as Record<string, unknown>[];
      expect(actual, String(table)).toEqual(expected);
    }

    // Every excluded surface: zero rows in the destination — the import never
    // smuggled platform/module artifacts back into the local store.
    for (const table of [generations, showcases, audioExports, readerSessions, readerReactions, creatorBibles, universes, universeCharacters, universeEvents, projectCharacterStates]) {
      const rows = await dest.db.select().from(table);
      expect(rows, String(table)).toEqual([]);
    }

    // The §13.1 audit trail's soft generation reference dangles BY DESIGN —
    // generations are excluded, the field is a plain FK-less column.
    const txRows = (await dest.db.select().from(storyTransactions)) as Record<string, unknown>[];
    const tx1 = txRows.find((row) => row["id"] === "tx-export-1");
    expect(tx1).toEqual(expect.objectContaining({ id: "tx-export-1", sourceGenerationId: "gen-dangling-soft-ref" }));
  }, 30000);

  it("a re-export of the imported db keeps the canon byte-identical across independent DBs — the project row differs only where re-owning allows it to", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@source");
    const pid = await seedCanonicalProject(source, sourceOwnerId);
    const sourcePort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const first = await exportProjectSnapshot(ctx(), { projectId: pid }, sourcePort);
    if (!first.ok) throw first;
    // A second export moments later: meta.exportedAt moves with the clock but
    // sits OUTSIDE the checksum body — the digest is a pure function of the
    // collections bytes alone.
    const again = await exportProjectSnapshot(ctx(), { projectId: pid }, sourcePort);
    if (!again.ok) throw again;
    expect(again.payload.meta.checksum).toBe(first.payload.meta.checksum);

    const dest = freshDb();
    const destOwnerId = await seedOwner(dest, "owner@dest");
    const destPort = makeSqliteProjectSnapshotPort(dest.db, destOwnerId);
    const imported = await importProjectSnapshot(ctx(), { snapshot: first.payload }, destPort);
    expect(imported.ok).toBe(true);

    const second = await exportProjectSnapshot(ctx(), { projectId: pid }, destPort);
    if (!second.ok) throw second;
    // The canon (all 19 child collections — ids, instants, json shapes) round-
    // trips byte-identically: cross-db determinism, not a same-row tautology.
    expect(JSON.stringify(second.payload.collections.slice(1))).toBe(
      JSON.stringify(first.payload.collections.slice(1)),
    );
    // ...and the re-export is itself a well-formed envelope (§10 checksum rule).
    expect(second.payload.meta.checksum).toBe(snapshotChecksum(JSON.stringify(second.payload.collections)));
    // What it MAY differ in, it may differ in only for a documented reason: the
    // project row arrives re-owned (§5.6) and carrying the §11.1 import bump.
    const [secondProjectRow] = second.payload.collections[0]!.rows;
    expect(secondProjectRow).toMatchObject({ id: pid, userId: destOwnerId, contentRevision: 6 });
  }, 30000);

  it("the 409 re-import conflict: an existing project id (any owner) can never be restored over", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@source");
    const pid = await seedCanonicalProject(source, sourceOwnerId);
    const sourcePort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const exported = await exportProjectSnapshot(ctx(), { projectId: pid }, sourcePort);
    if (!exported.ok) throw exported;

    // Re-importing into the SAME store hits the pre-check before seeding.
    const conflict = await importProjectSnapshot(ctx(), { snapshot: exported.payload }, sourcePort);
    expect(conflict).toEqual({
      ok: false,
      status: 409,
      reason: `project ${pid} already exists in this db`,
    });
  }, 20000);

  it("an all-empty (project-only) envelope imports clean — and pins the port's kind→table map completeness for all 19 child kinds", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@source2");
    const bare = freshDb();
    const bareOwnerId = await seedOwner(bare, "owner@bare");

    const [project] = await source.db
      .insert(projects)
      .values({ id: uid("p-bare"), userId: sourceOwnerId, name: "Bare", createdAt: OWNED_AT, updatedAt: OWNED_AT })
      .returning();
    const sourcePort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const barePort = makeSqliteProjectSnapshotPort(bare.db, bareOwnerId);
    const exported = await exportProjectSnapshot(ctx(), { projectId: project!.id }, sourcePort);
    if (!exported.ok) throw exported;

    const imported = await importProjectSnapshot(ctx(), { snapshot: exported.payload }, barePort);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    // Every child kind walked and written 0 — an unmapped kind would have
    // thrown before the transaction committed.
    for (const kind of SNAPSHOT_COLLECTIONS) {
      if (kind === "project") continue;
      expect(imported.payload.imported[kind], kind).toBe(0);
    }
    expect(imported.payload.project.contentRevision).toBe(1);
  }, 20000);

  it("through the transport: 501-by-default, 401 unauthenticated, then a real export→wire→import round trip via dispatchLoopback", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@source3");
    const pid = await seedCanonicalProject(source, sourceOwnerId);

    const minimalRepos = (): DefaultRouteDeps =>
      ({
        chapterRepo: { ownsProject: async () => true, updateScoped: async () => null, deleteScoped: async () => undefined },
        storyBibleRepo: { ownsProject: async () => true, readSections: async () => ({}) },
        storyTransactionRepo: { ownsProject: async () => true, record: async () => undefined, applyChanges: async () => undefined },
      }) as DefaultRouteDeps;
    const TOKEN = "d".repeat(64);
    const req = (method: string, path: string, body?: string, token = TOKEN): Parameters<typeof dispatchLoopback>[0] => ({
      method,
      path,
      headers: { authorization: token ? `Bearer ${token}` : "", origin: "" },
      body: body ? Buffer.from(body, "utf8") : null,
    });

    // Absent bundle → the pair is 501-by-default, like every optional cluster.
    const noBundle = await dispatchLoopback(req("GET", `/projects/${pid}/export`), {
      expectedToken: TOKEN,
      routes: defaultLocalRoutes(minimalRepos()),
    });
    expect(noBundle.status).toBe(501);

    const withPort = (db: SqliteDbHandle, ownerId: string): DefaultRouteDeps => ({
      ...(minimalRepos() as object),
      portability: makeSqliteProjectSnapshotPort(db.db, ownerId),
    } as DefaultRouteDeps);

    // Unauthenticated first — 401 BEFORE routing.
    const anon = await dispatchLoopback(req("GET", `/projects/${pid}/export`, undefined, ""), {
      expectedToken: TOKEN,
      routes: defaultLocalRoutes(withPort(source, sourceOwnerId)),
    });
    expect(anon.status).toBe(401);

    // Export over the wire; the response body IS the envelope.
    const wireExport = await dispatchLoopback(req("GET", `/projects/${pid}/export`), {
      expectedToken: TOKEN,
      routes: defaultLocalRoutes(withPort(source, sourceOwnerId)),
    });
    expect(wireExport.status).toBe(200);
    const wireEnvelope = wireExport.body as ProjectSnapshotEnvelope;
    expect(wireEnvelope.format).toBe(SNAPSHOT_FORMAT);
    expect(wireEnvelope.meta.checksum).toBe(snapshotChecksum(JSON.stringify(wireEnvelope.collections)));

    // The wire envelope imports into a fresh db through the same transport —
    // the body a client saved is the body it posts back.
    const dest = freshDb();
    const destOwnerId = await seedOwner(dest, "owner@dest3");
    const wireImport = await dispatchLoopback(
      req("POST", "/projects/import", JSON.stringify(wireEnvelope)),
      { expectedToken: TOKEN, routes: defaultLocalRoutes(withPort(dest, destOwnerId)) },
    );
    expect(wireImport.status).toBe(200);
    expect(wireImport.body).toEqual(
      expect.objectContaining({
        project: expect.objectContaining({ id: pid, contentRevision: 6 }),
        imported: expect.objectContaining({ chapters: 3, characters: 2, storyTransactions: 2, storyChanges: 3 }),
      }),
    );
  }, 30000);
});

describe("canonical project snapshot — validation (fail closed before the port)", () => {
  const dest = freshDb();
  const destOwnerId = new Promise<string>((resolve) => {
    void seedOwner(dest, "owner@validation").then(resolve);
  });

  type EnvelopeMutator = (envelope: ProjectSnapshotEnvelope) => unknown;
  // Every case is a function over a real exported envelope — even the "unknown
  // format" one (it ignores its input) — so the mutator shape never has to vary
  // between object literals and functions.
  const cases: [string, EnvelopeMutator][] = [
    ["an unknown format", () => ({ format: "other", version: 1 })],
    ["a wrong version", (e) => ({ ...e, version: 999 })],
    ["a missing collection", (e) => ({ ...e, collections: e.collections.filter((c) => c.kind !== "storyPlans") })],
    ["a duplicated kind", (e) => ({ ...e, collections: [...e.collections, e.collections[1]] })],
    ["a non-object row", (e) => ({ ...e, collections: e.collections.map((c) => (c.kind === "chapters" ? { ...c, rows: ["not an object"] } : c)) })],
    [
      "a project collection that is not exactly one row",
      (e) => ({
        ...e,
        collections: [
          ...e.collections.filter((c) => c.kind !== "project"),
          { kind: "project", rows: [] as unknown[] },
          { kind: "project", rows: [e.collections[0]!.rows[0]!] },
        ] as unknown as typeof e.collections,
      }),
    ],
  ];
  it.each(cases)("rejects %s with 400", async (_name, mutate) => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@validation-source");
    const pid = await seedCanonicalProject(source, sourceOwnerId);
    const sourcePort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const exported = await exportProjectSnapshot(ctx(), { projectId: pid }, sourcePort);
    if (!exported.ok) throw exported;
    const broken = mutate(exported.payload);

    const ownerId = await destOwnerId;
    const destPort = makeSqliteProjectSnapshotPort(dest.db, ownerId);
    const out = await importProjectSnapshot(ctx(), { snapshot: broken }, destPort);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(400);
    expect(out.reason).toBeTruthy();
    // Fail-closed also means nothing partially landed.
    const rows = await dest.db.select().from(projects);
    expect(rows).toEqual([]);
  }, 30000);

  it("rejects a tampered body on checksum (a truncated or altered copy never imports)", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@validation-tamper");
    const pid = await seedCanonicalProject(source, sourceOwnerId);
    const sourcePort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const exported = await exportProjectSnapshot(ctx(), { projectId: pid }, sourcePort);
    if (!exported.ok) throw exported;

    const ownerId = await destOwnerId;
    const destPort = makeSqliteProjectSnapshotPort(dest.db, ownerId);
    const tampered = JSON.parse(JSON.stringify(exported.payload)) as ProjectSnapshotEnvelope;
    (tampered.collections[1]!.rows[0] as Record<string, unknown>)["title"] = "hijacked";
    const out = await importProjectSnapshot(ctx(), { snapshot: tampered }, destPort);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(400);
    expect(out.reason).toMatch(/checksum/i);
    expect(await dest.db.select().from(projects)).toEqual([]);
  }, 20000);

  it("rejects envelope metadata that does not honestly bound itself", async () => {
    const source = freshDb();
    const sourceOwnerId = await seedOwner(source, "owner@validation-meta");
    const pid = await seedCanonicalProject(source, sourceOwnerId);
    const sourcePort = makeSqliteProjectSnapshotPort(source.db, sourceOwnerId);
    const exported = await exportProjectSnapshot(ctx(), { projectId: pid }, sourcePort);
    if (!exported.ok) throw exported;

    const ownerId = await destOwnerId;
    const destPort = makeSqliteProjectSnapshotPort(dest.db, ownerId);
    const missing = JSON.parse(JSON.stringify(exported.payload)) as Record<string, unknown>;
    delete (missing["meta"] as Record<string, unknown>)["checksum"];
    const out = await importProjectSnapshot(ctx(), { snapshot: missing }, destPort);
    expect(out).toMatchObject({ ok: false, status: 400, reason: expect.stringMatching(/checksum/) });
  }, 20000);
});

describe("canonical project snapshot — source purity (live-shell-reachability convention)", () => {
  const FILES = [
    join(__dirname, "../handlers/portability.ts"),
    join(__dirname, "../sqlite-project-snapshot.ts"),
  ];

  it("the snapshot pair never imports the Neon side, the pg schema, or the Next runtime", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf-8");
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  }, 20000);
});

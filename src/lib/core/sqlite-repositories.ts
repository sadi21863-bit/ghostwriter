/**
 * SQLite adapter for the repository ports — the FINAL cluster of the §4
 * parity line: chapter repo, the pairing project/child-resource repos NOT
 * already answered by `sqlite-project-crud.ts` (pair 5), the aggregated
 * Story Bible read, the §11 post-commit hooks (the real `contentRevision`
 * COALESCE bump), and the full §13.1 transaction machinery (record / apply /
 * revert + the change-wire codec + `ENTITY_TABLES`).
 *
 * Re-export vs re-implement, verified against the ports:
 *  - pair 5's `sqlite-project-crud.ts` answers `ProjectsCoreRepository` (the
 *    7-verb CRUD). THIS file answers the OTHER two port surfaces
 *    `pg-repositories.ts` carries: `ProjectRepository.findOwned` (full-row
 *    ownership proof) and `ChildResourceRepository.owns` (the named child
 *    registry). No duplication of pair 5's verbs.
 *  - the change-wire codec (`decodeChangeValue`/`encodeChangeValue`/
 *    `ENTITY_TABLES`) is engine-agnostic BY CONSTRUCTION — it reads
 *    drizzle's runtime `column.dataType`, which the sqlite baseline carries
 *    identically (text → "string", boolean-mode integer → "boolean",
 *    integer/real → "number", json-mode text → "json"). It is COPIED here
 *    rather than imported because `pg-repositories.ts` imports `@/db` — a
 *    forbidden downward import for the sqlite layer (it would drag the Neon
 *    driver into the local host). The copies are pinned field-set-equal to
 *    the pg original AND to DIFF_FIELDS by the parity test below (the same
 *    shape `pg-entity-tables-mirror.test.ts` uses on the pg side), so a
 *    drift fails a build instead of writing garbage.
 *  - the one structural rewrite: Neon-http has no `db.transaction` (it only
 *    has `db.batch`), while the sqlite proxy driver has NO `db.batch` and
 *    DOES have `db.transaction` (tracer-proven live: begin/commit over
 *    node:sqlite). Every `db.batch([...])` call becomes one
 *    `db.transaction(async (tx) => …)` wrapping the same statements — the
 *    all-or-nothing contract is identical server-side atomicity.
 *  - `pgPostCommitHooks`' embedding hook DROPS OUT entirely: pg's
 *    `contentRevision` bump is the only hook carrier and the vector work the
 *    pg layer sometimes chains from mutation paths is the baseline's
 *    sanctioned omission (same honest-off rule as every other cluster;
 *    §5.3). The bump itself is a plain `COALESCE(column, 0) + 1` — identical
 *    on both engines.
 *
 * Same factory-per-consumer shape as the eight landed adapters, PLUS
 * default-singleton consts over the lazy `sqliteDb` proxy (mirroring pg's
 * global-const export shape, so a local composition root can wire the same
 * way the cloud routes do).
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity test in
 * `__tests__/sqlite-trio-parity.test.ts`.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  chapters,
  characters,
  characterRelationships,
  comicPages,
  comicPanels,
  locations,
  plotThreads,
  projects,
  referenceWorks,
  storyChanges,
  storyMemories,
  storyTransactions,
  worldEntities,
} from "@/db/sqlite-schema";
import { sqliteDb, type DrizzleSqliteDb } from "@/db/sqlite";
import type {
  CanonicalMutationKind,
  ChapterRepository,
  ChapterRow,
  ChildResourceRef,
  ChildResourceRepository,
  PostCommitHooks,
  ProjectRepository,
  ProjectRow,
} from "@/lib/core/repositories";
import type { StoryBibleRepository } from "@/lib/core/handlers/get-story-bible";
import { MissingEntitiesError } from "@/lib/core/handlers/apply-story-transaction";
import type { StoryTransactionRepository } from "@/lib/core/handlers/apply-story-transaction";
import type {
  EntityKey,
  StoryChange,
  TransactionSource,
} from "@/lib/core/handlers/apply-story-transaction";
import type { StoryHistoryRepository, RevertConflict } from "@/lib/core/handlers/story-history";

export function makeSqliteChapterRepository(db: DrizzleSqliteDb): ChapterRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async updateScoped(projectId, chapterId, patch) {
      const [row] = await db
        .update(chapters)
        .set(patch as unknown as typeof chapters.$inferInsert)
        .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)))
        .returning();
      return (row as ChapterRow | undefined) ?? null;
    },

    async deleteScoped(projectId, chapterId) {
      await db
        .delete(chapters)
        .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));
    },
  };
}

export function makeSqliteProjectRepository(db: DrizzleSqliteDb): ProjectRepository {
  return {
    async findOwned(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      });
      return (row as ProjectRow | undefined) ?? null;
    },
  };
}

/**
 * Named child resources this adapter can prove ownership of. Adding a resource
 * here is the only change a new child-resource route needs — the authorization
 * path itself is generic.
 */
type ChildTable = { id: any; projectId: any };

const CHILD_TABLES: Record<string, ChildTable> = Object.assign(Object.create(null), {
  comic_pages: comicPages as unknown as ChildTable,
  comic_panels: comicPanels as unknown as ChildTable,
});

export function makeSqliteChildResourceRepository(db: DrizzleSqliteDb): ChildResourceRepository {
  return {
    async owns(ref) {
      // Object.hasOwn, not `if (!table)`: a plain-object registry resolves
      // "toString"/"__proto__" through the prototype chain, so a truthiness
      // check would treat them as valid resources and hand a bogus table to
      // the query.
      if (!Object.hasOwn(CHILD_TABLES, ref.resource)) return false;
      const table = CHILD_TABLES[ref.resource]!;
      const [row] = await db
        .select({ id: table.id })
        .from(table as never)
        .where(and(eq(table.id, ref.childId), eq(table.projectId, ref.projectId)))
        .limit(1);
      return !!row;
    },
  };
}

/**
 * Aggregated World Bible read (§7 `getStoryBible`). One authorization decision
 * and one round trip instead of seven per-entity reads, and a single place to
 * stamp `contentRevision` for cache keys.
 */
export function makeSqliteStoryBibleRepository(db: DrizzleSqliteDb): StoryBibleRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async readSections(projectId) {
      const [chars, locs, threads, entities, refs, memories, rels] = await Promise.all([
        db.query.characters.findMany({ where: eq(characters.projectId, projectId) } as never),
        db.query.locations.findMany({ where: eq(locations.projectId, projectId) } as never),
        db.query.plotThreads.findMany({ where: eq(plotThreads.projectId, projectId) } as never),
        db.query.worldEntities.findMany({ where: eq(worldEntities.projectId, projectId) } as never),
        db.query.referenceWorks.findMany({ where: eq(referenceWorks.projectId, projectId) } as never),
        db.query.storyMemories.findMany({ where: eq(storyMemories.projectId, projectId) } as never),
        db.query.characterRelationships.findMany({
          where: eq(characterRelationships.projectId, projectId) as never,
        }),
      ]);
      return {
        characters: chars as unknown as Record<string, unknown>[],
        locations: locs as unknown as Record<string, unknown>[],
        plotThreads: threads as unknown as Record<string, unknown>[],
        worldEntities: entities as unknown as Record<string, unknown>[],
        referenceWorks: refs as unknown as Record<string, unknown>[],
        storyMemories: memories as unknown as Record<string, unknown>[],
        characterRelationships: rels as unknown as Record<string, unknown>[],
      };
    },

    /**
     * §11. The `content_revision` column is a per-project monotonic mutation
     * counter: null = the project has never been canonically mutated since Phase
     * 5A deployed (unknown), N = mutated N times. A missing project row also
     * reads as null, so a bad id cannot be distinguished from "never mutated" —
     * both are safe cache keys, and ownership was already decided upstream.
     */
    async readContentRevision(projectId) {
      const [row] = await db
        .select({ contentRevision: projects.contentRevision })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      return row?.contentRevision ?? null;
    },
  };
}

/**
 * §11's transactional revision increment. ONE atomic statement — a
 * read-modify-write here would lose increments under concurrent mutation.
 * NULL is treated as 0 (`COALESCE`), so the very first mutation after the
 * column ships produces revision 1, never a SQL null arithmetic result.
 *
 * Post-commit by definition: callers invoke it only after the canonical write
 * itself succeeded, so a failure here means "revision stale", never "write
 * lost". Awaited rather than fire-and-forget so a bible read that happens
 * immediately after a save can never stamp a revision OLDER than the data it
 * already contains — the harmless direction is the other one.
 */
export function makeSqlitePostCommitHooks(db: DrizzleSqliteDb): PostCommitHooks {
  return {
    async onCanonicalMutation(projectId: string, _kind: CanonicalMutationKind): Promise<void> {
      await db
        .update(projects)
        .set({ contentRevision: sql`COALESCE(${projects.contentRevision}, 0) + 1` })
        .where(eq(projects.id, projectId));
    },
  };
}

// ---------------------------------------------------------------------------
// §13.1 slice 1 — Story Transactions: persisted audit rows + applied canon writes
// ---------------------------------------------------------------------------

// §13.1 wire column codec — the engine-agnostic COPY described in the header
// (pinned field-set-equal to the pg original by the parity test). `StoryChange.
// oldValue/newValue` are ALWAYS strings on the wire (the audit contract), but
// mirrored columns are not all strings, so the wire string is decoded into the
// column's native shape before it reaches any UPDATE, and the live native value
// is encoded back to the audit's canonical string before any revert/conflict
// comparison. The kind is read from drizzle's own runtime `column.dataType` —
// schema truth, never a parallel hand-maintained table (text/varchar →
// "string", boolean → "boolean", integer/real → "number", jsonb/json-mode →
// "json"; note `characters.age` and `characters.contextVisibility` are TEXT /
// varchar(-like) columns on BOTH engines, NOT boolean/integer despite their
// use-case names). Anything else (vector, timestamp, …) must never be
// mirrored: the codec refuses it loudly in BOTH directions so a drifted mirror
// fails instead of writing garbage.

type ChangeColumnRef = { readonly dataType?: string };

function changeColumnKind(col: ChangeColumnRef): "string" | "boolean" | "number" | "json" {
  switch (col.dataType) {
    case "string":
    case "boolean":
    case "number":
    case "json":
      return col.dataType;
    default:
      throw new Error(
        `change value codec: mirrored column carries dataType "${String(col.dataType)}" with no defined wire decode`,
      );
  }
}

/**
 * Wire string → the typed value the mirrored column stores. Malformed wire
 * values ("yes" on a boolean column, "4,12" on a link array) throw a typed,
 * context-labelled repository Error — never a raw `SyntaxError` — so a broken
 * transaction stays a describable server fault rather than a JSON parse crash.
 */
export function decodeChangeValue(
  col: ChangeColumnRef,
  wire: string,
  context = "decodeChangeValue",
): unknown {
  const kind = changeColumnKind(col);
  // An empty wire is recorded ABSENCE: strings restore the column's own ""
  // default shape, every other kind restores SQL NULL — never a boolean,
  // numeric, or jsonb lie such as false/0/{}/[] invented from nothing.
  if (wire === "") return kind === "string" ? "" : null;
  switch (kind) {
    case "string":
      // Recorded verbatim: canonicalisation (trimming, JSON-serialising) is the
      // diff/encode side's job, and the audit must round-trip byte-faithfully.
      return wire;
    case "boolean":
      if (wire === "true") return true;
      if (wire === "false") return false;
      break;
    case "number": {
      const n = Number(wire.trim());
      if (Number.isFinite(n)) return n;
      break;
    }
    case "json": {
      try {
        return JSON.parse(wire) as unknown;
      } catch {
        break; // deliberate: the named error below, not a leaked SyntaxError
      }
    }
  }
  const shown = wire.length > 40 ? `${wire.slice(0, 40)}…` : wire;
  throw new Error(
    `${context}: column value must decode from its ${kind} shape; received ${JSON.stringify(shown)}`,
  );
}

/**
 * DB native value → the audit's canonical wire string — the exact inverse of
 * `decodeChangeValue` plus the client `diffEntity` canonicalisation, used where
 * revert + conflict detection compares a live row against the recorded string.
 * After this, a stored `"true"` audit against a boolean column compares equal
 * to a live `true` (String(true) ≠ `"true"` for jsonb shapes made the old
 * direct-String comparison silently wrong for non-string fields).
 */
export function encodeChangeValue(col: ChangeColumnRef, value: unknown): string {
  const kind = changeColumnKind(col);
  if (value === null || value === undefined) return "";
  switch (kind) {
    case "string":
      return String(value).trim();
    case "boolean":
      return value === true ? "true" : value === false ? "false" : String(value);
    case "number":
      return typeof value === "number" ? String(value) : String(value).trim();
    case "json": {
      if (typeof value === "string") return value; // driver-variant pre-serialised jsonb
      const empty = Array.isArray(value)
        ? value.length === 0
        : Object.keys(value as Record<string, unknown>).length === 0;
      // Empty arrays/objects are "no value" on the wire, matching the diff side.
      if (empty) return "";
      return JSON.stringify(value) ?? String(value);
    }
  }
}

// The FOUR entity tables a transaction may touch, each with its own allowlisted
// field → drizzle-column map — the COMPLETE apply/revert write-pass projection
// of DIFF_FIELDS (src/lib/ai/entity-extraction.ts). Same comment contract as
// the pg side (see pg-repositories.ts for the full per-field-decision record),
// now over the ATTACK sqlite tables: a change NEVER resolves to a column by
// interpolated string; it resolves through this closed map
// (Object.create(null) leaves no prototype chain) whose values are real schema
// columns imported from @/db/sqlite-schema. The parity test below is the
// mechanical cross-check gate on THIS side (field-set-equal to the pg map AND
// to DIFF_FIELDS): any field added to DIFF_FIELDS without a mirror here fails
// that build. Deliberately NOT mapped (per-field decisions recorded on
// DIFF_FIELDS, not omissions): embedding (vector — the baseline omits the
// column entirely), voiceId / portraitUrl / soulId / soulIdTrainingJobId
// (production metadata), server-owned identity columns, and the no-UI-writer
// NVC/language columns.
// `EntityTable` deliberately mirrors CHILD_TABLES' looseness; call sites cast
// to `typeof characters` to reuse the updateScoped typing pattern.
type EntityTable = { id: any; projectId: any } & Record<string, any>;
export type EntityTableSpec = { table: EntityTable; columns: Record<string, any> };

export const ENTITY_TABLES: Record<string, EntityTableSpec> = Object.assign(Object.create(null), {
  characters: {
    table: characters as unknown as EntityTable,
    columns: {
      name: characters.name,
      desires: characters.desires, arc: characters.arc, fears: characters.fears,
      speechPattern: characters.speechPattern, role: characters.role, age: characters.age,
      appearance: characters.appearance, personality: characters.personality,
      thinkingStyle: characters.thinkingStyle, behavior: characters.behavior,
      habits: characters.habits, backstory: characters.backstory,
      structuralFunction: characters.structuralFunction, visualProfile: characters.visualProfile,
      voiceProfile: characters.voiceProfile, voiceRegister: characters.voiceRegister,
      voiceCompression: characters.voiceCompression, verbalTic: characters.verbalTic,
      antagonistToggle: characters.antagonistToggle, antagonistType: characters.antagonistType,
      kinesicsBaseline: characters.kinesicsBaseline, kinesicsMicro: characters.kinesicsMicro,
      kinesicsIdiosyncrasy: characters.kinesicsIdiosyncrasy,
      proxemicsCulture: characters.proxemicsCulture,
      proxemicsViolationResponse: characters.proxemicsViolationResponse,
      paralanguageBaseline: characters.paralanguageBaseline,
      paralanguageStressDegradation: characters.paralanguageStressDegradation,
      paralanguageSignatureSound: characters.paralanguageSignatureSound,
      hapticsTouchLevel: characters.hapticsTouchLevel,
      chronemicsTimeType: characters.chronemicsTimeType,
      oculesicsDefault: characters.oculesicsDefault,
      oculesicsDeception: characters.oculesicsDeception,
      objecticsSignature: characters.objecticsSignature,
      appearanceSignature: characters.appearanceSignature,
      appearanceTrajectory: characters.appearanceTrajectory,
      nativeLanguage: characters.nativeLanguage, acquiredLanguages: characters.acquiredLanguages,
      accentProfile: characters.accentProfile, reversionTrigger: characters.reversionTrigger,
      registerDefault: characters.registerDefault, registerRange: characters.registerRange,
      codeSwitchingTriggers: characters.codeSwitchingTriggers,
      idiolectFingerprint: characters.idiolectFingerprint,
      rootWound: characters.rootWound, hamartia: characters.hamartia,
      cognitiveBias: characters.cognitiveBias, blindSpot: characters.blindSpot,
      strengthBranch: characters.strengthBranch, compensationMode: characters.compensationMode,
      compensationBehavior: characters.compensationBehavior, flawArcMode: characters.flawArcMode,
      culturalWorldview: characters.culturalWorldview, characterWant: characters.characterWant,
      characterNeed: characters.characterNeed, contradiction: characters.contradiction,
      narratorBlindSpot: characters.narratorBlindSpot,
      firstImpressionNote: characters.firstImpressionNote,
      contextVisibility: characters.contextVisibility,
      significantFlaws: characters.significantFlaws, skills: characters.skills,
      knowledgeMap: characters.knowledgeMap, intelligenceProfile: characters.intelligenceProfile,
      linkedLocationIds: characters.linkedLocationIds,
      linkedPlotThreadIds: characters.linkedPlotThreadIds,
    },
  },
  locations: {
    table: locations as unknown as EntityTable,
    columns: {
      name: locations.name,
      description: locations.description, atmosphere: locations.atmosphere,
      history: locations.history, sensoryDetails: locations.sensoryDetails,
      linkedCharacterIds: locations.linkedCharacterIds,
    },
  },
  plotThreads: {
    table: plotThreads as unknown as EntityTable,
    columns: {
      name: plotThreads.name,
      description: plotThreads.description, stakes: plotThreads.stakes,
      connections: plotThreads.connections, status: plotThreads.status,
    },
  },
  worldEntities: {
    table: worldEntities as unknown as EntityTable,
    columns: {
      name: worldEntities.name, kind: worldEntities.kind,
      summary: worldEntities.summary, description: worldEntities.description,
      properties: worldEntities.properties,
      alwaysInContext: worldEntities.alwaysInContext, sortOrder: worldEntities.sortOrder,
      linkedCharacterIds: worldEntities.linkedCharacterIds,
      linkedLocationIds: worldEntities.linkedLocationIds,
      linkedPlotThreadIds: worldEntities.linkedPlotThreadIds,
      linkedEntityIds: worldEntities.linkedEntityIds,
    },
  },
});

export function makeSqliteStoryTransactionRepository(db: DrizzleSqliteDb): StoryTransactionRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async record(tx) {
      // ONE atomically-executed batch. The pg (neon-http) side uses `db.batch`
      // because Neon refuses `db.transaction`; this driver is the opposite —
      // native `db.transaction` (see header). The transaction row and its
      // change rows therefore land together or not at all: a recorded audit
      // entry can never be missing the writes it lists. The callback param is
      // deliberately `trx`, NOT `tx` — the StoryTransaction argument itself is
      // the record being written, shadowing it would blank every column.
      await db.transaction(async (trx) => {
        await trx.insert(storyTransactions).values({
          id: tx.id,
          projectId: tx.projectId,
          source: tx.source,
          createdAt: tx.createdAt,
          ...(tx.sourceGenerationId ? { sourceGenerationId: tx.sourceGenerationId } : {}),
        } as never);
        if (tx.changes.length > 0) {
          await trx.insert(storyChanges).values(
            tx.changes.map((c, i) => ({
              transactionId: tx.id,
              projectId: tx.projectId,
              seq: i,
              entityKey: c.entityKey,
              entityId: c.entityId,
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
            })) as never,
          );
        }
      });
    },

    async applyChanges(projectId, tx) {
      if (tx.changes.length === 0) return;

      // ---- Pre-check: every referenced entity must exist in THIS project
      // before any write runs, so an invented entityId fails the whole
      // transaction instead of half-applying it. Reads only — safe to
      // parallelize.
      const missing: { entityKey: EntityKey; entityId: string }[] = [];
      const idsByKey = new Map<string, string[]>();
      for (const c of tx.changes) {
        if (!ENTITY_TABLES[c.entityKey]) {
          missing.push({ entityKey: c.entityKey, entityId: c.entityId });
        }
        const ids = idsByKey.get(c.entityKey) ?? [];
        if (!ids.includes(c.entityId)) ids.push(c.entityId);
        idsByKey.set(c.entityKey, ids);
      }
      if (missing.length === 0) {
        await Promise.all(
          [...idsByKey.entries()].map(async ([entityKey, ids]) => {
            const spec = ENTITY_TABLES[entityKey]!;
            const table = spec.table as unknown as typeof characters;
            const rows = await db
              .select({ id: table.id })
              .from(table)
              .where(and(eq(table.projectId, projectId), inArray(table.id, ids)));
            const found = new Set(rows.map((r) => r.id as string));
            for (const id of ids) {
              if (!found.has(id)) {
                missing.push({ entityKey: entityKey as EntityKey, entityId: id });
              }
            }
          }),
        );
      }
      if (missing.length > 0) {
        throw new MissingEntitiesError(
          missing,
          `applyChanges: transaction ${tx.id} references entities not found in project ${projectId}`,
        );
      }

      // ---- Write: group changes by (entityKey, entityId) so each row takes
      // ONE scoped UPDATE carrying all its fields at once, executed inside ONE
      // transaction (all-or-nothing — the pg side's db.batch semantics). A same
      // row's duplicate field change collapses to the last value (JSON patch
      // semantics). `.returning()` proves each row was actually matched; a
      // 0-row result means the entity vanished between pre-check and write,
      // which aborts the transaction.
      // The wire string is DECODED here, at the last moment before .set(): a
      // boolean column must never receive the audit's literal "true" string
      // and a json column must never receive unparsed JSON.
      const grouped = new Map<string, { entityKey: string; entityId: string; patch: Record<string, unknown> }>();
      for (const c of tx.changes) {
        const key = `${c.entityKey}#${c.entityId}`;
        const g = grouped.get(key) ?? { entityKey: c.entityKey, entityId: c.entityId, patch: {} };
        const spec = ENTITY_TABLES[c.entityKey];
        const col = spec?.columns[c.field];
        if (!spec || !col) {
          throw new Error(`applyChanges: field "${c.field}" is not writable on ${c.entityKey}`);
        }
        g.patch[c.field] = decodeChangeValue(
          col,
          c.newValue,
          `applyChanges: field "${c.field}" on ${key}`,
        );
        grouped.set(key, g);
      }
      const results: unknown[][] = [];
      const labels: string[] = [];
      await db.transaction(async (trx) => {
        for (const g of grouped.values()) {
          const table = ENTITY_TABLES[g.entityKey]!.table as unknown as typeof chapters;
          const rows = await trx
            .update(table)
            .set(g.patch as unknown as typeof chapters.$inferInsert)
            .where(and(eq(table.id, g.entityId), eq(table.projectId, projectId)))
            .returning({ id: table.id });
          results.push(rows as unknown as unknown[]);
          labels.push(`${g.entityKey}#${g.entityId}`);
        }
      });
      for (const [i, rows] of results.entries()) {
        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          throw new Error(
            `applyChanges: transaction ${tx.id} — ${labels[i]} vanished between pre-check and write — nothing was applied`,
          );
        }
      }
    },
  };
}

export function makeSqliteStoryHistoryRepository(db: DrizzleSqliteDb): StoryHistoryRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async listTransactions(projectId) {
      const txRows = await db
        .select({
          id: storyTransactions.id,
          source: storyTransactions.source,
          sourceGenerationId: storyTransactions.sourceGenerationId,
          createdAt: storyTransactions.createdAt,
        })
        .from(storyTransactions)
        .where(eq(storyTransactions.projectId, projectId))
        .orderBy(desc(storyTransactions.createdAt))
        .limit(50);
      if (txRows.length === 0) return [];
      const changeRows = await db
        .select({
          transactionId: storyChanges.transactionId,
          seq: storyChanges.seq,
          entityKey: storyChanges.entityKey,
          entityId: storyChanges.entityId,
          field: storyChanges.field,
          oldValue: storyChanges.oldValue,
          newValue: storyChanges.newValue,
        })
        .from(storyChanges)
        .where(inArray(storyChanges.transactionId, txRows.map((r) => r.id)));
      const byTx = new Map<string, Array<{ seq: number; change: StoryChange }>>();
      for (const c of changeRows) {
        const list = byTx.get(c.transactionId) ?? [];
        list.push({
          seq: c.seq,
          change: {
            entityKey: c.entityKey as EntityKey,
            entityId: c.entityId,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          },
        });
        byTx.set(c.transactionId, list);
      }
      return txRows.map((r) => ({
        id: r.id,
        source: r.source as TransactionSource,
        sourceGenerationId: r.sourceGenerationId ?? undefined,
        createdAt: r.createdAt,
        changes: (byTx.get(r.id) ?? []).sort((a, b) => a.seq - b.seq).map((e) => e.change),
      }));
    },

    async getTransaction(projectId, transactionId) {
      const txRows = await db
        .select({
          id: storyTransactions.id,
          source: storyTransactions.source,
          sourceGenerationId: storyTransactions.sourceGenerationId,
          createdAt: storyTransactions.createdAt,
        })
        .from(storyTransactions)
        .where(
          and(eq(storyTransactions.id, transactionId), eq(storyTransactions.projectId, projectId)),
        )
        .limit(1);
      const txRow = txRows[0];
      if (txRow === undefined) return null;
      const changeRows = await db
        .select({
          seq: storyChanges.seq,
          entityKey: storyChanges.entityKey,
          entityId: storyChanges.entityId,
          field: storyChanges.field,
          oldValue: storyChanges.oldValue,
          newValue: storyChanges.newValue,
        })
        .from(storyChanges)
        .where(eq(storyChanges.transactionId, transactionId));
      return {
        id: txRow.id,
        source: txRow.source as TransactionSource,
        sourceGenerationId: txRow.sourceGenerationId ?? undefined,
        createdAt: txRow.createdAt,
        changes: [...changeRows]
          .sort((a, b) => a.seq - b.seq)
          .map((c) => ({
            entityKey: c.entityKey as EntityKey,
            entityId: c.entityId,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })),
      };
    },

    async revertChanges(projectId, changes): Promise<readonly RevertConflict[]> {
      if (changes.length === 0) return [];

      // Pre-check: one full-row read per involved table, scoped to this
      // project.
      const keys = [...new Set(changes.map((c) => c.entityKey))];
      const rowsByKey = new Map<string, Map<string, Record<string, unknown>>>();
      for (const key of keys) {
        const spec = ENTITY_TABLES[key];
        if (spec === undefined) {
          throw new Error(`revertChanges: unknown entity key "${key}"`);
        }
        const table = spec.table as unknown as typeof characters; // same cast style as applyChanges' pre-check
        const ids = [...new Set(changes.filter((c) => c.entityKey === key).map((c) => c.entityId))];
        const rows = await db
          .select()
          .from(table)
          .where(and(inArray(table.id, ids), eq(table.projectId, projectId)));
        const byId = new Map<string, Record<string, unknown>>();
        for (const row of rows as unknown[]) {
          const r = row as Record<string, unknown>;
          byId.set(String(r.id), r);
        }
        rowsByKey.set(key, byId);
      }

      const conflicts: RevertConflict[] = [];
      const missing = new Map<string, { entityKey: EntityKey; entityId: string }>();
      for (const c of changes) {
        const row = rowsByKey.get(c.entityKey)?.get(c.entityId);
        if (row === undefined) {
          // Already gone at the verify pass (same pass that produced these
          // rows, still before any write): a typed, route-body-worthy failure,
          // mirroring applyChanges' pre-check. Deduped by key+id across a
          // row's fields.
          const k = `${c.entityKey}#${c.entityId}`;
          if (!missing.has(k)) missing.set(k, { entityKey: c.entityKey, entityId: c.entityId });
          continue;
        }
        const spec = ENTITY_TABLES[c.entityKey]!;
        const col = spec.columns[c.field];
        if (!col) {
          throw new Error(`revertChanges: field "${c.field}" is not writable on ${c.entityKey}`);
        }
        // Compare the LIVE native value encoded to the audit's canonical wire —
        // the audit string and the column kind are both known, so a boolean
        // column matched to the recorded "true" compares equal here instead of
        // falling out of the String() vs "true" confusion.
        const current = encodeChangeValue(col, row[c.field]);
        if (current !== c.newValue) {
          conflicts.push({ entityKey: c.entityKey, entityId: c.entityId, field: c.field, current });
        }
      }
      if (missing.size > 0) {
        throw new MissingEntitiesError(
          [...missing.values()],
          `revertChanges — nothing was reverted; entities not found in project ${projectId}`,
        );
      }
      if (conflicts.length > 0) return conflicts;

      // Inverse write: one scoped UPDATE per involved entity row carrying every
      // reverted field back to its oldValue (grouped exactly like applyChanges;
      // a same-row duplicate field collapses last-wins). oldValue is DECODED
      // through the column's kind for the same reason as the apply pass — an
      // audit string like "true" or '["l1"]' must never land in a boolean/json
      // column verbatim.
      const patchByKeyRow = new Map<string, Record<string, unknown>>();
      const keyRowMeta = new Map<string, { table: unknown; entityId: string }>();
      for (const c of changes) {
        const groupKey = `${c.entityKey}#${c.entityId}`;
        const spec = ENTITY_TABLES[c.entityKey]!;
        const col = spec.columns[c.field];
        if (!col) {
          throw new Error(`revertChanges: field "${c.field}" is not writable on ${c.entityKey}`);
        }
        const patch = patchByKeyRow.get(groupKey) ?? { ...{} };
        patch[c.field] = decodeChangeValue(
          col,
          c.oldValue,
          `revertChanges: field "${c.field}" on ${groupKey}`,
        );
        patchByKeyRow.set(groupKey, patch);
        if (!keyRowMeta.has(groupKey)) {
          keyRowMeta.set(groupKey, { table: spec.table, entityId: c.entityId });
        }
      }
      const results: unknown[][] = [];
      const labels: string[] = [];
      await db.transaction(async (trx) => {
        for (const [groupKey, patch] of patchByKeyRow) {
          const meta = keyRowMeta.get(groupKey)!;
          const table = meta.table as typeof characters; // same cast style as applyChanges' grouped writes
          const rows = await trx
            .update(table)
            .set(patch as unknown as typeof chapters.$inferInsert)
            .where(and(eq(table.id, meta.entityId), eq(table.projectId, projectId)))
            .returning({ id: table.id });
          results.push(rows as unknown as unknown[]);
          labels.push(groupKey);
        }
      });
      for (let i = 0; i < results.length; i++) {
        const rows = results[i];
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error(
            `revertChanges: entity ${labels[i]} vanished between pre-check and write — nothing was reverted`,
          );
        }
      }
      return [];
    },
  };
}

// Default-singleton consts over the lazy `sqliteDb` proxy — mirroring pg's
// global-const export shape so a local composition root wires identically;
// the proxy defers all real work until first call (see src/db/sqlite.ts).
export const sqliteChapterRepository = makeSqliteChapterRepository(sqliteDb);
export const sqliteProjectRepository = makeSqliteProjectRepository(sqliteDb);
export const sqliteChildResourceRepository = makeSqliteChildResourceRepository(sqliteDb);
export const sqliteStoryBibleRepository = makeSqliteStoryBibleRepository(sqliteDb);
export const sqlitePostCommitHooks = makeSqlitePostCommitHooks(sqliteDb);
export const sqliteStoryTransactionRepository = makeSqliteStoryTransactionRepository(sqliteDb);
export const sqliteStoryHistoryRepository = makeSqliteStoryHistoryRepository(sqliteDb);

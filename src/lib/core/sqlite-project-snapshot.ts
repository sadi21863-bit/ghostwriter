/**
 * Master-plan Phase 3 — the canonical portable project snapshot, SQLite side.
 * The ONE `SnapshotPort` implementation: owner-bound reads for
 * `exportProjectSnapshot`, atomic id-preserving writes for
 * `importProjectSnapshot` (a single native `db.transaction` — the wave-6
 * atomic primitive, all-or-nothing across every collection).
 *
 * Facts this file relies on, verified at build time:
 *  - every child snapshot table carries a real `project_id` FK
 *    (`sqlite-schema.ts`), so one `eq(projectId, …)` collects it;
 *  - `epochMs` columns report `dataType: "date"` at runtime, `mode:"json"`
 *    text columns report `"json"` — date values in the envelope are ISO
 *    strings (JSON's own Date serialization) and are revived GENERICALLY per
 *    `column.dataType` (the change-wire codec's runtime-column trick), never
 *    by a hand-kept per-table reviver that could drift from the schema;
 *  - every `createdAt`/`updatedAt` was materialized at export, so inserts
 *    never rely on DDL defaults — carried values land verbatim;
 *  - ids are preserved byte-for-byte (§10: application-generated TEXT ids ARE
 *    the portable identity), the project row is re-owned to the composition's
 *    ONE owner (`localOwnerId`, §5.6 — a cloud userId must never tag along),
 *    and `contentRevision` steps exactly once per successful import (§11.1's
 *    bulk-import rule).
 */

import { and, eq, getTableColumns } from "drizzle-orm";

import {
  SNAPSHOT_COLLECTIONS as SNAPSHOT_COLLECTIONS_ORDERED,
  SnapshotConflictError,
  type ProjectSnapshotEnvelope,
  type SnapshotChildKind,
  type SnapshotPort,
  type SnapshotRow,
  type SnapshotRows,
} from "@/lib/core/handlers/portability";
import type { DrizzleSqliteDb } from "@/db/sqlite";
import { projects } from "@/db/sqlite-schema";
import {
  chapters,
  characters,
  locations,
  plotThreads,
  storyThreads,
  storyPromises,
  editorNotes,
  worldEntities,
  referenceWorks,
  characterRelationships,
  storyMemories,
  characterEvolutionLog,
  storyCheckpoints,
  storyPlans,
  comicPages,
  comicPanels,
  productionShots,
  storyTransactions,
  storyChanges,
} from "@/db/sqlite-schema";

type SnapshotTable = { id: any; projectId: any; userId: any } & Record<string, any>;

/**
 * kind → table, keyed by the handler's own `SnapshotChildKind` union — the
 * kind-set equality between the two sides is pinned by the parity test, so a
 * schema table added to the envelope without a mirror here (or vice versa)
 * fails that build instead of silently truncating a snapshot.
 */
const SNAPSHOT_TABLES: Record<SnapshotChildKind, SnapshotTable> = Object.assign(Object.create(null), {
  chapters: chapters as unknown as SnapshotTable,
  characters: characters as unknown as SnapshotTable,
  locations: locations as unknown as SnapshotTable,
  plotThreads: plotThreads as unknown as SnapshotTable,
  storyThreads: storyThreads as unknown as SnapshotTable,
  storyPromises: storyPromises as unknown as SnapshotTable,
  editorNotes: editorNotes as unknown as SnapshotTable,
  worldEntities: worldEntities as unknown as SnapshotTable,
  referenceWorks: referenceWorks as unknown as SnapshotTable,
  characterRelationships: characterRelationships as unknown as SnapshotTable,
  storyMemories: storyMemories as unknown as SnapshotTable,
  characterEvolutionLog: characterEvolutionLog as unknown as SnapshotTable,
  storyCheckpoints: storyCheckpoints as unknown as SnapshotTable,
  storyPlans: storyPlans as unknown as SnapshotTable,
  comicPages: comicPages as unknown as SnapshotTable,
  comicPanels: comicPanels as unknown as SnapshotTable,
  productionShots: productionShots as unknown as SnapshotTable,
  storyTransactions: storyTransactions as unknown as SnapshotTable,
  storyChanges: storyChanges as unknown as SnapshotTable,
});

const OWNER_CHECKED_SELECT = projects as unknown as SnapshotTable;

function emptyChildRows(): Record<SnapshotChildKind, SnapshotRow[]> {
  return Object.assign(Object.create(null), {
    chapters: [],
    characters: [],
    locations: [],
    plotThreads: [],
    storyThreads: [],
    storyPromises: [],
    editorNotes: [],
    worldEntities: [],
    referenceWorks: [],
    characterRelationships: [],
    storyMemories: [],
    characterEvolutionLog: [],
    storyCheckpoints: [],
    storyPlans: [],
    comicPages: [],
    comicPanels: [],
    productionShots: [],
    storyTransactions: [],
    storyChanges: [],
  }) as Record<SnapshotChildKind, SnapshotRow[]>;
}

/**
 * ISO-string date columns → real `Date`s, generically by runtime dataType —
 * the same driver-runtime technique the change-wire codec uses. Everything
 * else passes through verbatim (json columns carry their parsed shapes,
 * numbers their doubles, nulls their nulls).
 */
function reviveRow(table: SnapshotTable, row: SnapshotRow): Record<string, unknown> {
  const columns = getTableColumns(table as never) as Record<string, { dataType?: string }>;
  const revived: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const dataType = columns[key]?.dataType;
    revived[key] =
      dataType === "date" && typeof value === "string" ? new Date(value) : value;
  }
  return revived;
}

export function makeSqliteProjectSnapshotPort(db: DrizzleSqliteDb, ownerId: string): SnapshotPort {
  return {
    async readSnapshot(projectId) {
      const [project] = await db
        .select()
        .from(OWNER_CHECKED_SELECT as never)
        .where(
          and(
            eq(OWNER_CHECKED_SELECT.id, projectId),
            // The ownership predicate is the bundle's own owner row (stage (d)'s
            // findOwned shape): the ctx actor is the transport credential, never
            // the users-row guarantee — a stranger/foreign id reads as null.
            eq(OWNER_CHECKED_SELECT.userId, ownerId),
          ),
        )
        .limit(1);
      if (!project) return { project: null, rowsByKind: emptyChildRows() };

      const rowsByKind: Record<SnapshotChildKind, SnapshotRow[]> = emptyChildRows();
      for (const [kind, table] of Object.entries(SNAPSHOT_TABLES) as [
        SnapshotChildKind,
        SnapshotTable,
      ][]) {
        rowsByKind[kind] = (await db
          .select()
          .from(table as never)
          .where(eq(table.projectId, projectId))
          .orderBy(table.id)) as unknown as SnapshotRow[];
      }
      return { project: { ...(project as Record<string, unknown>) }, rowsByKind };
    },

    async writeSnapshot(envelope) {
      const [
        { kind: kind0, rows: projectRows },
        ...childEntries
      ] = envelope.collections as unknown as [
        { kind: "project"; rows: SnapshotRows },
        ...{ kind: SnapshotChildKind; rows: SnapshotRows }[],
      ];
      const projectRow = { ...(projectRows[0] as SnapshotRow & { id: string }) };
      const projectId = String(projectRow["id"]);
      // The validated envelope carries every kind exactly once, but a client
      // may shuffle entries — the writer NEVER trusts received order. Rows are
      // indexed by kind; the write pass walks the handler's own FK order, so a
      // child never names a parent row that does not exist yet.
      const rowsByKind = new Map<SnapshotChildKind, SnapshotRows>(
        childEntries.map((e) => [e.kind, e.rows]),
      );

      // Endpoint conflict: an existing project (ANY owner — an id is globally
      // unique in this db) can never be "restored" over. The handler maps this
      // to 409; a bulletproof import must never depend on transaction ORDER to
      // surface it, so the check runs before seeding.
      const [existing] = await db
        .select({ id: OWNER_CHECKED_SELECT.id })
        .from(OWNER_CHECKED_SELECT as never)
        .where(eq(OWNER_CHECKED_SELECT.id, projectId))
        .limit(1);
      if (existing) {
        throw new SnapshotConflictError(`project ${projectId} already exists in this db`);
      }

      const imported = Object.assign(Object.create(null), {}) as Record<SnapshotChildKind, number>;

      await db.transaction(async (trx) => {
        // The project row itself: re-owned, not carried. §5.6 — the envelope's
        // userId is a CLOUD identity; the local host writes its OWN owner row.
        delete projectRow["userId"];
        const owned = { ...reviveRow(OWNER_CHECKED_SELECT, projectRow), userId: ownerId };
        await trx.insert(OWNER_CHECKED_SELECT as never).values(owned as never);

        for (const kind of SNAPSHOT_COLLECTIONS_ORDERED.filter((k) => k !== "project")) {
          const childKind = kind as SnapshotChildKind;
          const rows = rowsByKind.get(childKind);
          if (!rows || rows.length === 0) {
            imported[childKind] = 0;
            continue;
          }
          const table = SNAPSHOT_TABLES[childKind];
          const revived = rows.map((row) => reviveRow(table, row as SnapshotRow));
          await trx.insert(table as never).values(revived as never);
          imported[childKind] = revived.length;
        }

        // §11.1 — bulk import increments ONCE, transactionally, after every
        // canonical row landed. The envelope's carried revision is the export
        // snapshot's: +1 marks this db's own story history point.
        const carried = typeof projectRow["contentRevision"] === "number" ? projectRow["contentRevision"] : 0;
        await trx
          .update(OWNER_CHECKED_SELECT as never)
          .set({ contentRevision: carried + 1 })
          .where(eq(OWNER_CHECKED_SELECT.id, projectId));
      });

      return {
        project: {
          id: projectId,
          name: String(projectRow["name"] ?? ""),
          format: String(projectRow["format"] ?? ""),
          contentRevision: (typeof projectRow["contentRevision"] === "number" ? projectRow["contentRevision"] : 0) + 1,
        },
        imported,
      };
    },
  };
}

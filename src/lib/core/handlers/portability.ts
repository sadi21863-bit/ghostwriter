/**
 * Master-plan Phase 3's last unshipped piece — the canonical portable project
 * snapshot (§10: "Portable Markdown/JSON remains a versioned export/import
 * snapshot, never a co-canonical file tree" / §10.1: since the legacy DB is
 * REACHABLE (Preflight 0), the importer/exporter is a REAL forward migration,
 * not a fixture exercise). One business handler per verb over ONE port:
 *
 *  - `exportProjectSnapshot` — a pure read assembly: the project row + the 19
 *    project-scoped story collections, in FK order, as a versioned JSON
 *    envelope with a SHA-256 integrity checksum over the collections body.
 *  - `importProjectSnapshot` — structural validation (format/version/complete
 *    kind set/row shapes/checksum), THEN the port's atomic write: all rows the
 *    envelope carries land in one transaction with their IDs preserved
 *    verbatim (§10: "UUID -> application-generated TEXT IDs" — the ids ARE the
 *    application's ids), the project re-owned by the composition's ONE owner
 *    row (§5.6's `localOwnerId` — the cloud userId must never tag along), and
 *    ONE contentRevision bump per §11.1's bulk-import rule.
 *
 * The include-list is FK-CLOSED and deliberately narrower than the 43-table
 * baseline. INCLUDED (20 collections): the project row plus every project_id-
 * FK'd canonical story surface — chapters, characters, locations,
 * plot_threads, story_threads, story_promises, editor_notes, world_entities,
 * reference_works, character_relationships, story_memories,
 * character_evolution_log, story_checkpoints, story_plans, story_transactions
 * (the §13.1 audit trail), story_changes, comic_pages, comic_panels,
 * production_shots. EXCLUDED, each for a documented reason:
 *
 *  - identity/billing/infra: users, accounts, sessions, subscriptions,
 *    referrals, password/email tokens, platform_events — the local import
 *    re-owns everything to the host's own owner row, so a foreign userId can
 *    never even enter the envelope;
 *  - cloud activity artifacts: generations (the cloud meter's log — a local
 *    host has its own `LocalGenerationMeter` composition), semantic_cache,
 *    showcases/reader_sessions/reader_reactions (§15 cloud/module-only),
 *    audio_exports + video_analysis_jobs (optional-module media artifacts),
 *    creator_bibles (§15 disabled module);
 *  - user-level craft data: work_packets/work_patterns, series_bibles,
 *    universes + universe_characters/events — and `project_character_states`
 *    with them, because a row FKs a universe character: importing PMCs without
 *    their universe rows would violate the FK, and universes are user-level
 *    series data outside a per-project snapshot. A later series-level slice
 *    can compose that closure.
 *
 * Dates ride the envelope as ISO strings (JSON's own serialization of Date);
 * revival back to `Date` happens generically per `column.dataType === "date"`
 * in the SQLite port — the same driver-runtime trick the change-wire codec
 * uses (§ wave 6), so there is NO hand-kept per-table reviver to drift. The
 * checksum stays valid across a network round trip because every `Date`
 * stringifies to exactly the quoted ISO string the JSON body already carries.
 */

import { createHash } from "node:crypto";

import type { RequestContext } from "@/lib/core/request-context";
import { mayAccessProject } from "@/lib/core/request-context";

export const SNAPSHOT_FORMAT = "ghostwriter.project-snapshot";
export const SNAPSHOT_VERSION = 1;

/**
 * The kinds in FK order — an import walks this list, so a child collection
 * never names a parent row that does not exist yet. The `project` collection
 * carries exactly one row (the project itself). The set-equality of this list
 * against the SQLite port's table map is pinned by test.
 */
export const SNAPSHOT_COLLECTIONS = [
  "project",
  "chapters",
  "characters",
  "locations",
  "plotThreads",
  "storyThreads",
  "storyPromises",
  "editorNotes",
  "worldEntities",
  "referenceWorks",
  "characterRelationships",
  "storyMemories",
  "characterEvolutionLog",
  "storyCheckpoints",
  "storyPlans",
  "comicPages",
  "comicPanels",
  "productionShots",
  "storyTransactions",
  "storyChanges",
] as const;

export type SnapshotKind = typeof SNAPSHOT_COLLECTIONS[number];
export type SnapshotChildKind = Exclude<SnapshotKind, "project">;

export type SnapshotRow = Record<string, unknown>;
export type SnapshotRows = ReadonlyArray<SnapshotRow>;

export interface SnapshotChildCollection {
  readonly kind: SnapshotChildKind;
  readonly rows: SnapshotRows;
}

/**
 * The wire shape, versioned. `meta.checksum` is the SHA-256 hex digest of
 * `JSON.stringify(collections)` — an import recomputes it before trusting
 * anything beyond the envelope's first bytes (a truncated copy fails closed
 * with 400).
 */
export interface ProjectSnapshotEnvelope {
  readonly format: typeof SNAPSHOT_FORMAT;
  readonly version: number;
  readonly meta: {
    readonly exportedAt: string;
    readonly exportedBy: string;
    readonly project: { readonly id: string; readonly name: string; readonly format: string };
    readonly checksum: string;
  };
  readonly collections: readonly [
    { readonly kind: "project"; readonly rows: [SnapshotRow] },
    ...SnapshotChildCollection[],
  ];
}

/**
 * The one port both verbs compose through. `readSnapshot` owns the ownership
 * predicate (it is factory-bound to the composition's owner row, exactly like
 * stage (d)'s `findOwned(projectId, localOwnerId)`; a stranger/foreign-owner
 * project is `project: null` — the handler 404s). `writeSnapshot` owns the
 * atomicity (one transaction), the re-owning, and the contentRevision bump.
 */
export interface SnapshotPort {
  readSnapshot(projectId: string): Promise<{
    project: SnapshotRow | null;
    rowsByKind: Readonly<Record<SnapshotChildKind, SnapshotRows>>;
  }>;
  writeSnapshot(envelope: ProjectSnapshotEnvelope): Promise<{
    project: { id: string; name: string; format: string; contentRevision: number | null };
    imported: Readonly<Record<SnapshotChildKind, number>>;
  }>;
}

export type ExportSnapshotOutcome =
  | { ok: true; payload: ProjectSnapshotEnvelope }
  | { ok: false; status: 403 | 404; reason: string };

export type ImportSnapshotOutcome =
  | {
      ok: true;
      payload: {
        project: { id: string; name: string; format: string; contentRevision: number | null };
        imported: Readonly<Record<SnapshotChildKind, number>>;
      };
    }
  | { ok: false; status: 400 | 403 | 409; reason: string };

export function snapshotChecksum(collectionsJson: string): string {
  return createHash("sha256").update(collectionsJson).digest("hex");
}

/**
 * Thrown by the port when an envelope's project id already exists in the
 * destination db (an id is globally unique — ANY owner). The handler maps it
 * to 409; the existence check runs before seeding so the failure never
 * depends on transaction order.
 */
export class SnapshotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotConflictError";
  }
}

/**
 * GET → the envelope. Out-of-scope 403 via the shared `mayAccessProject`
 * predicate BEFORE the port (the run-plan mount's ordering); a stranger or
 * foreign-owner id is 404 — the port's own owner row never sees it.
 */
export async function exportProjectSnapshot(
  ctx: RequestContext,
  input: { projectId: string },
  port: SnapshotPort,
): Promise<ExportSnapshotOutcome> {
  if (!mayAccessProject(ctx, input.projectId)) {
    return { ok: false, status: 403, reason: "Project out of scope" };
  }
  const { project, rowsByKind } = await port.readSnapshot(input.projectId);
  if (!project) return { ok: false, status: 404, reason: "Not found" };

  const collections: ProjectSnapshotEnvelope["collections"] = [
    { kind: "project" as const, rows: [project] },
    ...packages(rowsByKind),
  ];
  const checksum = snapshotChecksum(JSON.stringify(collections));
  const envelope: ProjectSnapshotEnvelope = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    meta: {
      exportedAt: new Date().toISOString(),
      exportedBy: ctx.actor.id,
      project: {
        id: String(project["id"]),
        name: String(project["name"]),
        format: String(project["format"]),
      },
      checksum,
    },
    collections,
  };
  return { ok: true, payload: envelope };
}

export function packages(
  collections: Readonly<Record<SnapshotChildKind, SnapshotRows>>,
): SnapshotChildCollection[] {
  return SNAPSHOT_COLLECTIONS.filter(
    (kind): kind is SnapshotChildKind => kind !== "project",
  ).map((kind) => ({ kind, rows: collections[kind] ?? [] }));
}

/**
 * POST → import. Validation order is deliberate: shape (the cheapest checks)
 * → checksum (integrity, no row trusted past the envelope) → kind-set
 * completeness (a partial copy must never "restore" silently) → then the port.
 */
export async function importProjectSnapshot(
  ctx: RequestContext,
  input: { snapshot: unknown },
  port: SnapshotPort,
): Promise<ImportSnapshotOutcome> {
  if (ctx.projectScope) {
    // An import CREATES a project; a scope-pinned context restricts every
    // action to ONE existing project, so importing under it is out of scope
    // by definition (the export direction handles scope normally).
    return { ok: false, status: 403, reason: "Importing is not allowed within a project-scoped context" };
  }
  const verdict = validateEnvelope(input.snapshot);
  if (!verdict.ok) return { ok: false, status: 400, reason: verdict.reason };

  const projectRow = verdict.projectRow;
  const project = {
    id: String(projectRow["id"] ?? ""),
    name: String(projectRow["name"] ?? ""),
    format: String(projectRow["format"] ?? ""),
  };
  if (!project.id) return { ok: false, status: 400, reason: "Snapshot project row has no id" };

  let written;
  try {
    written = await port.writeSnapshot(verdict.envelope);
  } catch (err) {
    if (err instanceof SnapshotConflictError) {
      return { ok: false, status: 409, reason: err.message };
    }
    throw err;
  }
  return {
    ok: true,
    payload: { project: written.project, imported: written.imported },
  };
}

interface ValidatedEnvelope {
  ok: true;
  envelope: ProjectSnapshotEnvelope;
  projectRow: SnapshotRow;
}
interface RejectedEnvelope {
  ok: false;
  reason: string;
}

function validateEnvelope(raw: unknown): ValidatedEnvelope | RejectedEnvelope {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Snapshot must be an object" };
  const body = raw as Record<string, unknown>;
  if (body["format"] !== SNAPSHOT_FORMAT) {
    return { ok: false, reason: `Snapshot format must be ${SNAPSHOT_FORMAT}` };
  }
  if (body["version"] !== SNAPSHOT_VERSION) {
    return { ok: false, reason: `Snapshot version must be ${SNAPSHOT_VERSION}` };
  }
  const collections = body["collections"];
  if (!Array.isArray(collections)) return { ok: false, reason: "Snapshot collections must be an array" };

  const projectEntry = collections.find(
    (c): c is { kind: SnapshotKind; rows: unknown[] } =>
      typeof (c as { kind?: unknown })?.kind === "string" && (c as { kind?: unknown }).kind === "project",
  );
  if (!projectEntry || !Array.isArray(projectEntry.rows) || projectEntry.rows.length !== 1) {
    return { ok: false, reason: "The project collection must carry exactly one row" };
  }
  const projectRow = (projectEntry.rows[0] ?? null) as SnapshotRow | null;
  if (!projectRow || typeof projectRow !== "object" || typeof projectRow["id"] !== "string" || !projectRow["id"]) {
    return { ok: false, reason: "The project row must carry an id" };
  }

  // Every collection is an array of plain row objects — the DB is the real
  // column validator (notNull/unique/FK), the envelope is only structure.
  for (const entry of collections as unknown[]) {
    if (!entry || typeof entry !== "object") return { ok: false, reason: "Snapshot collections must be objects" };
    const e = entry as Record<string, unknown>;
    if (typeof e["kind"] !== "string" || !(SNAPSHOT_COLLECTIONS as readonly string[]).includes(e["kind"])) {
      return { ok: false, reason: `Unknown snapshot kind: ${String(e["kind"])}` };
    }
    if (!Array.isArray(e["rows"])) return { ok: false, reason: `Collection ${e["kind"]} rows must be an array` };
    for (const row of e["rows"] as unknown[]) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { ok: false, reason: `Collection ${e["kind"]} rows must be objects` };
      }
    }
  }
  const kinds = (collections as { kind: string }[]).map((c) => c.kind);
  if (kinds.length !== SNAPSHOT_COLLECTIONS.length) {
    return { ok: false, reason: "Snapshot collections must carry each kind exactly once" };
  }
  const kindSet = new Set(kinds);
  for (const expected of SNAPSHOT_COLLECTIONS) {
    if (!kindSet.has(expected)) return { ok: false, reason: `Snapshot is missing the ${expected} collection` };
  }
  if (kindSet.size !== kinds.length) {
    return { ok: false, reason: "Snapshot collections must carry each kind exactly once" };
  }

  const meta = body["meta"] as Record<string, unknown> | undefined;
  if (!meta || typeof meta["checksum"] !== "string" || !meta["checksum"]) {
    return { ok: false, reason: "Snapshot meta.checksum is required" };
  }
  const computed = snapshotChecksum(JSON.stringify(collections));
  if (computed !== meta["checksum"]) {
    return { ok: false, reason: "Snapshot checksum mismatch — the copy is truncated or altered" };
  }

  return { ok: true, envelope: body as unknown as ProjectSnapshotEnvelope, projectRow };
}

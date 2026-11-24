/**
 * Phase 2 / v4 §7 — the relationship-map business handlers (GET graph + PATCH
 * upserts), formerly the 149-line compound
 * `src/app/api/projects/[projectId]/relationship-map/route.ts`.
 *
 * The route mixed auth, the co-occurrence graph build (characters x chapters →
 * edges, with stored relationship data layered on top), and the pair upsert
 * write into one file. This module owns the RequestContext/authorization
 * contract and the response SHAPE definitions; the DB reads and the
 * transformation are carried verbatim by the pg adapter in
 * `pg-relationship-repos.ts`, exactly as `getStoryBible`'s and
 * `story-history`'s ports leave their read shapes to their adapters.
 *
 * Shape contract (the paths the UI reads must not drift):
 *  - `readRelationshipMap` resolves to the GET body the route used to emit
 *    verbatim: `{ nodes, edges, isolated }`.
 *  - `upsertRelationshipMap` resolves to the full `character_relationships`
 *    row the PATCH route used to emit verbatim.
 *
 * The canonical-mutation hook ("relationship.upsert", §11 revision increment)
 * is new wiring mandated by the port pattern: the legacy route never bumped
 * `contentRevision`, but a link created between characters is a canon change.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface RelationshipMapNode {
  id: string;
  name: string;
  role: string | null;
  portraitUrl: string | null;
}

export interface RelationshipMapEdge {
  charAId: string;
  charBId: string;
  charAName: string;
  charBName: string;
  sharedChapters: number;
  trustLevel: number;
  relationshipType: string;
  fourHorsemen: { criticism: number; contempt: number; defensiveness: number; stonewalling: number };
  notes: string;
}

/** The exact GET payload the legacy route emitted — same keys, same order. */
export interface RelationshipMapGraph {
  nodes: RelationshipMapNode[];
  edges: RelationshipMapEdge[];
  isolated: { id: string; name: string }[];
}

/** Fields the PATCH body may carry. Everything else a caller sends is ignored. */
export interface RelationshipMapUpsertPayload {
  characterAId: string;
  characterBId: string;
  trustLevel?: number;
  relationshipType?: string;
  notes?: string;
  fourHorsemen?: { criticism: number; contempt: number; defensiveness: number; stonewalling: number };
  powerDifferential?: number;
  emotionalRegister?: string;
  knowledgeAsymmetry?: string;
  dependencyStructure?: string;
  attachmentStyleA?: string;
  arcTrajectory?: string;
}

/** The full stored row — the exact PATCH response body the route emitted. */
export interface RelationshipMapRow {
  id: string;
  projectId: string;
  characterAId: string;
  characterBId: string;
  trustLevel: number | null;
  relationshipType: string | null;
  notes: string | null;
  fourHorsemen: { criticism: number; contempt: number; defensiveness: number; stonewalling: number } | null;
  powerDifferential: number | null;
  emotionalRegister: string | null;
  knowledgeAsymmetry: string | null;
  dependencyStructure: string | null;
  attachmentStyleA: string | null;
  arcTrajectory: string | null;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface RelationshipMapRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /**
   * Build the relationship graph for a project — the legacy GET body:
   * co-occurrence edges over chapter text layered with stored relationship
   * data, every character as a node, unconnected characters isolated.
   */
  readGraph(projectId: string): Promise<RelationshipMapGraph>;
  /**
   * Create-or-update the (order-normalized) link between two characters.
   * Returns the stored row, or null when the row vanished between read and
   * write — a refusal the handler shapes instead of a serialization crash.
   */
  upsertRelationships(
    projectId: string,
    payload: RelationshipMapUpsertPayload,
  ): Promise<RelationshipMapRow | null>;
}

export type ReadRelationshipMapResult =
  | { ok: true; graph: RelationshipMapGraph }
  | { ok: false; status: 403 | 404; reason: string };

export type UpsertRelationshipMapResult =
  | { ok: true; row: RelationshipMapRow }
  | { ok: false; status: 403 | 404; reason: string };

/** The PATCH input the route hands over after its own 400 validation. */
export type UpsertRelationshipMapInput = RelationshipMapUpsertPayload & { projectId: string };

export async function readRelationshipMap(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<RelationshipMapRepository, "ownsProject" | "readGraph">,
): Promise<ReadRelationshipMapResult> {
  // A context scoped to another project must never read this graph. Refusing
  // explicitly beats trusting the repository's WHERE clause (same rule as
  // `updateChapter`).
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const graph = await repo.readGraph(input.projectId);
  return { ok: true, graph };
}

export async function upsertRelationshipMap(
  ctx: RequestContext,
  input: UpsertRelationshipMapInput,
  repo: Pick<RelationshipMapRepository, "ownsProject" | "upsertRelationships">,
  hooks: PostCommitHooks = {},
): Promise<UpsertRelationshipMapResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // Payload passthrough: the handler owns nothing but the scope split. The
  // pair-ordering normalization, the conditional update set, and the insert
  // defaults are repository concerns (they mirror the legacy write verbatim),
  // so mutating them here would fork the local host from the pg adapter.
  const { projectId, ...payload } = input;
  // `projectId` from the URL outranks anything the client sent, and the handler
  // constructs the input itself, so the destructured payload is exactly the
  // validated body fields.
  const row = await repo.upsertRelationships(projectId, payload);
  // No row back means the link vanished between the read and the write. The
  // legacy route would have serialized `undefined` and crashed; the union
  // shapes it as the same "not found" business error instead.
  if (!row) return { ok: false, status: 404, reason: "Not found" };

  // Post-commit only: a refused or unmatched write can never bump the
  // revision. Linking two characters is a canon change (§11).
  await hooks.onCanonicalMutation?.(projectId, "relationship.upsert");

  return { ok: true, row };
}

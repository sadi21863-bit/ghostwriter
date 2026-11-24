import { DIFF_FIELDS, canonicalFieldValue, type EntityKey } from "@/lib/ai/entity-extraction";

/**
 * §13.1 — the client adapter that turns a World Bible / Story Bible form save
 * into a `user-edit` story transaction instead of a direct entity PATCH.
 *
 * Semantics preserved from the old `PATCH …/{entity}/{id}` body-with-draft flow:
 *
 *  1. The draft carries the fields the form intends to write (PATCH semantics),
 *     so diffing runs over the DRAFT'S keys — not over the allowlist — letting a
 *     default-seeded form object (e.g. `DEFAULT_CHAR`) sit still.
 *  2. Fields where the draft equals the entity's canonical value are skipped
 *     (the old PATCH wrote them unchanged; recording them would be noise).
 *  3. Fields OUTSIDE the allowlist (by design: voiceId/portraitUrl/soulId media
 *     metadata) still write, but through a residual direct PATCH that carries
 *     ONLY those fields — the old route's ALLOWED_FIELDS filter did the same
 *     subsetting silently. Skipping the residual when empty avoids the second
 *     round-trip in the common case.
 *  4. Clearing a field (empty string/object/array draft value) is RECORDED, not
 *     skipped: the transaction must be able to revert a clear.
 *  5. The apply path accepts `{transaction}`, not entity rows, so the caller
 *     merges locally — built from the entity + the exact draft values that were
 *     recorded/written, never from the raw wire strings.
 */

/** One allowlisted, canonical-encoded change, wire-shaped for the route. */
export interface EntityEditChange {
  entityKey: EntityKey;
  entityId: string;
  field: string;
  /** Canonical string of the entity's current value ("" when unset/empty). */
  oldValue: string;
  /** Canonical string of the draft value ("" when the form cleared it). */
  newValue: string;
}

export interface BuiltEntityEdit {
  entityKey: EntityKey;
  entityId: string;
  changes: EntityEditChange[];
  /** Draft fields with real diffs but no allowlist entry; these ride the
   * residual PATCH verbatim (draft-typed values, not canonical strings). */
  excluded: Record<string, unknown>;
}

export type EntityEditSaveResult =
  | { ok: true; updated: Record<string, unknown>; transaction: unknown | null }
  | { ok: false; step: "transaction" | "residual"; status?: number; error: unknown };

export function buildEntityEditTransaction(
  entityKey: EntityKey,
  entity: Record<string, unknown>,
  draft: Record<string, unknown>,
): BuiltEntityEdit {
  const writable = new Set(DIFF_FIELDS[entityKey].map((f) => f.field));
  const changes: EntityEditChange[] = [];
  const excluded: Record<string, unknown> = {};
  // Object.keys order = the draft's insertion order, deterministic per built
  // form payload; that is the field order the transaction records.
  for (const field of Object.keys(draft)) {
    const wireNew = canonicalFieldValue(draft[field]);
    const wireOld = canonicalFieldValue(entity[field]);
    if (wireNew === wireOld) continue;
    if (writable.has(field)) {
      changes.push({
        entityKey,
        entityId: String(entity.id ?? ""),
        field,
        oldValue: wireOld,
        newValue: wireNew,
      });
    } else {
      excluded[field] = draft[field];
    }
  }
  return { entityKey, entityId: String(entity.id ?? ""), changes, excluded };
}

export async function saveEntityEdit(input: {
  projectId: string;
  entityKey: EntityKey;
  entity: Record<string, unknown>;
  draft: Record<string, unknown>;
}): Promise<EntityEditSaveResult> {
  const { projectId, entityKey, entity, draft } = input;
  const built = buildEntityEditTransaction(entityKey, entity, draft);

  // Nothing to write anywhere — the save is a true no-op.
  if (!built.changes.length && Object.keys(built.excluded).length === 0) {
    return { ok: true, updated: { ...entity }, transaction: null };
  }

  let merged: Record<string, unknown> = { ...entity };
  let transaction: unknown = null;

  if (built.changes.length) {
    let res: Response;
    try {
      res = await fetch(`/api/projects/${projectId}/story-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "user-edit", changes: built.changes }),
      });
    } catch (e) {
      return { ok: false, step: "transaction", error: e };
    }
    if (!res.ok) {
      let body: unknown = null;
      try { body = await res.json(); } catch { /* unparseable body = generic failure */ }
      return { ok: false, step: "transaction", status: res.status, error: body };
    }
    try { transaction = (await res.json())?.transaction ?? null; } catch { transaction = null; }
    // Local-apply the recorded fields from the DRAFT (decoded, typed values) —
    // never the canonical strings, and only pick the changes actually accepted.
    for (const c of built.changes) {
      merged = { ...merged, [c.field]: draft[c.field] };
    }
  }

  if (Object.keys(built.excluded).length) {
    const entityId = String(entity.id ?? "");
    let res: Response;
    try {
      res = await fetch(`/api/projects/${projectId}/${pathFor(entityKey)}/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.excluded),
      });
    } catch (e) {
      return { ok: false, step: "residual", error: e };
    }
    if (!res.ok) {
      let body: unknown = null;
      try { body = await res.json(); } catch { /* generic failure */ }
      return { ok: false, step: "residual", status: res.status, error: body };
    }
    // The residual patch is the server's authority for those fields.
    let row: Record<string, unknown> | null = null;
    try { row = await res.json(); } catch { row = null; }
    if (row && typeof row === "object" && !Array.isArray(row)) merged = { ...merged, ...row };
    else merged = { ...merged, ...built.excluded };
  }

  return { ok: true, updated: merged, transaction };
}

function pathFor(entityKey: EntityKey): string {
  return { characters: "characters", locations: "locations", plotThreads: "plot-threads", worldEntities: "world-entities" }[entityKey];
}

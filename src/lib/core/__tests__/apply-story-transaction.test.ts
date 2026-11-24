import { describe, it, expect, vi } from "vitest";
import {
  MissingEntitiesError,
  applyStoryTransaction,
  isWritableField,
  validateChanges,
  writableFields,
  type StoryChange,
  type StoryTransaction,
  type StoryTransactionRepository,
} from "@/lib/core/handlers/apply-story-transaction";
import { cloudContext, localContext } from "@/lib/core/request-context";
import { DIFF_FIELDS } from "@/lib/ai/entity-extraction";

/**
 * Phase 2 / v4 §7 + §13.1 — `applyStoryTransaction`.
 *
 * The property under test is §13.1's: "Model output proposes canon changes; no
 * AI call mutates canonical state directly." These tests exist so a
 * hand-crafted or model-influenced transaction can never write a server-owned
 * column, and so a rejected transaction leaves canon untouched.
 */

const ctx = cloudContext("u1");
const projectId = "proj-1";

const change = (over: Partial<StoryChange> = {}): StoryChange => ({
  entityKey: "characters",
  entityId: "c1",
  field: DIFF_FIELDS.characters[0]!.field,
  oldValue: "old",
  newValue: "new",
  ...over,
});

function repo(over: Partial<StoryTransactionRepository> = {}) {
  const ownsProject = vi.fn(async (_p: string, _a: string) => true);
  const record = vi.fn(async (_tx: StoryTransaction) => {});
  const applyChanges = vi.fn(async (_p: string, _tx: StoryTransaction) => {});
  return { ownsProject, record, applyChanges, ...over } as unknown as StoryTransactionRepository & {
    ownsProject: typeof ownsProject;
    record: typeof record;
    applyChanges: typeof applyChanges;
  };
}

describe("writable field allowlist", () => {
  it("mirrors the DIFF_FIELDS table the client already uses", () => {
    for (const key of Object.keys(DIFF_FIELDS) as (keyof typeof DIFF_FIELDS)[]) {
      expect([...writableFields(key)].sort()).toEqual(DIFF_FIELDS[key].map((f) => f.field).sort());
    }
  });

  it("never permits server-owned columns", () => {
    // §13.1: model output must not reach canon except through this list.
    for (const key of Object.keys(DIFF_FIELDS) as (keyof typeof DIFF_FIELDS)[]) {
      for (const field of ["id", "projectId", "embedding", "createdAt", "updatedAt"]) {
        expect(isWritableField(key, field)).toBe(false);
      }
    }
  });

  it("never permits production/derived metadata (voiceId and media-asset kin)", () => {
    // §13.1: voiceId is TTS-provider config, not story canon — these stay
    // direct-PATCH columns even with the allowlist opened (§13.1 unblocker).
    for (const key of Object.keys(DIFF_FIELDS) as (keyof typeof DIFF_FIELDS)[]) {
      for (const field of ["voiceId", "portraitUrl", "soulId", "soulIdTrainingJobId"]) {
        expect(isWritableField(key, field)).toBe(false);
      }
    }
  });

  it("accepts the name change every stalled form save carries", () => {
    // StoryBible/WorldBiblePanel drafts always carry name; the allowlist must
    // accept it for those saves to become user-edit transactions.
    for (const key of Object.keys(DIFF_FIELDS) as (keyof typeof DIFF_FIELDS)[]) {
      expect(isWritableField(key, "name")).toBe(true);
    }
  });

  it("accepts link arrays where real columns exist, and nowhere they do not", () => {
    expect(isWritableField("characters", "linkedLocationIds")).toBe(true);
    expect(isWritableField("characters", "linkedPlotThreadIds")).toBe(true);
    expect(isWritableField("locations", "linkedCharacterIds")).toBe(true);
    for (const field of ["linkedCharacterIds", "linkedLocationIds", "linkedPlotThreadIds", "linkedEntityIds"]) {
      expect(isWritableField("worldEntities", field)).toBe(true);
    }
    expect(isWritableField("plotThreads", "linkedCharacterIds")).toBe(false);
  });
});

describe("validateChanges", () => {
  it("accepts well-formed changes and coerces a missing oldValue", () => {
    const r = validateChanges([{ entityKey: "characters", entityId: "c1", field: DIFF_FIELDS.characters[0]!.field, newValue: "v" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valid[0]).toMatchObject({ oldValue: "", newValue: "v" });
  });

  it("rejects a non-writable field such as projectId", () => {
    const r = validateChanges([change({ field: "projectId" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/not writable/);
  });

  it("rejects an unknown entity type", () => {
    const r = validateChanges([{ ...change(), entityKey: "secrets" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/unknown entity type/);
  });

  it("rejects a non-string newValue", () => {
    const r = validateChanges([{ ...change(), newValue: { evil: true } }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/must be a string/);
  });

  it("rejects a missing entityId", () => {
    const r = validateChanges([{ ...change(), entityId: "" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/missing entityId/);
  });

  it("rejects a non-array payload", () => {
    for (const v of [null, undefined, "x", 42, {}]) {
      expect(validateChanges(v).ok).toBe(false);
    }
  });

  it("reports every rejection reason, not just the first", () => {
    const r = validateChanges([change({ field: "id" }), change({ entityId: "" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons).toHaveLength(2);
      expect(r.rejected).toHaveLength(2);
    }
  });

  it("accepts a representative user-edit name change", () => {
    const r = validateChanges([
      { entityKey: "characters", entityId: "c1", field: "name", oldValue: "Ava", newValue: "Ava Cole" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valid[0]).toMatchObject({ field: "name", oldValue: "Ava", newValue: "Ava Cole" });
  });

  it("still 422s a voiceId change", () => {
    expect(validateChanges([change({ field: "voiceId" })]).ok).toBe(false);
  });

  it("rejects the whole user-edit transaction when a voiceId change hides inside it", async () => {
    // All-or-nothing: a legal name change never smuggles production metadata through.
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      {
        projectId,
        source: "user-edit",
        changes: [
          { entityKey: "characters", entityId: "c1", field: "name", oldValue: "Ava", newValue: "Ava Cole" },
          change({ field: "voiceId" }),
        ],
      },
      r,
    );
    expect(out).toMatchObject({ ok: false, status: 422 });
    if (!out.ok) expect(out.rejected).toHaveLength(1);
    expect(r.record).not.toHaveBeenCalled();
    expect(r.applyChanges).not.toHaveBeenCalled();
  });

  it("applies a user-edit name change end to end with its §11 hook kind", async () => {
    const onCanonicalMutation = vi.fn(async () => {});
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      {
        projectId,
        source: "user-edit",
        changes: [{ entityKey: "characters", entityId: "c1", field: "name", oldValue: "Ava", newValue: "Ava Cole" }],
      },
      r,
      { onCanonicalMutation },
    );
    expect(out).toMatchObject({ ok: true });
    if (out.ok) {
      expect(out.transaction.source).toBe("user-edit");
      expect(out.transaction.changes[0]).toMatchObject({ field: "name", newValue: "Ava Cole" });
    }
    expect(onCanonicalMutation).toHaveBeenCalledWith(projectId, "storyTransaction.user-edit");
  });

  it("accepts jsonb link arrays as JSON strings, and rejects a raw array value", () => {
    const ok = validateChanges([
      change({ field: "linkedLocationIds", oldValue: '["l1","l2"]', newValue: '["l1"]' }),
    ]);
    expect(ok.ok).toBe(true);
    const raw = validateChanges([{ ...change(), field: "linkedLocationIds", newValue: ["l1"] }]);
    expect(raw.ok).toBe(false);
    if (!raw.ok) expect(raw.reasons[0]).toMatch(/must be a string/);
  });

  it("accepts worldEntities kind/properties as part of a user-edit transaction", () => {
    const ok = validateChanges([
      { entityKey: "worldEntities", entityId: "w1", field: "name", oldValue: "Ember", newValue: "Ember Prime" },
      { entityKey: "worldEntities", entityId: "w1", field: "kind", oldValue: "object", newValue: "concept" },
      { entityKey: "worldEntities", entityId: "w1", field: "properties", oldValue: "{}", newValue: '{"origin":"myth"}' },
    ]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.valid).toHaveLength(3);
  });
});

describe("applyStoryTransaction", () => {
  it("applies and records a valid transaction", async () => {
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change()], id: "tx-1", now: new Date(0) },
      r,
    );
    expect(out).toMatchObject({ ok: true });
    expect(r.applyChanges).toHaveBeenCalledTimes(1);
    expect(r.record).toHaveBeenCalledTimes(1);
  });

  it("records the transaction BEFORE applying it", async () => {
    // An audit trail that can miss the write it describes is worse than none.
    const order: string[] = [];
    const r = repo({
      record: vi.fn(async () => { order.push("record"); }) as never,
      applyChanges: vi.fn(async () => { order.push("apply"); }) as never,
    });
    await applyStoryTransaction(ctx, { projectId, source: "model-proposal", changes: [change()] }, r);
    expect(order).toEqual(["record", "apply"]);
  });

  it("captures provenance so an audit can tell model output from a human edit", async () => {
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change()], sourceGenerationId: "gen-7", id: "tx-1" },
      r,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.transaction.source).toBe("model-proposal");
      expect(out.transaction.sourceGenerationId).toBe("gen-7");
    }
  });

  it("omits sourceGenerationId for a non-model source", async () => {
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      { projectId, source: "user-edit", changes: [change()], id: "tx-1" },
      r,
    );
    if (out.ok) expect("sourceGenerationId" in out.transaction).toBe(false);
  });

  it("rejects the WHOLE transaction and applies nothing", async () => {
    // Applying the valid subset would leave canon in a state never agreed to.
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      {
        projectId,
        source: "model-proposal",
        changes: [change(), change({ field: "embedding" })],
      },
      r,
    );
    expect(out).toMatchObject({ ok: false, status: 422 });
    expect(r.applyChanges).not.toHaveBeenCalled();
    expect(r.record).not.toHaveBeenCalled();
  });

  it("reports which changes were rejected", async () => {
    const r = repo();
    const out = await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change({ field: "id" })] },
      r,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejected).toHaveLength(1);
  });

  it("404s when the project is not owned and never records", async () => {
    const r = repo({ ownsProject: vi.fn(async () => false) as never });
    expect(await applyStoryTransaction(ctx, { projectId, source: "user-edit", changes: [change()] }, r))
      .toMatchObject({ ok: false, status: 404 });
    expect(r.record).not.toHaveBeenCalled();
  });

  it("403s for a context scoped to another project", async () => {
    const r = repo();
    const out = await applyStoryTransaction(
      localContext({ projectScope: "other" }),
      { projectId, source: "user-edit", changes: [change()] },
      r,
    );
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(r.record).not.toHaveBeenCalled();
    expect(r.applyChanges).not.toHaveBeenCalled();
  });

  it("fires the §11 canonical-mutation hook for canon that actually moved", async () => {
    const onCanonicalMutation = vi.fn(async () => {});
    await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change()] },
      repo(),
      { onCanonicalMutation },
    );
    expect(onCanonicalMutation).toHaveBeenCalledWith(projectId, "storyTransaction.model-proposal");
  });

  it("does NOT fire the revision hook for a rejected transaction", async () => {
    // Incrementing the revision when nothing changed would defeat cache keys.
    const onCanonicalMutation = vi.fn(async () => {});
    await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change({ field: "projectId" })] },
      repo(),
      { onCanonicalMutation },
    );
    expect(onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("uses the injected id and timestamp when supplied", async () => {
    const out = await applyStoryTransaction(
      ctx,
      { projectId, source: "user-edit", changes: [change()], id: "fixed-id", now: new Date("2020-01-01") },
      repo(),
    );
    if (!out.ok) throw new Error("expected ok");
    expect(out.transaction.id).toBe("fixed-id");
    expect(out.transaction.createdAt.toISOString()).toBe("2020-01-01T00:00:00.000Z");
  });

  it("generates a distinct id when none is supplied", async () => {
    const a = await applyStoryTransaction(ctx, { projectId, source: "user-edit", changes: [change()] }, repo());
    const b = await applyStoryTransaction(ctx, { projectId, source: "user-edit", changes: [change()] }, repo());
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.transaction.id).not.toBe(b.transaction.id);
  });

  it("applies an empty transaction without error but records it", async () => {
    // An extraction pass that found nothing is a normal outcome.
    const r = repo();
    const out = await applyStoryTransaction(ctx, { projectId, source: "model-proposal", changes: [] }, r);
    expect(out.ok).toBe(true);
    expect(r.record).toHaveBeenCalledTimes(1);
  });

  it("maps the typed missing-entities failure to a 422 carrying the missing refs (audit row stays)", async () => {
    // §13.1: the entities vanished between validation and the apply pre-check.
    // The response must say WHICH ones, and the recorded audit row must stay —
    // audit-first order is unchanged by the typed failure.
    const missing = [{ entityKey: "characters" as const, entityId: "c9" }];
    const r = repo({
      applyChanges: vi.fn(async () => {
        throw new MissingEntitiesError(missing, "applyChanges: pre-check");
      }) as never,
    });
    const out = await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change({ entityId: "c9" })] },
      r,
    );
    expect(out).toEqual({
      ok: false,
      status: 422,
      reason: "Some referenced entities no longer exist; the transaction was recorded but nothing was applied.",
      missing,
    });
    expect(r.record).toHaveBeenCalledTimes(1);
    expect(r.applyChanges).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire the revision hook when the apply found entities missing", async () => {
    // Canon did not move, so §11's revision must not move either.
    const onCanonicalMutation = vi.fn(async () => {});
    await applyStoryTransaction(
      ctx,
      { projectId, source: "model-proposal", changes: [change({ entityId: "c9" })] },
      repo({
        applyChanges: vi.fn(async () => {
          throw new MissingEntitiesError(
            [{ entityKey: "characters", entityId: "c9" }],
            "applyChanges: pre-check",
          );
        }) as never,
      }),
      { onCanonicalMutation },
    );
    expect(onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("re-throws a non-typed apply failure — only MissingEntitiesError is the 422", async () => {
    // The typed error is a handled, expected outcome. Everything else stays a
    // 500-class server fault; swallowing it here would hide genuine breakage.
    const r = repo({
      applyChanges: vi.fn(async () => {
        throw new Error("db down");
      }) as never,
    });
    await expect(
      applyStoryTransaction(ctx, { projectId, source: "model-proposal", changes: [change()] }, r),
    ).rejects.toThrow("db down");
  });
});
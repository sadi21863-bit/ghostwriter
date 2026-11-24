import { describe, it, expect, vi } from "vitest";
import {
  createWorldEntity,
  deleteWorldEntity,
  listWorldEntities,
  updateWorldEntity,
  worldEntityInsertFields,
} from "@/lib/core/handlers/world-entities";
import {
  readIntentionalViolations,
  recordIntentionalViolation,
} from "@/lib/core/handlers/intentional-violations";
import { cloudContext } from "@/lib/core/request-context";
import type { WorldEntityCrudRepository } from "@/lib/core/handlers/world-entities";
import type { IntentionalViolationRepository } from "@/lib/core/handlers/intentional-violations";

/**
 * Phase 2 / v4 §7 — handler rules for the world-entity CRUD and the
 * intentional-violation acknowledgements, exercised without a database or
 * Next.js (same payoff as `update-chapter.test.ts`): scoping, ownership,
 * insert-default stamping, the embedding DI seam, and the §11 hook kinds.
 */

const ctx = cloudContext("user-1");
const scopedCtx = cloudContext("user-1", { projectScope: "other" });

function entityRepo(over: Record<string, unknown> = {}) {
  // Mocks take the SAME arguments as the real ports so mock.calls tuples
  // typecheck (the zero-arg vi.fn() gotcha from CLAUDE.md item 69).
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const create = vi.fn(
    async (_projectId: string, _fields: Record<string, unknown>) => ({
      id: "we-1",
      projectId: "p1",
      kind: "object",
      name: "The Ring",
    }),
  );
  const findScoped = vi.fn(async (_projectId: string, _query?: unknown) => []);
  const updateScoped = vi.fn(
    async (_projectId: string, _entityId: string, _patch: Record<string, unknown>) => ({
      id: "we-1",
      projectId: "p1",
      name: "Renamed",
    }),
  );
  const deleteScoped = vi.fn(async (_projectId: string, _entityId: string) => {});
  return { ownsProject, create, findScoped, updateScoped, deleteScoped, ...over } as unknown as
    WorldEntityCrudRepository & {
      ownsProject: typeof ownsProject;
      create: typeof create;
      findScoped: typeof findScoped;
      updateScoped: typeof updateScoped;
      deleteScoped: typeof deleteScoped;
    };
}

function violationRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const readAcknowledgements = vi.fn(async (_projectId: string) => ({}));
  const recordAcknowledgement = vi.fn(
    async (
      _projectId: string,
      _payload: { violationType: string; entry: { confirmed: boolean; purpose: string; timestamp: string } },
    ) => {},
  );
  return { ownsProject, readAcknowledgements, recordAcknowledgement, ...over } as unknown as
    IntentionalViolationRepository & {
      ownsProject: typeof ownsProject;
      readAcknowledgements: typeof readAcknowledgements;
      recordAcknowledgement: typeof recordAcknowledgement;
    };
}

// Inferred from the real implementation shape, so the object stays assignable
// to PostCommitHooks exactly like story-history.test.ts's `hook()` helper.
const hookSpy = () => {
  const fn = vi.fn(async (_projectId: string, _kind: string) => {});
  return { hooks: { onCanonicalMutation: fn }, fn };
};

const ENTITY = {
  kind: "object",
  name: "The Ring",
  summary: "A cursed ring",
  description: "Gold band",
  properties: { goal: "rule the city" },
} as const;

describe("createWorldEntity", () => {
  it("403s a context scoped to a different project, without probing ownership", async () => {
    const r = entityRepo();
    const result = await createWorldEntity(scopedCtx, { projectId: "p1", entity: ENTITY }, r);
    expect(result).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r.ownsProject).not.toHaveBeenCalled();
  });

  it("404s a non-owner with the plain 'Not found' body, without inserting", async () => {
    const r = entityRepo({ ownsProject: vi.fn(async (_projectId: string, _actorId: string) => false) });
    const { hooks } = hookSpy();
    const result = await createWorldEntity(ctx, { projectId: "p1", entity: ENTITY }, r, hooks);
    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r.create).not.toHaveBeenCalled();
    expect(hooks.onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("happy path: insert stamps the column defaults + null embedding, hook fires worldEntity.create", async () => {
    const r = entityRepo();
    const { hooks, fn } = hookSpy();
    const result = await createWorldEntity(ctx, { projectId: "p1", entity: ENTITY }, r, hooks);

    expect(result.ok).toBe(true);
    const fields = r.create.mock.calls[0]![1] as Record<string, unknown>;
    expect(fields).toEqual({
      ...worldEntityInsertFields(ENTITY),
      embedding: null,
    });
    expect(fields.summary).toBe("A cursed ring");
    // A never-omitted option: the defaults the pre-migration route carried.
    expect(worldEntityInsertFields({ ...ENTITY, summary: undefined })).toMatchObject({ summary: "", linkedCharacterIds: [], alwaysInContext: false, sortOrder: 0 });
    expect(fn).toHaveBeenCalledWith("p1", "worldEntity.create");
    expect(result).toMatchObject({ ok: true, similarEntities: [] });
  });

  it("passes the built embedding text through the DI seam and scans same-kind rows except the new one", async () => {
    const r = entityRepo({ findScoped: vi.fn(async (_projectId: string, _query?: unknown) => [
      { id: "we-2", name: "The Cursed Ring", embedding: [1, 0] },
    ]) });
    const embedText = vi.fn(async (text: string) => [1, 0]);
    const result = await createWorldEntity(ctx, { projectId: "p1", entity: ENTITY }, r, {}, embedText);

    expect(embedText.mock.calls[0]![0]).toContain("The Ring");
    expect(r.findScoped).toHaveBeenCalledWith("p1", {
      kind: "object",
      excludeId: "we-1",
      onlyWithEmbedding: true,
    });
    expect(result).toMatchObject({
      ok: true,
      similarEntities: [{ id: "we-2", name: "The Cursed Ring", similarity: 1 }],
    });
  });

  it("treats a rejecting embedding service as no-embedding: no scan, hook still fires", async () => {
    const r = entityRepo();
    const { hooks, fn } = hookSpy();
    const embedText = vi.fn(async (_text: string) => {
      throw new Error("embeddings down");
    });
    const result = await createWorldEntity(ctx, { projectId: "p1", entity: ENTITY }, r, hooks, embedText);

    expect(result).toMatchObject({ ok: true, similarEntities: [] });
    expect(r.findScoped).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalledWith("p1", "worldEntity.create");
  });
});

describe("listWorldEntities", () => {
  it("refuses a scope mismatch with 403 and a non-owner with 404", async () => {
    const notOwner = entityRepo({ ownsProject: vi.fn(async (_projectId: string, _actorId: string) => false) });
    expect(await listWorldEntities(scopedCtx, { projectId: "p1" }, entityRepo())).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
    expect(await listWorldEntities(ctx, { projectId: "p1" }, notOwner)).toEqual({
      ok: false,
      status: 404,
      reason: "Not found",
    });
  });

  it("happy path: returns project-scoped rows in (kind, sortOrder) order", async () => {
    const rows = [{ id: "we-1", projectId: "p1", kind: "object", name: "A" }];
    const r = entityRepo({ findScoped: vi.fn(async (_projectId: string, _query?: unknown) => rows) });
    const result = await listWorldEntities(ctx, { projectId: "p1" }, r);
    expect(result).toEqual({ ok: true, entities: rows });
    expect(r.findScoped).toHaveBeenCalledWith("p1");
  });
});

describe("updateWorldEntity", () => {
  it("404s when the scoped update matches no row, and fires no hook", async () => {
    const r = entityRepo({ updateScoped: vi.fn(async (_p: string, _e: string, _patch: Record<string, unknown>) => null) });
    const { hooks, fn } = hookSpy();
    const result = await updateWorldEntity(ctx, { projectId: "p1", entityId: "we-404", patch: { name: "x" } }, r, hooks);
    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("happy path: stamps server-owned updatedAt and fires worldEntity.update", async () => {
    const r = entityRepo();
    const { hooks, fn } = hookSpy();
    const result = await updateWorldEntity(ctx, { projectId: "p1", entityId: "we-1", patch: { name: "Renamed" } }, r, hooks);
    expect(result).toMatchObject({ ok: true, entity: { id: "we-1" } });
    const sent = r.updateScoped.mock.calls[0]![2];
    expect(sent.updatedAt).toBeInstanceOf(Date);
    expect(fn).toHaveBeenCalledWith("p1", "worldEntity.update");
  });
});

describe("deleteWorldEntity", () => {
  it("fires worldEntity.delete after the scoped delete runs", async () => {
    const r = entityRepo();
    const { hooks, fn } = hookSpy();
    const result = await deleteWorldEntity(ctx, { projectId: "p1", entityId: "we-1" }, r, hooks);
    expect(result).toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1", "we-1");
    expect(fn).toHaveBeenCalledWith("p1", "worldEntity.delete");
  });
});

describe("readIntentionalViolations", () => {
  it("refuses a scope mismatch with 403 and a non-owner with 404", async () => {
    const notOwner = violationRepo({ ownsProject: vi.fn(async (_projectId: string, _actorId: string) => false) });
    expect(await readIntentionalViolations(scopedCtx, { projectId: "p1" }, violationRepo())).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
    expect(await readIntentionalViolations(ctx, { projectId: "p1" }, notOwner)).toEqual({
      ok: false,
      status: 404,
      reason: "Not found",
    });
  });

  it("happy path: returns the project's acknowledgement map", async () => {
    const map = { safety_violation: { confirmed: true, purpose: "dark ending", timestamp: "t" } };
    const r = violationRepo({ readAcknowledgements: vi.fn(async (_p: string) => map) });
    const result = await readIntentionalViolations(ctx, { projectId: "p1" }, r);
    expect(result).toEqual({ ok: true, violations: map });
  });
});

describe("recordIntentionalViolation", () => {
  it("keeps the route's error order: 404 beats the missing-violationType 400", async () => {
    const notOwner = violationRepo({ ownsProject: vi.fn(async (_projectId: string, _actorId: string) => false) });
    // Owner, missing violationType → 400, nothing recorded.
    expect(
      await recordIntentionalViolation(ctx, { projectId: "p1" }, violationRepo()),
    ).toEqual({ ok: false, status: 400, reason: "violationType required" });
    // Non-owner (same missing-violationType input) → 404 wins, as the route
    // checked ownership BEFORE reading the body.
    expect(
      await recordIntentionalViolation(ctx, { projectId: "p1" }, notOwner),
    ).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("happy path: acknowledgment entry is normalized verbatim and hook fires violation.acknowledge", async () => {
    const r = violationRepo();
    const { hooks, fn } = hookSpy();
    const result = await recordIntentionalViolation(
      ctx,
      { projectId: "p1", violationType: "safety", purpose: undefined },
      r,
      hooks,
    );
    expect(result).toEqual({ ok: true });
    expect(r.recordAcknowledgement).toHaveBeenCalledWith("p1", {
      violationType: "safety",
      entry: expect.objectContaining({
        confirmed: true,
        purpose: "",
      }),
    });
    const entry = r.recordAcknowledgement.mock.calls[0]![1].entry;
    expect(typeof entry.timestamp).toBe("string");
    expect(fn).toHaveBeenCalledWith("p1", "violation.acknowledge");
  });
});

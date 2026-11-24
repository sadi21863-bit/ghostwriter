import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloudContext } from "@/lib/core/request-context";
import {
  readRelationshipMap,
  upsertRelationshipMap,
  type RelationshipMapGraph,
  type RelationshipMapRepository,
  type RelationshipMapRow,
} from "@/lib/core/handlers/relationship-map";

/**
 * Phase 2 / v4 §7 — handler contract for the relationship-map unions. Route
 * tests drive these through the Next adapter; this file pins the handler's own
 * auth/scoping branches (403/404 — Next sessions never carry a projectScope)
 * and the passthrough/contract rules (verbatim shape, hook only after a real
 * upsert, projectId destructured out of the payload).
 */
const graph: RelationshipMapGraph = {
  nodes: [
    { id: "c1", name: "Anna", role: "Protagonist", portraitUrl: null },
    { id: "c2", name: "Bob", role: "Foil", portraitUrl: "http://img/bob" },
  ],
  edges: [
    {
      charAId: "c1",
      charBId: "c2",
      charAName: "Anna",
      charBName: "Bob",
      sharedChapters: 2,
      trustLevel: 80,
      relationshipType: "rivals",
      fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
      notes: "loud history",
    },
  ],
  isolated: [{ id: "c3", name: "Sol" }],
};

const row: RelationshipMapRow = {
  id: "rel-1",
  projectId: "p1",
  characterAId: "c1",
  characterBId: "c2",
  trustLevel: 80,
  relationshipType: "rivals",
  notes: "loud history",
  fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
  powerDifferential: 2,
  emotionalRegister: "tense",
  knowledgeAsymmetry: "she knows",
  dependencyStructure: "interdependence",
  attachmentStyleA: "secure",
  arcTrajectory: "repair",
  updatedAt: new Date(0),
};

const repo = (): RelationshipMapRepository => ({
  ownsProject: vi.fn(async () => true),
  readGraph: vi.fn(async () => graph),
  upsertRelationships: vi.fn(async () => row),
});

const hooks = () => ({ onCanonicalMutation: vi.fn(async () => {}) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readRelationshipMap", () => {
  it("403s when the context is scoped to another project, touching no repository method", async () => {
    const r = repo();
    const out = await readRelationshipMap(cloudContext("u1", { projectScope: "p2" }), { projectId: "p1" }, r);
    expect(out).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
    expect(vi.mocked(r.ownsProject).mock.calls.length).toBe(0);
    expect(vi.mocked(r.readGraph).mock.calls.length).toBe(0);
  });

  it("404s when the actor does not own the project, without reading the graph", async () => {
    const r = repo();
    vi.mocked(r.ownsProject).mockResolvedValue(false);
    const out = await readRelationshipMap(cloudContext("u1"), { projectId: "p1" }, r);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(r.ownsProject).mock.calls).toEqual([["p1", "u1"]]);
    expect(vi.mocked(r.readGraph).mock.calls.length).toBe(0);
  });

  it("happy path — the graph passes through verbatim (same object, no reshaping)", async () => {
    const r = repo();
    const out = await readRelationshipMap(cloudContext("u1"), { projectId: "p1" }, r);
    expect(out).toEqual({ ok: true, graph });
    // The route serializes `result.graph` directly as the GET body; the object
    // identity pins that no handler-side copy/reshape can ever drift the shape.
    expect(out.ok && out.graph).toBe(graph);
  });
});

describe("upsertRelationshipMap", () => {
  const fullInput = {
    projectId: "p1",
    characterAId: "ca",
    characterBId: "cb",
    trustLevel: 80,
    relationshipType: "rivals",
    notes: "loud history",
    fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
    powerDifferential: 2,
    emotionalRegister: "tense",
    knowledgeAsymmetry: "she knows",
    dependencyStructure: "interdependence",
    attachmentStyleA: "secure",
    arcTrajectory: "repair",
  };

  it("happy path — payload minus projectId goes to the repository, hook fires after the real write with the relationship.upsert kind", async () => {
    const r = repo();
    const h = hooks();
    const out = await upsertRelationshipMap(cloudContext("u1"), fullInput, r, h);

    expect(out).toEqual({ ok: true, row });
    expect(vi.mocked(r.upsertRelationships).mock.calls.length).toBe(1);
    const [projectIdArg, payloadArg] = vi.mocked(r.upsertRelationships).mock.calls[0]!;
    expect(projectIdArg).toBe("p1");
    // projectId is destructured OUT — the URL's value outranks whatever the
    // caller carried, and the repository takes scope and payload separately.
    expect(payloadArg).not.toHaveProperty("projectId");
    expect(payloadArg).toEqual({
      characterAId: "ca",
      characterBId: "cb",
      trustLevel: 80,
      relationshipType: "rivals",
      notes: "loud history",
      fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
      powerDifferential: 2,
      emotionalRegister: "tense",
      knowledgeAsymmetry: "she knows",
      dependencyStructure: "interdependence",
      attachmentStyleA: "secure",
      arcTrajectory: "repair",
    });

    expect(vi.mocked(h.onCanonicalMutation).mock.calls.length).toBe(1);
    expect(vi.mocked(h.onCanonicalMutation).mock.calls[0]).toEqual(["p1", "relationship.upsert"]);
    // Post-commit: the revision bump must never precede the canonical write.
    expect(h.onCanonicalMutation.mock.invocationCallOrder[0]!).toBeGreaterThan(
      vi.mocked(r.upsertRelationships).mock.invocationCallOrder[0]!,
    );
  });

  it("null row — the link vanished between read and write: 404 refusal and no hook", async () => {
    const r = repo();
    vi.mocked(r.upsertRelationships).mockResolvedValue(null);
    const h = hooks();
    const out = await upsertRelationshipMap(cloudContext("u1"), { projectId: "p1", characterAId: "ca", characterBId: "cb" }, r, h);
    // The hook fires ONLY on a real upsert — a refused/failed write can never
    // bump the revision.
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(h.onCanonicalMutation).mock.calls.length).toBe(0);
  });

  it("payload passthrough — the handler whitelists nothing itself: extra keys survive and only projectId is split off", async () => {
    const r = repo();
    const h = hooks();
    // Extra keys never reach the handler in the pg route (the route picks the
    // known fields), but the handler's contract is passthrough so local/other
    // transports do not fork the scope routing from the route.
    const input = { ...fullInput, extraUnknownKey: true, projectId: "p1" };
    await upsertRelationshipMap(cloudContext("u1"), input as typeof fullInput, r, h);

    const payloadArg = vi.mocked(r.upsertRelationships).mock.calls[0]![1] as unknown as Record<string, unknown>;
    expect(payloadArg).not.toHaveProperty("projectId");
    expect(payloadArg).toHaveProperty("extraUnknownKey", true);
  });

  it("404s when the actor does not own the project — no upsert attempt, no hook", async () => {
    const r = repo();
    vi.mocked(r.ownsProject).mockResolvedValue(false);
    const h = hooks();
    const out = await upsertRelationshipMap(cloudContext("u1"), { projectId: "p1", characterAId: "ca", characterBId: "cb" }, r, h);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(vi.mocked(r.upsertRelationships).mock.calls.length).toBe(0);
    expect(vi.mocked(h.onCanonicalMutation).mock.calls.length).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { characterRelationships, projects } from "@/db/schema";

/**
 * Phase 2 / v4 §7 — route tests for the thin relationship-map adapter.
 *
 * Mock convention mirrors `chapters/[chapterId]/__tests__/route.test.ts`:
 * hoisted rest-arg fns + one `@/db` mock object — but here the REAL pg adapter
 * (`pg-relationship-repos`) and the REAL `pgPostCommitHooks` execute against the
 * fake db, so the tests drive the whole stack below the Next adapter.
 *
 * The GET body is pinned against the literal shape the legacy compound route
 * emitted (`{ nodes, edges, isolated }` with its exact edge/node keys) so a
 * payload-shape drift on the layout-facing contract fails loudly.
 */
const getRequiredSessionFn = vi.fn(async () => ({ user: { id: "user-1" } }));
const findFirstProjects = vi.fn();
const findFirstRels = vi.fn();
const findManyRels = vi.fn();
const updateReturning = vi.fn();
const insertReturning = vi.fn();
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];
const insertCaptures: unknown[] = [];

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: () => getRequiredSessionFn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: unknown[]) => findFirstProjects(...a) },
      characterRelationships: {
        findFirst: (...a: unknown[]) => findFirstRels(...a),
        findMany: (...a: unknown[]) => findManyRels(...a),
      },
    },
    // Real pgPostCommitHooks updates `projects` with NO `.returning()` (the
    // hook awaits the where directly), while the relationship upsert chains
    // `.returning()` — dispatch reads as the call shape of each table.
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateCaptures.push({ table, payload });
        if (table === projects) return { where: () => Promise.resolve(undefined) };
        return { where: () => ({ returning: (...a: unknown[]) => updateReturning(...a) }) };
      },
    }),
    insert: () => ({
      values: (values: unknown) => {
        insertCaptures.push(values);
        return { returning: (...a: unknown[]) => insertReturning(...a) };
      },
    }),
  },
}));

const { GET, PATCH } = await import("../route");

const PROJECT = {
  id: "proj-1",
  userId: "user-1",
  characters: [
    { id: "char-a", name: "Anna", role: "Protagonist", portraitUrl: "http://p/anna" },
    { id: "char-b", name: "Bob", role: "Foil", portraitUrl: null },
    { id: "char-c", name: "Sol", role: null, portraitUrl: null },
  ],
  chapters: [
    { id: "chap-1", content: "Anna watched Bob leave." },
    { id: "chap-2", content: "Bob missed Anna." },
  ],
};

// The stored link deliberately carries (b, a) reversed: the co-occurrence pair
// key (a < b) and the stored-row key normalization must meet on one map entry.
const STORED_REL = {
  id: "rel-1",
  projectId: "proj-1",
  characterAId: "char-b",
  characterBId: "char-a",
  trustLevel: 80,
  relationshipType: "rivals",
  fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
  notes: "loud history",
  powerDifferential: 0,
  emotionalRegister: "",
  knowledgeAsymmetry: "",
  dependencyStructure: "none",
  attachmentStyleA: "",
  arcTrajectory: "",
  updatedAt: new Date(0),
};

// Literal GET shape captured from the pre-migration compound route.
const CAPTURED_GET_SHAPE = {
  nodes: [
    { id: "char-a", name: "Anna", role: "Protagonist", portraitUrl: "http://p/anna" },
    { id: "char-b", name: "Bob", role: "Foil", portraitUrl: null },
    { id: "char-c", name: "Sol", role: null, portraitUrl: null },
  ],
  edges: [
    {
      charAId: "char-a",
      charBId: "char-b",
      charAName: "Anna",
      charBName: "Bob",
      sharedChapters: 2,
      trustLevel: 80,
      relationshipType: "rivals",
      fourHorsemen: { criticism: 1, contempt: 2, defensiveness: 3, stonewalling: 4 },
      notes: "loud history",
    },
  ],
  isolated: [{ id: "char-c", name: "Sol" }],
};

function makeRequest(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

const fullBody = {
  characterAId: "char-b",
  characterBId: "char-a", // reversed order on purpose: the (a < b) pair normalization must hold
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

const INSERT_ROW = {
  id: "rel-9",
  projectId: "proj-1",
  characterAId: "char-a",
  characterBId: "char-b",
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
  updatedAt: new Date(1),
};

describe("GET /api/projects/[projectId]/relationship-map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue(PROJECT);
    findFirstRels.mockResolvedValue(undefined);
    findManyRels.mockResolvedValue([STORED_REL]);
    updateCaptures.length = 0;
    insertCaptures.length = 0;
  });

  it("200 — the body is exactly the legacy graph shape (nodes/edges/isolated, stored data layered over co-occurrence)", async () => {
    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    expect(json).toEqual(CAPTURED_GET_SHAPE);
  });

  it("404 — the project is not the caller's: { error: 'Not found' }, nothing read", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Not found");
    expect(findManyRels).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/projects/[projectId]/relationship-map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue(PROJECT);
    findFirstRels.mockResolvedValue(undefined);
    findManyRels.mockResolvedValue([]);
    updateCaptures.length = 0;
    insertCaptures.length = 0;
    updateReturning.mockResolvedValue([]);
    insertReturning.mockResolvedValue([]);
  });

  it("400 — missing character ids: legacy message, nothing written", async () => {
    const res = await PATCH(makeRequest({ characterAId: "char-a" }), makeParams());

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("characterAId and characterBId required");
    expect(insertCaptures).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
  });

  it("200 — insert branch: the created row is returned verbatim, pair order normalized, legacy defaults applied, and the §11 revision bump lands on projects AFTER the write", async () => {
    insertReturning.mockResolvedValue([INSERT_ROW]);

    const res = await PATCH(makeRequest(fullBody), makeParams());

    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    // Verbatim row passthrough — compared post-serialization (the Date key
    // arrives as its ISO string over the wire).
    expect(json).toEqual({ ...INSERT_ROW, updatedAt: INSERT_ROW.updatedAt.toISOString() });

    // One insert, carrying the URL projectId and the normalized (a < b) pair.
    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]).toEqual({
      projectId: "proj-1",
      characterAId: "char-a",
      characterBId: "char-b",
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

    // Real pgPostCommitHooks ran: exactly one projects update (the revision
    // bump), after the relationship insert itself succeeded.
    expect(updateCaptures).toHaveLength(1);
    expect(updateCaptures[0]!.table).toBe(projects);
    expect(Object.keys(updateCaptures[0]!.payload as object)).toEqual(["contentRevision"]);
  });

  it("200 — insert branch omissions: legacy defaults fill every unsent field", async () => {
    insertReturning.mockResolvedValue([INSERT_ROW]);

    await PATCH(makeRequest({ characterAId: "char-a", characterBId: "char-b" }), makeParams());

    expect(insertCaptures[0]).toEqual({
      projectId: "proj-1",
      characterAId: "char-a",
      characterBId: "char-b",
      trustLevel: 50,
      relationshipType: "",
      notes: "",
      fourHorsemen: { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
      powerDifferential: 0,
      emotionalRegister: "",
      knowledgeAsymmetry: "",
      dependencyStructure: "none",
      attachmentStyleA: "",
      arcTrajectory: "",
    });
  });

  it("200 — update branch that matches nothing (row vanished): 404 'Not found', no projects revision bump", async () => {
    findFirstRels.mockResolvedValue({
      id: "rel-1",
      projectId: "proj-1",
      characterAId: "char-a",
      characterBId: "char-b",
    });
    updateReturning.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ characterAId: "char-a", characterBId: "char-b", trustLevel: 80, notes: "loud history" }), makeParams());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Not found");
    // Only the relationship update ran (and matched nothing); the hook that
    // bumps `projects.contentRevision` never fired on a refused write.
    expect(updateCaptures).toHaveLength(1);
    expect(updateCaptures[0]!.table).toBe(characterRelationships);
    expect(updateCaptures[0]!.payload).toEqual({
      trustLevel: 80,
      notes: "loud history",
      updatedAt: expect.any(Date),
    });
    expect(insertCaptures).toHaveLength(0);
  });
});

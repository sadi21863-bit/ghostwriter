import { describe, it, expect, vi, beforeEach } from "vitest";
import { characters, projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const updateTables: unknown[] = [];
const deleteTables: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    update: (table: unknown) => ({
      set: (vals: any) => {
        updateTables.push(table);
        updateSet(vals);
        return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) };
      },
    }),
    delete: (table: unknown) => ({
      where: () => {
        deleteTables.push(table);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

import { PATCH, DELETE } from "../route";

function makeRequest(body: any) {
  return new Request("http://localhost/api/projects/proj-1/characters/char-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", characterId: "char-1" }) };
}
const revisionBumpCalls = () =>
  updateTables.filter((t) => t === projects);

describe("PATCH /api/projects/[projectId]/characters/[characterId] — advanced JSONB persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateTables.length = 0;
    deleteTables.length = 0;
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    updateReturning.mockResolvedValue([{ id: "char-1" }]);
  });

  it("now persists skills/knowledgeMap/intelligenceProfile (previously dropped by the allowlist), normalized through the story guard", async () => {
    await PATCH(makeRequest({
      name: "Mara",
      skills: [{ name: "Lockpicking", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false }],
      knowledgeMap: { e1: { state: "KNOWS", entityType: "character", entityName: "Kessler" } },
      intelligenceProfile: { dominant: ["logical"], weak: ["spatial"] },
    }), makeParams());

    const setArg = updateSet.mock.calls[0][0];
    expect(setArg.name).toBe("Mara");
    expect(setArg.skills).toEqual([{ name: "Lockpicking", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false }]);
    expect(setArg.knowledgeMap).toEqual({ e1: { state: "KNOWS", entityType: "character", entityName: "Kessler" } });
    expect(setArg.intelligenceProfile).toEqual({ dominant: ["logical"], weak: ["spatial"] });
  });

  it("normalizes a corrupt advanced blob rather than persisting garbage or 400ing the whole save", async () => {
    const res = await PATCH(makeRequest({
      name: "Mara",
      skills: [{ name: "Sailing" }, "garbage", { nope: true }],
      intelligenceProfile: { dominant: ["logical", "telepathic"], weak: "not-an-array" },
    }), makeParams());

    expect(res.status).toBe(200);
    const setArg = updateSet.mock.calls[0][0];
    // Only the well-formed skill survives; junk dropped.
    expect(setArg.skills).toHaveLength(1);
    expect(setArg.skills[0].name).toBe("Sailing");
    // Unknown intelligence type dropped; non-array weak coerced to [].
    expect(setArg.intelligenceProfile).toEqual({ dominant: ["logical"], weak: [] });
  });

  it("leaves advanced fields untouched when the patch doesn't include them", async () => {
    await PATCH(makeRequest({ name: "Mara" }), makeParams());
    const setArg = updateSet.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("skills");
    expect(setArg).not.toHaveProperty("knowledgeMap");
    expect(setArg).not.toHaveProperty("intelligenceProfile");
  });

  it("persists voiceId (Audio Novel TTS voice casting)", async () => {
    await PATCH(makeRequest({ name: "Mara", voiceId: "onyx" }), makeParams());
    const setArg = updateSet.mock.calls[0][0];
    expect(setArg.voiceId).toBe("onyx");
  });

  // ---- thin-adapter migration additions (behavior preservation + §11) ----

  it("§11 — a real pgPostCommitHooks revision bump fires after the scoped patch, never before", async () => {
    const res = await PATCH(makeRequest({ name: "Mara Voss" }), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "char-1" });

    expect(updateTables).toEqual([characters, projects]);
    const bumpPayload = updateSet.mock.calls[1][0] as Record<string, unknown>;
    expect(typeof bumpPayload.contentRevision).toBe("object");
    // The character write itself always carries the server-stamped updatedAt.
    expect(updateSet.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
  });

  it("empty patch `{}` — still a touch (updatedAt) but no revision bump", async () => {
    const res = await PATCH(makeRequest({}), makeParams());

    expect(res.status).toBe(200);
    expect(updateTables).toEqual([characters]);
    expect(updateSet.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
  });

  it("404 — unknown project probes ownership before the body is validated", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ sortOrder: "not-a-number" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(updateTables).toEqual([]);
  });

  it("400 — Invalid fields on an owned project touches nothing", async () => {
    const res = await PATCH(makeRequest({ sortOrder: "not-a-number" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid fields" });
    expect(updateTables).toEqual([]);
  });

  it("404 — no row matched (foreign characterId): write attempted, no bump", async () => {
    updateReturning.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ name: "Mara" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(updateTables).toEqual([characters]);
  });

  it("DELETE — {ok:true} and the §11 bump fires after the scoped delete", async () => {
    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      makeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(deleteTables).toEqual([characters]);
    expect(revisionBumpCalls()).toEqual([projects]);
  });

  it("DELETE 404 — unknown project deletes nothing and never bumps", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      makeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(deleteTables).toEqual([]);
    expect(revisionBumpCalls()).toEqual([]);
  });
});

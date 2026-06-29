import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) };
      },
    }),
  },
}));

import { PATCH } from "../route";

function makeRequest(body: any) {
  return new Request("http://localhost/api/projects/proj-1/characters/char-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", characterId: "char-1" }) };
}

describe("PATCH /api/projects/[projectId]/characters/[characterId] — advanced JSONB persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

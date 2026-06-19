import { describe, it, expect, vi, beforeEach } from "vitest";
import { projects, characters, locations, plotThreads } from "@/db/schema";

const findFirstProjects = vi.fn();
const insertCalls = vi.fn();

function makeInsertChain(table: any, vals: any) {
  insertCalls(table, vals);
  const inserted = Array.isArray(vals)
    ? vals.map((v: any, i: number) => ({ id: `new-id-${i}`, ...v }))
    : [{ id: "new-project-1", ...vals }];
  return {
    returning: () => Promise.resolve(inserted),
    then: (resolve: any, reject?: any) => Promise.resolve(undefined).then(resolve, reject),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: {
        findFirst: (...args: any[]) => findFirstProjects(...args),
      },
    },
    insert: (table: any) => ({ values: (vals: any) => makeInsertChain(table, vals) }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const getUserTier = vi.fn();
vi.mock("@/lib/subscription", () => ({
  getUserTier: (...args: any[]) => getUserTier(...args),
  canAccessFeature: (tier: string) => tier !== "free",
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(async () => {}),
}));

import { POST } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/source-1/adapt", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const baseSource = {
  id: "source-1",
  userId: "user-1",
  name: "My Novel",
  format: "Novel",
  skillLevel: "beginner",
  genres: ["Fantasy"],
  characters: [{ id: "char-1", projectId: "source-1", name: "Maria", linkedLocationIds: ["loc-1"], linkedPlotThreadIds: [], createdAt: new Date(), updatedAt: new Date() }],
  locations: [{ id: "loc-1", projectId: "source-1", name: "Castle", linkedCharacterIds: ["char-1"], createdAt: new Date(), updatedAt: new Date() }],
  plotThreads: [{ id: "thread-1", projectId: "source-1", name: "The heist", lastMentionedChapterId: "chap-1", createdAt: new Date(), updatedAt: new Date() }],
};

describe("POST /api/projects/[projectId]/adapt", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
    insertCalls.mockReset();
    getUserTier.mockReset();
    getUserTier.mockResolvedValue("story_pro");
  });

  it("rejects when the user's tier can't access export", async () => {
    getUserTier.mockResolvedValue("free");
    const res = await POST(makeRequest({ targetFormat: "Screenplay" }), { params: Promise.resolve({ projectId: "source-1" }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("upgrade_required");
  });

  it("returns 404 when the source project doesn't exist or isn't owned by the user", async () => {
    findFirstProjects.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ targetFormat: "Screenplay" }), { params: Promise.resolve({ projectId: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("rejects an unsupported target format for the source format", async () => {
    findFirstProjects.mockResolvedValue(baseSource);
    const res = await POST(makeRequest({ targetFormat: "Podcast Episode" }), { params: Promise.resolve({ projectId: "source-1" }) });
    expect(res.status).toBe(400);
  });

  it("creates a new project and copies World Bible rows with reset cross-references", async () => {
    findFirstProjects.mockResolvedValue(baseSource);

    const res = await POST(makeRequest({ targetFormat: "Screenplay" }), { params: Promise.resolve({ projectId: "source-1" }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.newProjectId).toBe("new-project-1");

    const projectInsertCall = insertCalls.mock.calls.find(([table]) => table === projects);
    expect(projectInsertCall?.[1]).toMatchObject({
      format: "Screenplay",
      adaptedFromProjectId: "source-1",
      name: "My Novel (Screenplay)",
    });

    const charInsertCall = insertCalls.mock.calls.find(([table]) => table === characters);
    expect(charInsertCall?.[1][0]).toMatchObject({ name: "Maria", linkedLocationIds: [], linkedPlotThreadIds: [] });
    expect(charInsertCall?.[1][0].id).toBeUndefined();

    const locInsertCall = insertCalls.mock.calls.find(([table]) => table === locations);
    expect(locInsertCall?.[1][0]).toMatchObject({ name: "Castle", linkedCharacterIds: [] });

    const threadInsertCall = insertCalls.mock.calls.find(([table]) => table === plotThreads);
    expect(threadInsertCall?.[1][0]).toMatchObject({ name: "The heist", lastMentionedChapterId: null });
  });
});

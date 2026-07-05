import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const findFirstShots = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      productionShots: { findFirst: (...args: any[]) => findFirstShots(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return {
          where: (...args: any[]) => {
            updateWhere(...args);
            return { returning: (...rArgs: any[]) => returning(...rArgs) };
          },
        };
      },
    }),
  },
}));

import { PATCH } from "../route";

function makeRequest(body: any) {
  return new Request("http://localhost/api/projects/proj-1/production/shots/shot-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", shotId: "shot-1" }) };
}

describe("PATCH /api/projects/[projectId]/production/shots/[shotId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstShots.mockResolvedValue({
      id: "shot-1", projectId: "proj-1",
      shotType: "Medium shot", cameraMovement: "Static", lightingMood: "Golden hour", timeOfDay: "Afternoon",
      subject: "Mara", action: "walks", location: "The alley",
    });
    returning.mockResolvedValue([{ id: "shot-1", reviewStatus: "approved" }]);
  });

  it("accepts reviewStatus (Phase C review gate) without triggering the prompt-rebuild path", async () => {
    await PATCH(makeRequest({ reviewStatus: "approved" }), makeParams());
    const [setArg] = updateSet.mock.calls[0];
    expect(setArg.reviewStatus).toBe("approved");
    // Prompt fields are untouched — reviewStatus isn't a shot-parameter field.
    expect(setArg.soulPrompt).toBeUndefined();
    expect(setArg.videoPrompt).toBeUndefined();
  });

  it("ignores fields outside the allowlist", async () => {
    await PATCH(makeRequest({ reviewStatus: "needs_rework", qualityScore: 0.99 }), makeParams());
    const [setArg] = updateSet.mock.calls[0];
    expect(setArg.reviewStatus).toBe("needs_rework");
    expect(setArg.qualityScore).toBeUndefined();
  });

  it("404s when the shot isn't found", async () => {
    findFirstShots.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ reviewStatus: "approved" }), makeParams());
    expect(res.status).toBe(404);
  });
});

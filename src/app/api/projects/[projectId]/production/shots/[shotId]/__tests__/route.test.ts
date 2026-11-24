import { describe, it, expect, vi, beforeEach } from "vitest";
import { productionShots, projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const findFirstShots = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
const updateTables: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      productionShots: { findFirst: (...args: any[]) => findFirstShots(...args) },
    },
    update: (table: unknown) => ({
      set: (vals: any) => {
        updateTables.push(table);
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
    updateTables.length = 0;
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

  describe("promoteCandidateUrl (Phase C keep-N-candidates)", () => {
    beforeEach(() => {
      findFirstShots.mockResolvedValue({
        id: "shot-1", projectId: "proj-1",
        shotType: "Medium shot", cameraMovement: "Static", lightingMood: "Golden hour", timeOfDay: "Afternoon",
        subject: "Mara", action: "walks", location: "The alley",
        previewImageUrl: "https://example.com/primary.jpg",
        candidatePreviewUrls: ["https://example.com/candidate-a.jpg", "https://example.com/candidate-b.jpg"],
      });
    });

    it("promotes a known candidate to primary and returns the old primary to candidates", async () => {
      await PATCH(makeRequest({ promoteCandidateUrl: "https://example.com/candidate-a.jpg" }), makeParams());
      const [setArg] = updateSet.mock.calls[0];
      expect(setArg.previewImageUrl).toBe("https://example.com/candidate-a.jpg");
      expect(setArg.candidatePreviewUrls).toEqual(["https://example.com/candidate-b.jpg", "https://example.com/primary.jpg"]);
    });

    it("rejects a URL that isn't a known candidate", async () => {
      const res = await PATCH(makeRequest({ promoteCandidateUrl: "https://example.com/not-a-candidate.jpg" }), makeParams());
      expect(res.status).toBe(400);
      expect(updateSet).not.toHaveBeenCalled();
    });
  });

  // ---- thin-adapter migration additions (RequestContext handler + §11) ----

  it("§11 — a real pgPostCommitHooks revision bump fires after the scoped write (kind shot.update)", async () => {
    const res = await PATCH(makeRequest({ reviewStatus: "approved" }), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    // Response shape pinned — the pre-migration route returned `{ shot: row }`.
    expect(body).toEqual({ shot: { id: "shot-1", reviewStatus: "approved" } });

    expect(updateTables).toEqual([productionShots, projects]);
    const bumpPayload = updateSet.mock.calls[1][0] as Record<string, unknown>;
    expect(typeof bumpPayload.contentRevision).toBe("object");
    // The shot write itself always carries the server-stamped updatedAt, scoped.
    expect(updateSet.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
  });

  it("empty patch `{}` — still a touch (updatedAt written), but no revision bump", async () => {
    const res = await PATCH(makeRequest({}), makeParams());

    expect(res.status).toBe(200);
    await res.json();
    expect(updateTables).toEqual([productionShots]);
    expect(updateSet.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
  });

  it("promote success bumps the revision too — the promote request itself is a canon mutation", async () => {
    findFirstShots.mockResolvedValue({
      id: "shot-1", projectId: "proj-1",
      shotType: "Medium shot", cameraMovement: "Static", lightingMood: "Golden hour", timeOfDay: "Afternoon",
      subject: "Mara", action: "walks", location: "The alley",
      previewImageUrl: "https://example.com/primary.jpg",
      candidatePreviewUrls: ["https://example.com/candidate-a.jpg", "https://example.com/candidate-b.jpg"],
    });

    const res = await PATCH(makeRequest({ promoteCandidateUrl: "https://example.com/candidate-a.jpg" }), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shot).toBeTruthy();
    expect(updateTables).toEqual([productionShots, projects]);
  });

  it("404 — Shot not found (foreign shotId): no write, no bump, old message preserved", async () => {
    findFirstShots.mockResolvedValue(undefined);

    const res = await PATCH(makeRequest({ reviewStatus: "approved" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Shot not found" });
    expect(updateTables).toEqual([]);
  });

  it("404 — unknown project probes ownership before the body is read", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ reviewStatus: "approved" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(findFirstShots).not.toHaveBeenCalled();
    expect(updateTables).toEqual([]);
  });
});

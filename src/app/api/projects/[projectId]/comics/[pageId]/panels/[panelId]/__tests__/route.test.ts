import { describe, it, expect, vi, beforeEach } from "vitest";
import { comicPanels, projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const findFirstPanels = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
const updateTables = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      comicPanels: { findFirst: (...args: any[]) => findFirstPanels(...args) },
    },
    update: (...uArgs: any[]) => {
      updateTables(...uArgs);
      return {
        set: (vals: any) => {
          updateSet(vals);
          return {
            where: (...args: any[]) => {
              updateWhere(...args);
              return { returning: (...rArgs: any[]) => returning(...rArgs) };
            },
          };
        },
      };
    },
  },
}));

import { PATCH } from "../route";

function makeRequest(body: any) {
  return new Request("http://localhost/api/projects/proj-1/comics/page-1/panels/panel-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", pageId: "page-1", panelId: "panel-1" }) };
}

describe("PATCH /api/projects/[projectId]/comics/[pageId]/panels/[panelId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    returning.mockResolvedValue([{ id: "panel-1", dialogue: "Hi", bubbleType: "shout" }]);
  });

  it("still accepts dialogue, caption, and speakerName (regression)", async () => {
    await PATCH(makeRequest({ dialogue: "Hi", caption: "Later", speakerName: "Mara" }), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ dialogue: "Hi", caption: "Later", speakerName: "Mara" });
  });

  it("now also accepts bubbleType", async () => {
    await PATCH(makeRequest({ bubbleType: "shout" }), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ bubbleType: "shout" });
  });

  it("ignores fields outside the allowlist", async () => {
    await PATCH(makeRequest({ bubbleType: "shout", letteredImageUrl: "https://evil.example.com/x.png" }), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ bubbleType: "shout" });
  });

  it("now also accepts reviewStatus (Phase C review gate)", async () => {
    await PATCH(makeRequest({ reviewStatus: "approved" }), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ reviewStatus: "approved" });
  });

  it("now also accepts panelIndex (Phase C drag-reorder)", async () => {
    await PATCH(makeRequest({ panelIndex: 2 }), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ panelIndex: 2 });
  });

  it("a non-empty patch bumps contentRevision (comicPanel.update → projects)", async () => {
    await PATCH(makeRequest({ dialogue: "Hi" }), makeParams());
    expect(updateSet).toHaveBeenCalledWith({ dialogue: "Hi" });
    expect(updateTables.mock.calls.map(([t]) => t)).toEqual([comicPanels, projects]);
  });

  it("an empty allowed-patch writes degenerately but NEVER bumps", async () => {
    const res = await PATCH(makeRequest({}), makeParams());

    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith({});
    // only the adapter's own (degenerate) comicPanels write — no projects bump
    expect(updateTables.mock.calls.map(([t]) => t)).toEqual([comicPanels]);
  });

  it("404 'Not found' when the scoped write matches no rows — write attempted, no bump", async () => {
    returning.mockResolvedValue([]);
    const res = await PATCH(makeRequest({ dialogue: "Hi" }), makeParams());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(updateSet).toHaveBeenCalledWith({ dialogue: "Hi" });
    expect(updateTables).not.toHaveBeenCalledWith(projects);
  });

  describe("promoteCandidateUrl (Phase C keep-N-candidates)", () => {
    beforeEach(() => {
      findFirstPanels.mockResolvedValue({
        id: "panel-1", projectId: "proj-1",
        imageUrl: "https://example.com/primary.png",
        candidateImageUrls: ["https://example.com/candidate-a.png", "https://example.com/candidate-b.png"],
      });
    });

    it("promotes a known candidate to primary and returns the old primary to candidates, with the bump", async () => {
      await PATCH(makeRequest({ promoteCandidateUrl: "https://example.com/candidate-a.png" }), makeParams());
      const [setArg] = updateSet.mock.calls[0];
      expect(setArg.imageUrl).toBe("https://example.com/candidate-a.png");
      expect(setArg.candidateImageUrls).toEqual(["https://example.com/candidate-b.png", "https://example.com/primary.png"]);
      expect(updateTables.mock.calls.map(([t]) => t)).toEqual([comicPanels, projects]);
    });

    it("rejects a URL that isn't a known candidate", async () => {
      const res = await PATCH(makeRequest({ promoteCandidateUrl: "https://example.com/not-a-candidate.png" }), makeParams());
      expect(res.status).toBe(400);
      expect(updateSet).not.toHaveBeenCalled();
      expect(updateTables).not.toHaveBeenCalled();
    });
  });
});

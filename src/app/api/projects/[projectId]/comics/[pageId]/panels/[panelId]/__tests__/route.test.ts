import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "all_access"),
  canAccessFeature: vi.fn(() => true), // all_access passes every gate
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: (v: string) => v, // identity: a non-empty stored key decrypts to non-empty
}));

const findFirstProjects = vi.fn();
const findFirstUsers = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      users: { findFirst: (...args: any[]) => findFirstUsers(...args) },
    },
  },
}));

import { POST } from "../route";

function makeReq(body: any) {
  return new Request("http://localhost/api/projects/proj-1/graph/run-plan", {
    method: "POST", body: JSON.stringify(body),
  });
}
const params = () => ({ params: Promise.resolve({ projectId: "proj-1" }) });

describe("POST /api/projects/[projectId]/graph/run-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", format: "Novel" });
    findFirstUsers.mockResolvedValue({ id: "user-1", segmindApiKey: "sk-segmind", openaiApiKey: "" });
  });

  it("404s when the project isn't owned by the caller", async () => {
    findFirstProjects.mockResolvedValue(undefined);
    const res = await POST(makeReq({ kinds: ["chapter"], nodeIds: ["c1"] }), params());
    expect(res.status).toBe(404);
  });

  it("returns a single plan for a specific capabilityId, with cost + confirm", async () => {
    const res = await POST(makeReq({ capabilityId: "comic_generate", nodeIds: ["c1", "c2"] }), params());
    const body = await res.json();
    expect(body.plan.capabilityId).toBe("comic_generate");
    expect(body.plan.available).toBe(true);
    expect(body.plan.requiresConfirm).toBe(true);
    expect(body.plan.costUsd).toBeCloseTo(0.58, 5);
  });

  it("400s for an unknown capabilityId", async () => {
    const res = await POST(makeReq({ capabilityId: "nope", nodeIds: [] }), params());
    expect(res.status).toBe(400);
  });

  it("enumerates runnable capabilities for a node selection when no capabilityId given", async () => {
    const res = await POST(makeReq({ kinds: ["chapter"], nodeIds: ["c1"] }), params());
    const body = await res.json();
    const ids = body.options.map((o: any) => o.capabilityId);
    expect(ids).toContain("comic_generate");
    expect(ids).toContain("refine");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const messagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: (...args: any[]) => messagesCreate(...args) } };
  }),
}));

const findFirstProjects = vi.fn();
const findFirstChapters = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      chapters: { findFirst: (...args: any[]) => findFirstChapters(...args) },
    },
    insert: () => ({
      values: () => ({
        returning: (...args: any[]) => insertReturning(...args),
      }),
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkAiRateLimit: vi.fn(async () => null),
}));

const meterAndGate = vi.fn();
const refundCredits = vi.fn();
vi.mock("@/lib/metering/meter", () => ({
  meterAndGate: (...args: any[]) => meterAndGate(...args),
  refundCredits: (...args: any[]) => refundCredits(...args),
}));

import { POST } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/target-1/adapt-chapter", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const targetProject = { id: "target-1", userId: "user-1", format: "Screenplay", adaptedFromProjectId: "source-1" };
const sourceChapter = { id: "chap-1", projectId: "source-1", title: "Chapter 1", content: "It was a dark night.", sortOrder: 0 };

describe("POST /api/projects/[projectId]/adapt-chapter", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
    findFirstChapters.mockReset();
    insertReturning.mockReset();
    messagesCreate.mockReset();
    meterAndGate.mockReset();
    meterAndGate.mockResolvedValue(null);
    refundCredits.mockReset();
  });

  it("returns 404 when the target project doesn't exist or isn't owned by the user", async () => {
    findFirstProjects.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ sourceProjectId: "source-1", sourceChapterId: "chap-1" }), { params: Promise.resolve({ projectId: "missing" }) });
    expect(res.status).toBe(404);
    expect(meterAndGate).not.toHaveBeenCalled();
  });

  it("returns 404 when the target project's adaptedFromProjectId doesn't match the given sourceProjectId", async () => {
    findFirstProjects.mockResolvedValue({ ...targetProject, adaptedFromProjectId: "some-other-project" });
    const res = await POST(makeRequest({ sourceProjectId: "source-1", sourceChapterId: "chap-1" }), { params: Promise.resolve({ projectId: "target-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the source chapter doesn't exist in the source project", async () => {
    findFirstProjects.mockResolvedValue(targetProject);
    findFirstChapters.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ sourceProjectId: "source-1", sourceChapterId: "missing-chap" }), { params: Promise.resolve({ projectId: "target-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns the metering gate's response when the monthly limit is reached", async () => {
    findFirstProjects.mockResolvedValue(targetProject);
    findFirstChapters.mockResolvedValue(sourceChapter);
    const gateResponse = new Response(JSON.stringify({ error: "Monthly generation limit reached" }), { status: 429 });
    meterAndGate.mockResolvedValue(gateResponse);

    const res = await POST(makeRequest({ sourceProjectId: "source-1", sourceChapterId: "chap-1" }), { params: Promise.resolve({ projectId: "target-1" }) });
    expect(res.status).toBe(429);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("converts the chapter and creates a new chapter row in the target project", async () => {
    findFirstProjects.mockResolvedValue(targetProject);
    findFirstChapters.mockResolvedValue(sourceChapter);
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "INT. HOUSE - NIGHT\n\nIt was a dark night." }] });
    insertReturning.mockResolvedValue([{ id: "new-chap-1", title: "Chapter 1", wordCount: 6 }]);

    const res = await POST(makeRequest({ sourceProjectId: "source-1", sourceChapterId: "chap-1" }), { params: Promise.resolve({ projectId: "target-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapterId).toBe("new-chap-1");
    expect(meterAndGate).toHaveBeenCalledWith("user-1", "adapt-chapter");
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("refunds credits and returns 500 when the Claude call fails", async () => {
    findFirstProjects.mockResolvedValue(targetProject);
    findFirstChapters.mockResolvedValue(sourceChapter);
    messagesCreate.mockRejectedValue(new Error("Claude unavailable"));

    const res = await POST(makeRequest({ sourceProjectId: "source-1", sourceChapterId: "chap-1" }), { params: Promise.resolve({ projectId: "target-1" }) });
    expect(res.status).toBe(500);
    expect(refundCredits).toHaveBeenCalledWith("user-1", "adapt-chapter");
  });
});

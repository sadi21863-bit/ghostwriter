import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "story_pro"),
  canAccessFeature: vi.fn(() => true),
}));

const findFirstProjects = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
  },
}));

const runEditorCall = vi.fn();
vi.mock("@/lib/roles/editor", () => ({
  runEditorCall: (...args: any[]) => runEditorCall(...args),
  knowledgeAuditSystemPrompt: (n: number) => `AUDIT PROMPT for ${n} chapters`,
}));

const { POST } = await import("../route");

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

const twoChapters = [
  { id: "chap-1", title: "Chapter 1", content: "A".repeat(150) },
  { id: "chap-2", title: "Chapter 2", content: "B".repeat(150) },
];

describe("POST /api/projects/[projectId]/knowledge-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runEditorCall.mockResolvedValue({ ok: true, text: JSON.stringify({ issues: [], strengths: [], chaptersAudited: 2 }) });
  });

  it("injects the structured promise tracker into the message when threads/promises exist", async () => {
    findFirstProjects.mockResolvedValue({
      chapters: twoChapters, characters: [], locations: [],
      storyThreads: [{
        id: "t1", name: "The Missing Ring", threadType: "subplot", status: "open",
        promises: [{ id: "p1", setup: "Mara hides the ring", payoffIntent: "Ring is found by Kessler", status: "open", priority: "A" }],
      }],
    });
    await POST(new NextRequest("http://localhost", { method: "POST" }), makeParams());
    const [callArgs] = runEditorCall.mock.calls[0];
    const content = callArgs.messages[0].content;
    expect(content).toContain("STRUCTURED PROMISE TRACKER");
    expect(content).toContain("The Missing Ring");
    expect(content).toContain("Mara hides the ring");
    expect(content).toContain("priority A");
  });

  it("falls back to the inference-only note when no threads/promises are tracked", async () => {
    findFirstProjects.mockResolvedValue({ chapters: twoChapters, characters: [], locations: [], storyThreads: [] });
    await POST(new NextRequest("http://localhost", { method: "POST" }), makeParams());
    const [callArgs] = runEditorCall.mock.calls[0];
    const content = callArgs.messages[0].content;
    expect(content).toContain("infer promise/payoff purely from the manuscript");
  });

  it("still 400s when there are fewer than 2 chapters with real content", async () => {
    findFirstProjects.mockResolvedValue({ chapters: [twoChapters[0]], characters: [], locations: [], storyThreads: [] });
    const res = await POST(new NextRequest("http://localhost", { method: "POST" }), makeParams());
    expect(res.status).toBe(400);
    expect(runEditorCall).not.toHaveBeenCalled();
  });

  it("still 404s when the project isn't found", async () => {
    findFirstProjects.mockResolvedValue(undefined);
    const res = await POST(new NextRequest("http://localhost", { method: "POST" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("adds a semantic cross-reference hint when an open, unresolved promise's embedding matches a later chapter's", async () => {
    findFirstProjects.mockResolvedValue({
      chapters: [
        { id: "chap-1", title: "Chapter 1", content: "A".repeat(150), embedding: [1, 0] },
        { id: "chap-2", title: "Chapter 2", content: "B".repeat(150), embedding: [1, 0] },
      ],
      characters: [], locations: [],
      storyThreads: [{
        id: "t1", name: "The Missing Ring", threadType: "subplot", status: "open",
        promises: [{
          id: "p1", setup: "Mara hides the ring", payoffIntent: "", status: "open", priority: "A",
          payoffChapterId: null, setupChapterId: "chap-1", embedding: [1, 0],
        }],
      }],
    });
    await POST(new NextRequest("http://localhost", { method: "POST" }), makeParams());
    const [callArgs] = runEditorCall.mock.calls[0];
    const content = callArgs.messages[0].content;
    expect(content).toContain("SEMANTIC CROSS-REFERENCE HINTS");
    expect(content).toContain("Mara hides the ring");
    expect(content).toContain("Chapter 2");
  });

  it("omits the semantic hints section when no promise/chapter pair has embeddings", async () => {
    findFirstProjects.mockResolvedValue({
      chapters: twoChapters, characters: [], locations: [],
      storyThreads: [{
        id: "t1", name: "The Missing Ring", threadType: "subplot", status: "open",
        promises: [{ id: "p1", setup: "Mara hides the ring", status: "open", priority: "A", payoffChapterId: null, embedding: null }],
      }],
    });
    await POST(new NextRequest("http://localhost", { method: "POST" }), makeParams());
    const [callArgs] = runEditorCall.mock.calls[0];
    const content = callArgs.messages[0].content;
    expect(content).not.toContain("SEMANTIC CROSS-REFERENCE HINTS");
  });
});

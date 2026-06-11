import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstReaderSessions = vi.fn();
const findFirstChapters = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      readerSessions: { findFirst: (...args: any[]) => findFirstReaderSessions(...args) },
      chapters: { findFirst: (...args: any[]) => findFirstChapters(...args) },
    },
    insert: () => ({
      values: () => ({
        returning: (...args: any[]) => insertReturning(...args),
      }),
    }),
  },
}));

import { POST } from "../route";

const activeSession = {
  id: "session-1",
  projectId: "project-1",
  token: "tok123",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  createdAt: new Date(),
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/reader/tok123", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/reader/[token]", () => {
  beforeEach(() => {
    findFirstReaderSessions.mockReset();
    findFirstChapters.mockReset();
    insertReturning.mockReset();
  });

  it("returns 404 for an invalid or expired session token", async () => {
    findFirstReaderSessions.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ chapterId: "chapter-1", textOffset: 0, reactionType: "heart" }), {
      params: Promise.resolve({ token: "bad-token" }),
    });

    expect(res.status).toBe(404);
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it("rejects a chapterId that does not belong to the session's project", async () => {
    findFirstReaderSessions.mockResolvedValue(activeSession);
    findFirstChapters.mockResolvedValue(undefined); // chapter not found in this project

    const res = await POST(makeRequest({ chapterId: "other-project-chapter", textOffset: 0, reactionType: "heart" }), {
      params: Promise.resolve({ token: "tok123" }),
    });

    expect(res.status).toBe(400);
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it("inserts a reaction when the chapter belongs to the session's project", async () => {
    findFirstReaderSessions.mockResolvedValue(activeSession);
    findFirstChapters.mockResolvedValue({ id: "chapter-1" });
    insertReturning.mockResolvedValue([{ id: "reaction-1", chapterId: "chapter-1", textOffset: 0, reactionType: "heart" }]);

    const res = await POST(makeRequest({ chapterId: "chapter-1", textOffset: 0, reactionType: "heart" }), {
      params: Promise.resolve({ token: "tok123" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("reaction-1");
  });
});

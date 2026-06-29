import { describe, it, expect, vi, beforeEach } from "vitest";

// "Share reader link" leg of the WritingRoom flow (New project → … → Share):
// the Export-stage "↗ Share Draft" button calls POST /api/projects/[id]/reader-session
// to mint a token, then copies /reader/[token] to the clipboard. This guards that
// token-minting path now that it's the only shell's share mechanism.

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    insert: () => ({
      values: (vals: any) => {
        insertValues(vals);
        return { returning: (...rArgs: any[]) => insertReturning(...rArgs) };
      },
    }),
  },
}));

import { POST } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/projects/proj-1/reader-session", { method: "POST" });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/reader-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "https://www.ghost-writer.cc";
  });

  it("mints a reader token and returns a shareable /reader/[token] URL for the owner", async () => {
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    // Echo back exactly what the route inserted (the route generates its own token).
    insertReturning.mockImplementation(async () => {
      const inserted = insertValues.mock.calls.at(-1)?.[0];
      return [{ token: inserted.token, expiresAt: inserted.expiresAt }];
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    // A real, non-empty hex token was generated and persisted with the project.
    expect(body.token).toMatch(/^[0-9a-f]+$/);
    expect(insertValues.mock.calls[0][0]).toMatchObject({ projectId: "proj-1", token: body.token });
    // The share URL is the public reader link for that exact token.
    expect(body.shareUrl).toBe(`https://www.ghost-writer.cc/reader/${body.token}`);
  });

  it("returns 404 (and mints nothing) when the caller does not own the project", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(insertReturning).not.toHaveBeenCalled();
  });
});

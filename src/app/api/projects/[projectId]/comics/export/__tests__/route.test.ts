import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "creator_pro"),
  canAccessFeature: vi.fn(() => true),
}));

const findFirstProjects = vi.fn();
const findManyPages = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      comicPages: { findMany: (...args: any[]) => findManyPages(...args) },
    },
  },
}));

const putBlob = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: any[]) => putBlob(...args) }));

import { GET } from "../route";

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

const realFetch = global.fetch;

describe("GET /api/projects/[projectId]/comics/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", name: "The Dealer" });
    global.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as any;
    putBlob.mockResolvedValue({ url: "https://blob.example.com/comic.cbz" });
  });

  afterEach(() => { global.fetch = realFetch; });

  it("uses letteredImageUrl when present, falling back to imageUrl otherwise", async () => {
    findManyPages.mockResolvedValue([{
      pageNumber: 1,
      panels: [
        { panelIndex: 0, imageUrl: "https://blob.example.com/raw-0.png", letteredImageUrl: "https://blob.example.com/lettered-0.png" },
        { panelIndex: 1, imageUrl: "https://blob.example.com/raw-1.png", letteredImageUrl: "" },
      ],
    }]);

    await GET(new Request("http://localhost"), makeParams());

    const fetchedUrls = (global.fetch as any).mock.calls.map((c: any[]) => c[0]);
    expect(fetchedUrls).toContain("https://blob.example.com/lettered-0.png");
    expect(fetchedUrls).not.toContain("https://blob.example.com/raw-0.png");
    expect(fetchedUrls).toContain("https://blob.example.com/raw-1.png");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";

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

// The real sharp compositor needs valid image bytes to decode — this route
// test isn't exercising sharp itself (compose-page.test.ts covers the real
// grid-layout math), just that the export pipeline calls it once per PAGE
// with that page's fetched panel buffers, not once per panel.
const compositePage = vi.fn(async () => Buffer.from("fake-composed-page"));
vi.mock("@/lib/comic-gen/compose-page", () => ({ compositePage: (...args: any[]) => compositePage(...args) }));

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

  it("zips ONE composed page image per page, not one per panel", async () => {
    findManyPages.mockResolvedValue([
      {
        pageNumber: 1,
        panels: [
          { panelIndex: 0, imageUrl: "https://blob.example.com/p1-0.png", letteredImageUrl: "" },
          { panelIndex: 1, imageUrl: "https://blob.example.com/p1-1.png", letteredImageUrl: "" },
        ],
      },
      {
        pageNumber: 2,
        panels: [
          { panelIndex: 0, imageUrl: "https://blob.example.com/p2-0.png", letteredImageUrl: "" },
        ],
      },
    ]);

    await GET(new Request("http://localhost"), makeParams());

    expect(compositePage).toHaveBeenCalledTimes(2);
    // Each call gets that page's panel buffers, in panelIndex order — not a
    // flattened list across pages.
    expect(compositePage.mock.calls[0][0]).toHaveLength(2);
    expect(compositePage.mock.calls[1][0]).toHaveLength(1);

    const [zipCall] = putBlob.mock.calls;
    const zipBuffer: Buffer = zipCall[1];
    const zip = await JSZip.loadAsync(zipBuffer);
    const entries = Object.values(zip.files).filter(f => !f.dir).map(f => f.name).sort();
    expect(entries).toEqual(["comic/page-001.jpg", "comic/page-002.jpg"]);
  });

  it("returns 400 when no page has any panel images", async () => {
    findManyPages.mockResolvedValue([{ pageNumber: 1, panels: [{ panelIndex: 0, imageUrl: "", letteredImageUrl: "" }] }]);
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(400);
  });
});

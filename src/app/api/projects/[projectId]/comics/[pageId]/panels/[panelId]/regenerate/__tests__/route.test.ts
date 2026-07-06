import { describe, it, expect, vi, beforeEach } from "vitest";

// Force the no-Blob-configured path so the asserted URL is deterministic
// regardless of whether BLOB_READ_WRITE_TOKEN happens to be set locally.
vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
  verifyChildOwnership: vi.fn(async () => ({ id: "page-1" })),
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "segmind-key"),
}));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://segmind.example/generated.png" })),
}));
vi.mock("@/lib/production/vision-critic", () => ({
  critiqueShot: vi.fn(async () => ({})),
}));
vi.mock("@/lib/production/self-eval", () => ({
  scoreShot: vi.fn(() => ({ overall: 0.8, weakest: null })),
  retryHint: vi.fn(() => null),
}));

const generate = vi.fn();
vi.mock("@/lib/media/registry", () => ({
  getImageProvider: vi.fn(() => ({ name: "Segmind Soul", generate: (...args: any[]) => generate(...args) })),
}));

const findFirstProjects = vi.fn();
const findFirstUsers = vi.fn();
const findFirstPanels = vi.fn();
const findManyCharacters = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      users: { findFirst: (...args: any[]) => findFirstUsers(...args) },
      comicPanels: { findFirst: (...args: any[]) => findFirstPanels(...args) },
      characters: { findMany: (...args: any[]) => findManyCharacters(...args) },
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

import { POST } from "../route";

function makeRequest(body: any = {}) {
  return new Request("http://localhost/api/projects/proj-1/comics/page-1/panels/panel-1/regenerate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", pageId: "page-1", panelId: "panel-1" }) };
}

describe("POST /api/projects/[projectId]/comics/[pageId]/panels/[panelId]/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUsers.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted", imageProviderId: "segmind_soul" });
    findManyCharacters.mockResolvedValue([]);
    generate.mockResolvedValue({ url: "https://segmind.example/generated.png" });
    returning.mockResolvedValue([{ id: "panel-1", imageUrl: "https://segmind.example/generated.png" }]);
  });

  it("overwrites imageUrl by default (no keepAsCandidate)", async () => {
    findFirstPanels.mockResolvedValue({ id: "panel-1", projectId: "proj-1", panelIndex: 0, panelPrompt: "a panel", imageUrl: null, candidateImageUrls: [] });
    await POST(makeRequest(), makeParams());
    const [setArg] = updateSet.mock.calls[0];
    expect(setArg.imageUrl).toBe("https://segmind.example/generated.png");
  });

  it("appends to candidateImageUrls instead of overwriting when keepAsCandidate is set and a primary already exists", async () => {
    findFirstPanels.mockResolvedValue({
      id: "panel-1", projectId: "proj-1", panelIndex: 0, panelPrompt: "a panel",
      imageUrl: "https://example.com/existing-primary.png",
      candidateImageUrls: ["https://example.com/candidate-a.png"],
    });
    await POST(makeRequest({ keepAsCandidate: true }), makeParams());
    const [setArg] = updateSet.mock.calls[0];
    expect(setArg.candidateImageUrls).toEqual(["https://example.com/candidate-a.png", "https://segmind.example/generated.png"]);
    expect(setArg.imageUrl).toBeUndefined();
  });

  it("ignores keepAsCandidate when there's no existing primary yet", async () => {
    findFirstPanels.mockResolvedValue({ id: "panel-1", projectId: "proj-1", panelIndex: 0, panelPrompt: "a panel", imageUrl: null, candidateImageUrls: [] });
    await POST(makeRequest({ keepAsCandidate: true }), makeParams());
    const [setArg] = updateSet.mock.calls[0];
    expect(setArg.imageUrl).toBe("https://segmind.example/generated.png");
  });

  describe("character consistency (Soul ID regenerate bug fix)", () => {
    it("re-resolves the character's LIVE soulId by name instead of trusting the panel's stored (possibly stale/conflated) referenceImageUrl", async () => {
      findFirstPanels.mockResolvedValue({
        id: "panel-1", projectId: "proj-1", panelIndex: 0, panelPrompt: "a panel", imageUrl: null, candidateImageUrls: [],
        characterName: "Mara",
        // Simulates the pre-fix conflated state: this column held a soulId UUID,
        // not a URL — the fix must NOT read this field for generation anymore.
        referenceImageUrl: "soul-uuid-STALE",
      });
      findManyCharacters.mockResolvedValue([
        { name: "Mara", soulId: "soul-uuid-LIVE", portraitUrl: "https://example.com/mara.jpg" },
      ]);
      await POST(makeRequest(), makeParams());
      const [callArgs] = generate.mock.calls[0];
      expect(callArgs.soulId).toBe("soul-uuid-LIVE");
      expect(callArgs.referenceImageUrl).toBeUndefined();
    });

    it("falls back to the character's portrait URL when there's no trained soulId", async () => {
      findFirstPanels.mockResolvedValue({
        id: "panel-1", projectId: "proj-1", panelIndex: 0, panelPrompt: "a panel", imageUrl: null, candidateImageUrls: [],
        characterName: "Kessler", referenceImageUrl: "",
      });
      findManyCharacters.mockResolvedValue([
        { name: "Kessler", soulId: null, portraitUrl: "https://example.com/kessler.jpg" },
      ]);
      await POST(makeRequest(), makeParams());
      const [callArgs] = generate.mock.calls[0];
      expect(callArgs.soulId).toBeUndefined();
      expect(callArgs.referenceImageUrl).toBe("https://example.com/kessler.jpg");
    });
  });
});

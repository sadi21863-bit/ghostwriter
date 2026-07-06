import { describe, it, expect, vi, beforeEach } from "vitest";

// Force the no-Blob-configured path so the asserted URL is deterministic
// regardless of whether BLOB_READ_WRITE_TOKEN happens to be set locally.
vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "segmind-key"),
}));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://segmind.example/generated.jpg" })),
}));
vi.mock("@/lib/production/vision-critic", () => ({
  critiqueShot: vi.fn(async () => ({})),
}));
vi.mock("@/lib/production/self-eval", () => ({
  scoreShot: vi.fn(() => ({ overall: 0.8, weakest: null })),
  retryHint: vi.fn(() => null),
}));

const findFirstProjects = vi.fn();
const findFirstUser = vi.fn();
const findFirstShots = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const returning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      users: { findFirst: (...args: any[]) => findFirstUser(...args) },
      productionShots: { findFirst: (...args: any[]) => findFirstShots(...args) },
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

const generateSoulImage = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateSoulImage: (...args: any[]) => generateSoulImage(...args),
}));

import { POST } from "../route";

function makeRequest(body: any = {}) {
  return new Request("http://localhost/api/projects/proj-1/production/shots/shot-1/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", shotId: "shot-1" }) };
}

describe("POST /api/projects/[projectId]/production/shots/[shotId]/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUser.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted" });
    generateSoulImage.mockResolvedValue("https://segmind.example/generated.jpg");
    returning.mockResolvedValue([{ id: "shot-1", previewImageUrl: "https://segmind.example/generated.jpg" }]);
  });

  it("overwrites previewImageUrl by default (no keepAsCandidate)", async () => {
    findFirstShots.mockResolvedValue({ id: "shot-1", projectId: "proj-1", previewImageUrl: null, candidatePreviewUrls: [] });
    await POST(makeRequest(), makeParams());
    const [setArg] = updateSet.mock.calls[updateSet.mock.calls.length - 1];
    expect(setArg.previewImageUrl).toBe("https://segmind.example/generated.jpg");
    expect(setArg.candidatePreviewUrls).toBeUndefined();
  });

  it("appends to candidatePreviewUrls instead of overwriting when keepAsCandidate is set and a primary already exists", async () => {
    findFirstShots.mockResolvedValue({
      id: "shot-1", projectId: "proj-1",
      previewImageUrl: "https://example.com/existing-primary.jpg",
      candidatePreviewUrls: ["https://example.com/candidate-a.jpg"],
    });
    await POST(makeRequest({ keepAsCandidate: true }), makeParams());
    const [setArg] = updateSet.mock.calls[updateSet.mock.calls.length - 1];
    expect(setArg.previewImageUrl).toBeUndefined();
    expect(setArg.candidatePreviewUrls).toEqual(["https://example.com/candidate-a.jpg", "https://segmind.example/generated.jpg"]);
  });

  it("ignores keepAsCandidate when there's no existing primary yet (first generation always sets primary)", async () => {
    findFirstShots.mockResolvedValue({ id: "shot-1", projectId: "proj-1", previewImageUrl: null, candidatePreviewUrls: [] });
    await POST(makeRequest({ keepAsCandidate: true }), makeParams());
    const [setArg] = updateSet.mock.calls[updateSet.mock.calls.length - 1];
    expect(setArg.previewImageUrl).toBe("https://segmind.example/generated.jpg");
  });

  describe("character consistency (Soul ID vs portrait URL)", () => {
    it("passes the character's trained soulId instead of a portrait URL when one exists", async () => {
      findFirstShots.mockResolvedValue({
        id: "shot-1", projectId: "proj-1", previewImageUrl: null, candidatePreviewUrls: [],
        primaryCharacter: { name: "Mara", soulId: "soul-uuid-123", portraitUrl: "https://example.com/mara.jpg" },
      });
      await POST(makeRequest(), makeParams());
      const [callArgs] = generateSoulImage.mock.calls[0];
      expect(callArgs.soulId).toBe("soul-uuid-123");
      expect(callArgs.referenceImageUrl).toBeUndefined();
    });

    it("falls back to the portrait URL when the character has no trained soulId", async () => {
      findFirstShots.mockResolvedValue({
        id: "shot-1", projectId: "proj-1", previewImageUrl: null, candidatePreviewUrls: [],
        primaryCharacter: { name: "Kessler", soulId: null, portraitUrl: "https://example.com/kessler.jpg" },
      });
      await POST(makeRequest(), makeParams());
      const [callArgs] = generateSoulImage.mock.calls[0];
      expect(callArgs.soulId).toBeUndefined();
      expect(callArgs.referenceImageUrl).toBe("https://example.com/kessler.jpg");
    });
  });
});

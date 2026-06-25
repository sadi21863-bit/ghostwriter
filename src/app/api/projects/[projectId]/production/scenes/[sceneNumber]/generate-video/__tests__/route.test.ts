import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({
  decrypt: (...args: any[]) => decrypt(...args),
}));

const generateTextVideo = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateTextVideo: (...args: any[]) => generateTextVideo(...args),
}));

const findFirstProjects = vi.fn();
const findFirstUsers = vi.fn();
const findManyShots = vi.fn();
const updateSet = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      users: { findFirst: (...args: any[]) => findFirstUsers(...args) },
      productionShots: { findMany: (...args: any[]) => findManyShots(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));

import { POST } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/projects/proj-1/production/scenes/1/generate-video", { method: "POST" });
}
function makeParams(sceneNumber = "1") {
  return { params: Promise.resolve({ projectId: "proj-1", sceneNumber }) };
}

describe("POST /api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUsers.mockResolvedValue({ segmindApiKey: "encrypted-key" });
    decrypt.mockReturnValue("SG_real_key");
  });

  it("uses the scene's stored multiShotScript as the multi-shot prompt", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", multiShotScript: "Shot 1: @image1 enters. Shot 2: @image1 turns.", primaryCharacter: { portraitUrl: "https://example.com/mara.png" } },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, videoPrompt: "v2", soulPrompt: "p2", multiShotScript: "Shot 1: @image1 enters. Shot 2: @image1 turns.", primaryCharacter: { portraitUrl: "https://example.com/mara.png" } },
    ]);
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    await POST(makeRequest(), makeParams());

    expect(generateTextVideo).toHaveBeenCalledWith(expect.objectContaining({
      model: "seedance",
      multiShotPrompt: "Shot 1: @image1 enters. Shot 2: @image1 turns.",
      apiKey: "SG_real_key",
    }));
  });

  it("synthesizes a fallback Shot N script when no shot has a stored multiShotScript", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "Mara enters the alley.", soulPrompt: "p1", multiShotScript: "", primaryCharacter: null },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, videoPrompt: "Mara turns.", soulPrompt: "p2", multiShotScript: "", primaryCharacter: null },
    ]);
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    await POST(makeRequest(), makeParams());

    expect(generateTextVideo).toHaveBeenCalledWith(expect.objectContaining({
      multiShotPrompt: "Shot 1: Mara enters the alley. Shot 2: Mara turns.",
    }));
  });

  it("dedupes character portrait URLs and caps referenceImages at 9", async () => {
    const shots = Array.from({ length: 12 }, (_, i) => ({
      id: `shot-${i}`,
      shotNumber: i + 1,
      sceneNumber: 1,
      videoPrompt: `v${i}`,
      soulPrompt: `p${i}`,
      multiShotScript: "script",
      primaryCharacter: { portraitUrl: `https://example.com/char-${i % 3}.png` }, // only 3 distinct
    }));
    findManyShots.mockResolvedValue(shots);
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    await POST(makeRequest(), makeParams());

    const call = generateTextVideo.mock.calls[0][0];
    expect(call.referenceImages.length).toBe(3);
    expect(call.referenceImages.length).toBeLessThanOrEqual(9);
  });

  it("writes generationStatus/higgsfieldJobId to all shots in the scene on async submit", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", multiShotScript: "s", primaryCharacter: null },
    ]);
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.status).toBe("generating_final");
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      generationStatus: "generating_final",
      higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status",
    }));
  });

  it("returns 404 when the scene has no shots", async () => {
    findManyShots.mockResolvedValue([]);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(generateTextVideo).not.toHaveBeenCalled();
  });

  it("returns 400 with no Segmind key configured", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", multiShotScript: "s", primaryCharacter: null },
    ]);
    findFirstUsers.mockResolvedValue({ segmindApiKey: "" });
    decrypt.mockReturnValue("");

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(400);
    expect(generateTextVideo).not.toHaveBeenCalled();
  });
});

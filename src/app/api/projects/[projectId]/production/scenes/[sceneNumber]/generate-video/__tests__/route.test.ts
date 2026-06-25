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
const updateWhere = vi.fn();
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
        return { where: (...args: any[]) => { updateWhere(...args); return Promise.resolve(); } };
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

describe("POST /api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video (per-shot)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUsers.mockResolvedValue({ segmindApiKey: "encrypted-key" });
    decrypt.mockReturnValue("SG_real_key");
  });

  it("submits one independent generateTextVideo call per shot, using each shot's own prompt and duration", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "Mara enters", soulPrompt: "p1", duration: 10, primaryCharacter: { portraitUrl: "https://example.com/mara.png" } },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, videoPrompt: "Mara turns", soulPrompt: "p2", duration: null, primaryCharacter: { portraitUrl: "https://example.com/mara.png" } },
    ]);
    generateTextVideo.mockResolvedValue({ requestId: "req-x", pollingUrl: "https://api.segmind.com/v2/requests/req-x/status" });

    await POST(makeRequest(), makeParams());

    expect(generateTextVideo).toHaveBeenCalledTimes(2);
    expect(generateTextVideo).toHaveBeenNthCalledWith(1, expect.objectContaining({
      model: "seedance",
      prompt: "Mara enters",
      duration: 10,
      referenceImages: ["https://example.com/mara.png"],
      apiKey: "SG_real_key",
    }));
    expect(generateTextVideo).toHaveBeenNthCalledWith(2, expect.objectContaining({
      prompt: "Mara turns",
      duration: 5, // null falls back to the existing UI default
    }));
    // no multiShotPrompt anywhere — this is the per-shot path now
    expect(generateTextVideo.mock.calls[0][0].multiShotPrompt).toBeUndefined();
  });

  it("writes generatingStatus/higgsfieldJobId onto each shot's OWN row independently, not broadcast to the scene", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", duration: 5, primaryCharacter: null },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, videoPrompt: "v2", soulPrompt: "p2", duration: 5, primaryCharacter: null },
    ]);
    generateTextVideo
      .mockResolvedValueOnce({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" })
      .mockResolvedValueOnce({ requestId: "req-2", pollingUrl: "https://api.segmind.com/v2/requests/req-2/status" });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "generating_final", shotCount: 2 });
    expect(updateSet).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenNthCalledWith(1, expect.objectContaining({ higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status" }));
    expect(updateSet).toHaveBeenNthCalledWith(2, expect.objectContaining({ higgsfieldJobId: "req-2|https://api.segmind.com/v2/requests/req-2/status" }));
  });

  it("dedupes character portrait URLs and caps referenceImages at 9 (same as before, scene-wide)", async () => {
    const shots = Array.from({ length: 12 }, (_, i) => ({
      id: `shot-${i}`, shotNumber: i + 1, sceneNumber: 1, videoPrompt: `v${i}`, soulPrompt: `p${i}`, duration: 5,
      primaryCharacter: { portraitUrl: `https://example.com/char-${i % 3}.png` },
    }));
    findManyShots.mockResolvedValue(shots);
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    await POST(makeRequest(), makeParams());

    const call = generateTextVideo.mock.calls[0][0];
    expect(call.referenceImages.length).toBe(3);
  });

  it("returns 404 when the scene has no shots", async () => {
    findManyShots.mockResolvedValue([]);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(generateTextVideo).not.toHaveBeenCalled();
  });

  it("returns 400 with no Segmind key configured", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", duration: 5, primaryCharacter: null },
    ]);
    findFirstUsers.mockResolvedValue({ segmindApiKey: "" });
    decrypt.mockReturnValue("");

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(400);
    expect(generateTextVideo).not.toHaveBeenCalled();
  });
});

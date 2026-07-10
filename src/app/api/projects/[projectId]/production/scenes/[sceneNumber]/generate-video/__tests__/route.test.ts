import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({
  decrypt: (...args: any[]) => decrypt(...args),
}));

const generateTextVideo = vi.fn();
const pollJob = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateTextVideo: (...args: any[]) => generateTextVideo(...args),
  pollJob: (...args: any[]) => pollJob(...args),
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

function makeRequest(query = "") {
  return new Request(`http://localhost/api/projects/proj-1/production/scenes/1/generate-video${query}`, { method: "POST" });
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

  it("scopes each shot's referenceImages to ITS OWN primaryCharacter, not every character in the scene", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "The Dealer alone", soulPrompt: "p1", duration: 5, primaryCharacter: { portraitUrl: "https://example.com/dealer.png" } },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, videoPrompt: "Kessler confronts him", soulPrompt: "p2", duration: 5, primaryCharacter: { portraitUrl: "https://example.com/kessler.png" } },
    ]);
    generateTextVideo.mockResolvedValue({ requestId: "req-x", pollingUrl: "https://api.segmind.com/v2/requests/req-x/status" });

    await POST(makeRequest(), makeParams());

    // The bug this fixes: shot-1 (The Dealer's own shot) must NOT receive Kessler's portrait too.
    expect(generateTextVideo.mock.calls[0][0].referenceImages).toEqual(["https://example.com/dealer.png"]);
    expect(generateTextVideo.mock.calls[1][0].referenceImages).toEqual(["https://example.com/kessler.png"]);
  });

  it("falls back to the deduped, capped scene-wide reference set only for shots with no primaryCharacter", async () => {
    const characterShots = Array.from({ length: 10 }, (_, i) => ({
      id: `char-shot-${i}`, shotNumber: i + 1, sceneNumber: 1, videoPrompt: `v${i}`, soulPrompt: `p${i}`, duration: 5,
      primaryCharacter: { portraitUrl: `https://example.com/char-${i}.png` },
    }));
    const noCharacterShot = {
      id: "establishing-shot", shotNumber: 11, sceneNumber: 1, videoPrompt: "Wide establishing shot, empty street", soulPrompt: "p-est", duration: 5,
      primaryCharacter: null,
    };
    findManyShots.mockResolvedValue([...characterShots, noCharacterShot]);
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    await POST(makeRequest(), makeParams());

    // Each character shot still gets ONLY its own portrait.
    expect(generateTextVideo.mock.calls[0][0].referenceImages).toEqual(["https://example.com/char-0.png"]);
    // The no-character shot falls back to the scene-wide set, deduped and capped at 9.
    const fallbackCall = generateTextVideo.mock.calls[10][0];
    expect(fallbackCall.referenceImages).toHaveLength(9);
    expect(fallbackCall.referenceImages).toEqual(
      characterShots.slice(0, 9).map(s => s.primaryCharacter.portraitUrl)
    );
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

  it("returns the existing sceneFinalVideoUrl and does not resubmit jobs when the scene is already stitched", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", duration: 5, primaryCharacter: null, sceneFinalVideoUrl: "https://blob.example.com/already-stitched.mp4" },
    ]);

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example.com/already-stitched.mp4" });
    expect(generateTextVideo).not.toHaveBeenCalled();
  });

  it("returns 404 when the scene has no shots", async () => {
    findManyShots.mockResolvedValue([]);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(generateTextVideo).not.toHaveBeenCalled();
  });

  it("queries shots ordered by sortOrder (falling back to shotNumber), so Phase C's drag-reorder affects the stitch", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, videoPrompt: "v1", soulPrompt: "p1", duration: 5, primaryCharacter: null },
    ]);
    generateTextVideo.mockResolvedValue({ requestId: "req-x", pollingUrl: "https://api.segmind.com/v2/requests/req-x/status" });

    await POST(makeRequest(), makeParams());

    const [callArgs] = findManyShots.mock.calls[0];
    const ascOrder: string[] = [];
    callArgs.orderBy({ sortOrder: "sortOrder", shotNumber: "shotNumber" }, { asc: (col: string) => { ascOrder.push(col); return col; } });
    expect(ascOrder).toEqual(["sortOrder", "shotNumber"]);
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

describe("POST .../generate-video?multiShot=1 (item 68 Task 3, opt-in)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUsers.mockResolvedValue({ segmindApiKey: "encrypted-key" });
    decrypt.mockReturnValue("SG_real_key");
  });

  function makeShots(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `shot-${i + 1}`, shotNumber: i + 1, sceneNumber: 1,
      videoPrompt: `Shot action ${i + 1}`, soulPrompt: `p${i + 1}`, duration: 5,
      primaryCharacter: { portraitUrl: `https://example.com/char-${i}.png` },
    }));
  }

  it("submits ONE generateTextVideo call with a combined multiShotPrompt instead of N per-shot calls, when the flag is set and the scene qualifies (<=5 shots)", async () => {
    findManyShots.mockResolvedValue(makeShots(3));
    generateTextVideo.mockResolvedValue({ mediaUrl: "https://blob.example/combined.mp4" });

    const res = await POST(makeRequest("?multiShot=1"), makeParams());
    const body = await res.json();

    expect(generateTextVideo).toHaveBeenCalledTimes(1);
    const call = generateTextVideo.mock.calls[0][0];
    expect(call.multiShotPrompt).toContain("Shot 1: Shot action 1");
    expect(call.multiShotPrompt).toContain("Shot 3: Shot action 3");
    expect(call.prompt).toBeUndefined();
    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example/combined.mp4", mode: "multiShot" });
  });

  it("sets the same combined video as BOTH finalVideoUrl and sceneFinalVideoUrl on every shot in the scene (no per-shot stitch needed - the single call already covers the whole scene)", async () => {
    findManyShots.mockResolvedValue(makeShots(2));
    generateTextVideo.mockResolvedValue({ mediaUrl: "https://blob.example/combined.mp4" });

    await POST(makeRequest("?multiShot=1"), makeParams());

    expect(updateSet).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenNthCalledWith(1, expect.objectContaining({
      finalVideoUrl: "https://blob.example/combined.mp4",
      sceneFinalVideoUrl: "https://blob.example/combined.mp4",
      generationStatus: "final_ready",
    }));
  });

  it("polls to completion when the submission returns a job instead of an immediate mediaUrl", async () => {
    findManyShots.mockResolvedValue(makeShots(2));
    generateTextVideo.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });
    pollJob
      .mockResolvedValueOnce({ status: "PROCESSING" })
      .mockResolvedValueOnce({ status: "COMPLETED", mediaUrl: "https://blob.example/combined.mp4" });

    const res = await POST(makeRequest("?multiShot=1"), makeParams());
    const body = await res.json();

    expect(pollJob).toHaveBeenCalledTimes(2);
    expect(body.status).toBe("final_ready");
  }, 15_000);

  it("falls back to the per-shot path when the multi-shot call fails, rather than erroring out", async () => {
    findManyShots.mockResolvedValue(makeShots(2));
    generateTextVideo
      .mockRejectedValueOnce(new Error("multi-shot submit failed"))
      .mockResolvedValue({ requestId: "req-x", pollingUrl: "https://api.segmind.com/v2/requests/req-x/status" }); // per-shot fallback calls

    const res = await POST(makeRequest("?multiShot=1"), makeParams());
    const body = await res.json();

    // 1 failed multi-shot attempt + 2 per-shot fallback calls = 3 total
    expect(generateTextVideo).toHaveBeenCalledTimes(3);
    expect(body).toEqual({ status: "generating_final", shotCount: 2 });
  });

  it("does not attempt the multi-shot path for scenes larger than 5 shots, even with the flag set", async () => {
    findManyShots.mockResolvedValue(makeShots(6));
    generateTextVideo.mockResolvedValue({ requestId: "req-x", pollingUrl: "https://api.segmind.com/v2/requests/req-x/status" });

    await POST(makeRequest("?multiShot=1"), makeParams());

    // per-shot path: one call per shot, none with multiShotPrompt
    expect(generateTextVideo).toHaveBeenCalledTimes(6);
    for (const call of generateTextVideo.mock.calls) {
      expect(call[0].multiShotPrompt).toBeUndefined();
    }
  });

  it("does not use the multi-shot path when the flag is absent, regardless of scene size (default behavior unchanged)", async () => {
    findManyShots.mockResolvedValue(makeShots(3));
    generateTextVideo.mockResolvedValue({ requestId: "req-x", pollingUrl: "https://api.segmind.com/v2/requests/req-x/status" });

    await POST(makeRequest(), makeParams());

    expect(generateTextVideo).toHaveBeenCalledTimes(3);
    for (const call of generateTextVideo.mock.calls) {
      expect(call[0].multiShotPrompt).toBeUndefined();
    }
  });
});

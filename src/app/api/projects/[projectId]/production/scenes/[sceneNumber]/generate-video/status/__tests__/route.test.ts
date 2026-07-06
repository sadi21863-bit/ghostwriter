import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({
  decrypt: (...args: any[]) => decrypt(...args),
}));

const pollJob = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  pollJob: (...args: any[]) => pollJob(...args),
}));

const concatVideos = vi.fn();
const concatVideosWithCrossfade = vi.fn();
const trimClip = vi.fn();
vi.mock("@/lib/video/concat", () => ({
  concatVideos: (...args: any[]) => concatVideos(...args),
  concatVideosWithCrossfade: (...args: any[]) => concatVideosWithCrossfade(...args),
  trimClip: (...args: any[]) => trimClip(...args),
}));

const rmMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => Buffer.from("stitched-bytes")),
  mkdtemp: vi.fn(async () => "/tmp/scene-stitch-abc"),
  rm: (...args: any[]) => rmMock(...args),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example.com/scene-final.mp4" })),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock as any;

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

import { GET } from "../route";

function makeParams(sceneNumber = "1") {
  return { params: Promise.resolve({ projectId: "proj-1", sceneNumber }) };
}

describe("GET .../scenes/[sceneNumber]/generate-video/status (per-shot + stitch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUsers.mockResolvedValue({ segmindApiKey: "encrypted-key" });
    decrypt.mockReturnValue("SG_real_key");
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    rmMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // process.env is process-global, not per-file isolated like vitest's module
    // registry — leaving this set would leak into other test files' runs.
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("returns generating_final while any shot is still pending, without stitching", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-2|https://api.segmind.com/v2/requests/req-2/status", sceneFinalVideoUrl: "" },
    ]);
    pollJob.mockResolvedValue({ status: "PROCESSING" });

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "generating_final" });
    expect(concatVideos).not.toHaveBeenCalled();
  });

  it("polls each shot's own pending job and updates that shot's own row on completion", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status", sceneFinalVideoUrl: "" },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-2|https://api.segmind.com/v2/requests/req-2/status", sceneFinalVideoUrl: "" },
    ]);
    pollJob
      .mockResolvedValueOnce({ status: "COMPLETED", mediaUrl: "https://example.com/1.mp4" })
      .mockResolvedValueOnce({ status: "PROCESSING" });

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "generating_final" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ finalVideoUrl: "https://example.com/1.mp4", generationStatus: "final_ready" }));
  });

  it("stitches all shots into one file and returns final_ready once every shot has completed", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/2.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
    ]);

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(concatVideos).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example.com/scene-final.mp4" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ sceneFinalVideoUrl: "https://blob.example.com/scene-final.mp4" }));
  });

  it("cleans up the temp work directory after stitching", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
    ]);

    await GET(new Request("http://localhost"), makeParams());

    expect(rmMock).toHaveBeenCalledWith("/tmp/scene-stitch-abc", { recursive: true, force: true });
  });

  it("fails fast with a clear error when Blob storage isn't configured, without downloading or running ffmpeg", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
    ]);

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Blob");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(concatVideos).not.toHaveBeenCalled();
  });

  it("returns the already-stitched sceneFinalVideoUrl immediately on repeat polls, without re-stitching", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "https://blob.example.com/already-stitched.mp4" },
    ]);

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example.com/already-stitched.mp4" });
    expect(concatVideos).not.toHaveBeenCalled();
  });

  it("returns error and stops polling siblings once any shot's job FAILS", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status", sceneFinalVideoUrl: "" },
    ]);
    pollJob.mockResolvedValue({ status: "FAILED" });

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "error" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ generationStatus: "error" }));
  });

  it("returns 404 when the scene has no shots", async () => {
    findManyShots.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost"), makeParams());

    expect(res.status).toBe(404);
  });

  it("trims a shot's clip before stitching when trimStartSec/trimEndSec are set", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "", trimStartSec: 2, trimEndSec: 7 },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/2.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "", trimStartSec: null, trimEndSec: null },
    ]);

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(trimClip).toHaveBeenCalledTimes(1);
    expect(trimClip).toHaveBeenCalledWith(expect.stringContaining("1.mp4"), expect.stringContaining("1-trimmed.mp4"), 2, 7);
    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example.com/scene-final.mp4" });
  });

  it("skips trimClip entirely when no shot has trim values set", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "", trimStartSec: null, trimEndSec: null },
    ]);

    await GET(new Request("http://localhost"), makeParams());

    expect(trimClip).not.toHaveBeenCalled();
  });

  it("uses concatVideosWithCrossfade instead of concatVideos when ?crossfade=1 is set", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
      { id: "shot-2", shotNumber: 2, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/2.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
    ]);

    const res = await GET(new Request("http://localhost?crossfade=1"), makeParams());
    const body = await res.json();

    expect(concatVideosWithCrossfade).toHaveBeenCalledTimes(1);
    expect(concatVideos).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example.com/scene-final.mp4" });
  });

  it("queries shots ordered by sortOrder (falling back to shotNumber), so Phase C's drag-reorder affects the stitch", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", shotNumber: 1, sceneNumber: 1, generationStatus: "final_ready", finalVideoUrl: "https://example.com/1.mp4", higgsfieldJobId: "", sceneFinalVideoUrl: "" },
    ]);

    await GET(new Request("http://localhost"), makeParams());

    const [callArgs] = findManyShots.mock.calls[0];
    const ascOrder: string[] = [];
    callArgs.orderBy({ sortOrder: "sortOrder", shotNumber: "shotNumber" }, { asc: (col: string) => { ascOrder.push(col); return col; } });
    expect(ascOrder).toEqual(["sortOrder", "shotNumber"]);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const mixAudioIntoVideo = vi.fn();
vi.mock("@/lib/video/concat", () => ({
  mixAudioIntoVideo: (...args: any[]) => mixAudioIntoVideo(...args),
}));

const rmMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => Buffer.from("mixed-bytes")),
  mkdtemp: vi.fn(async () => "/tmp/scene-music-abc"),
  rm: (...args: any[]) => rmMock(...args),
}));

const putMock = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...args: any[]) => putMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock as any;

const findFirstProjects = vi.fn();
const findManyShots = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
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

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", sceneNumber: "1" }) };
}

describe("POST .../scenes/[sceneNumber]/add-music", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    fetchMock.mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) });
    putMock.mockResolvedValue({ url: "https://blob.example.com/mixed-123.mp4" });
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    rmMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("mixes the scene's audio track into its stitched video and updates sceneFinalVideoUrl", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", sceneFinalVideoUrl: "https://example.com/stitched.mp4", sceneAudioTrackUrl: "https://example.com/track.mp3" },
      { id: "shot-2", sceneFinalVideoUrl: "https://example.com/stitched.mp4", sceneAudioTrackUrl: "https://example.com/track.mp3" },
    ]);

    const res = await POST(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mixAudioIntoVideo).toHaveBeenCalledWith(
      expect.stringContaining("video.mp4"),
      expect.stringContaining("audio.mp3"),
      expect.stringContaining("mixed.mp4"),
    );
    expect(body).toEqual({ status: "final_ready", videoUrl: "https://blob.example.com/mixed-123.mp4" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ sceneFinalVideoUrl: "https://blob.example.com/mixed-123.mp4" }));
  });

  it("returns 400 when the scene hasn't been stitched yet", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", sceneFinalVideoUrl: "", sceneAudioTrackUrl: "https://example.com/track.mp3" },
    ]);
    const res = await POST(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(400);
    expect(mixAudioIntoVideo).not.toHaveBeenCalled();
  });

  it("returns 400 when no music track has been uploaded yet", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", sceneFinalVideoUrl: "https://example.com/stitched.mp4", sceneAudioTrackUrl: "" },
    ]);
    const res = await POST(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(400);
    expect(mixAudioIntoVideo).not.toHaveBeenCalled();
  });

  it("cleans up the temp work directory afterward", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", sceneFinalVideoUrl: "https://example.com/stitched.mp4", sceneAudioTrackUrl: "https://example.com/track.mp3" },
    ]);
    await POST(new Request("http://localhost"), makeParams());
    expect(rmMock).toHaveBeenCalledWith("/tmp/scene-music-abc", { recursive: true, force: true });
  });

  it("returns 404 when the scene has no shots", async () => {
    findManyShots.mockResolvedValue([]);
    const res = await POST(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(404);
  });
});

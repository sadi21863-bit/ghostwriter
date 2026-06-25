import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example.com/final.mp4" })),
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

import { GET } from "../route";

function makeParams(sceneNumber = "1") {
  return { params: Promise.resolve({ projectId: "proj-1", sceneNumber }) };
}

describe("GET .../scenes/[sceneNumber]/generate-video/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findFirstUsers.mockResolvedValue({ segmindApiKey: "encrypted-key" });
    decrypt.mockReturnValue("SG_real_key");
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("returns final_ready immediately if any shot in the scene already has it", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", generationStatus: "final_ready", finalVideoUrl: "https://example.com/final.mp4", higgsfieldJobId: "" },
    ]);

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "final_ready", videoUrl: "https://example.com/final.mp4" });
    expect(pollJob).not.toHaveBeenCalled();
  });

  it("polls using the job id and writes finalVideoUrl to every shot in the scene when COMPLETED", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status" },
      { id: "shot-2", generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status" },
    ]);
    pollJob.mockResolvedValue({ status: "COMPLETED", mediaUrl: "https://segmind.example.com/result.mp4" });

    const res = await GET(new Request("http://localhost"), makeParams());
    const body = await res.json();

    expect(body).toEqual({ status: "final_ready", videoUrl: "https://segmind.example.com/result.mp4" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ generationStatus: "final_ready", finalVideoUrl: "https://segmind.example.com/result.mp4" }));
  });

  it("marks every shot in the scene as error when the job FAILED", async () => {
    findManyShots.mockResolvedValue([
      { id: "shot-1", generationStatus: "generating_final", finalVideoUrl: "", higgsfieldJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status" },
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
});

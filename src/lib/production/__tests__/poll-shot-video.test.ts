import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstShots = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: { productionShots: { findFirst: (...args: any[]) => findFirstShots(...args) } },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: (...args: any[]) => updateWhere(...args) };
      },
    }),
  },
}));

const pollJob = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({ pollJob: (...args: any[]) => pollJob(...args) }));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: any[]) => put(...args) }));

import { pollAndUpdateShotVideo } from "@/lib/production/poll-shot-video";

describe("pollAndUpdateShotVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).fetch;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("returns no_job when the shot doesn't exist", async () => {
    findFirstShots.mockResolvedValue(undefined);
    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "no_job" });
    expect(pollJob).not.toHaveBeenCalled();
  });

  it("short-circuits to final_ready without polling when the shot is already done", async () => {
    findFirstShots.mockResolvedValue({ id: "s1", generationStatus: "final_ready", finalVideoUrl: "https://cdn/video.mp4" });
    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "final_ready", videoUrl: "https://cdn/video.mp4" });
    expect(pollJob).not.toHaveBeenCalled();
  });

  it("returns no_job when there's no higgsfieldJobId to poll", async () => {
    findFirstShots.mockResolvedValue({ id: "s1", generationStatus: "generating_final", higgsfieldJobId: null });
    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "no_job" });
  });

  it("returns generating_final while the job is still processing", async () => {
    findFirstShots.mockResolvedValue({ id: "s1", generationStatus: "generating_final", higgsfieldJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "PROCESSING" });
    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "generating_final" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("marks the shot as error on FAILED/ERROR status", async () => {
    findFirstShots.mockResolvedValue({ id: "s1", generationStatus: "generating_final", higgsfieldJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "FAILED" });
    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "error" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ generationStatus: "error" }));
  });

  it("updates the shot to final_ready with the raw media URL when Blob isn't configured", async () => {
    findFirstShots.mockResolvedValue({ id: "s1", generationStatus: "generating_final", higgsfieldJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "COMPLETED", mediaUrl: "https://segmind/result.mp4" });
    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "final_ready", videoUrl: "https://segmind/result.mp4" });
    expect(put).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ finalVideoUrl: "https://segmind/result.mp4", generationStatus: "final_ready" }));
  });

  it("re-uploads to Blob and stores the Blob URL when BLOB_READ_WRITE_TOKEN is set", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
    findFirstShots.mockResolvedValue({ id: "s1", generationStatus: "generating_final", higgsfieldJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "COMPLETED", mediaUrl: "https://segmind/result.mp4" });
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) });
    put.mockResolvedValue({ url: "https://blob.vercel-storage.com/final.mp4" });

    const result = await pollAndUpdateShotVideo({ shotId: "s1", projectId: "p1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "final_ready", videoUrl: "https://blob.vercel-storage.com/final.mp4" });
    expect(put).toHaveBeenCalled();
  });
});

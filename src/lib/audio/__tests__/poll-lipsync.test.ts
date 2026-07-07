import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstAudioExports = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: { audioExports: { findFirst: (...args: any[]) => findFirstAudioExports(...args) } },
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

import { pollAndUpdateLipsync } from "@/lib/audio/poll-lipsync";

describe("pollAndUpdateLipsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no_job when the audioExport doesn't exist", async () => {
    findFirstAudioExports.mockResolvedValue(undefined);
    const result = await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "no_job" });
    expect(pollJob).not.toHaveBeenCalled();
  });

  it("short-circuits to completed without polling when already done", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "completed", lipsyncVideoUrl: "https://cdn/lip.mp4" });
    const result = await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "completed", videoUrl: "https://cdn/lip.mp4" });
    expect(pollJob).not.toHaveBeenCalled();
  });

  it("returns no_job when there's no lipsyncJobId to poll", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "" });
    const result = await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "no_job" });
  });

  it("uses the real stored pollingUrl (requestId|pollingUrl), not a guessed one", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status" });
    pollJob.mockResolvedValue({ status: "PROCESSING" });
    await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "my-key" });
    expect(pollJob).toHaveBeenCalledWith({ apiKey: "my-key", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });
  });

  it("returns processing while the job is still running", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "PROCESSING" });
    const result = await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "processing" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("marks the export as failed on FAILED/ERROR status", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "FAILED" });
    const result = await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "failed" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ lipsyncStatus: "failed" }));
  });

  it("updates to completed with the media URL on COMPLETED status", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "req-1|https://poll" });
    pollJob.mockResolvedValue({ status: "COMPLETED", mediaUrl: "https://segmind/result.mp4" });
    const result = await pollAndUpdateLipsync({ audioExportId: "a1", segmindApiKey: "key" });
    expect(result).toEqual({ outcome: "completed", videoUrl: "https://segmind/result.mp4" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ lipsyncVideoUrl: "https://segmind/result.mp4", lipsyncStatus: "completed" }));
  });
});

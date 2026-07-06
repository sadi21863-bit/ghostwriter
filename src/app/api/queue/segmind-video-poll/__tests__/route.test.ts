import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyQstashRequest = vi.fn();
const scheduleCallback = vi.fn();
const isQstashConfigured = vi.fn();
vi.mock("@/lib/queue/qstash", () => ({
  verifyQstashRequest: (...args: any[]) => verifyQstashRequest(...args),
  scheduleCallback: (...args: any[]) => scheduleCallback(...args),
  isQstashConfigured: (...args: any[]) => isQstashConfigured(...args),
}));

const findFirstUsers = vi.fn();
vi.mock("@/db", () => ({
  db: { query: { users: { findFirst: (...args: any[]) => findFirstUsers(...args) } } },
}));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({ decrypt: (...args: any[]) => decrypt(...args) }));

const pollAndUpdateShotVideo = vi.fn();
vi.mock("@/lib/production/poll-shot-video", () => ({
  pollAndUpdateShotVideo: (...args: any[]) => pollAndUpdateShotVideo(...args),
}));

import { POST } from "../route";

function makeRequest(body?: any) {
  return new Request("http://localhost/api/queue/segmind-video-poll", {
    method: "POST",
    headers: { "Upstash-Signature": "sig" },
    body: JSON.stringify(body ?? {}),
  });
}

describe("POST /api/queue/segmind-video-poll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstUsers.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted-key" });
    decrypt.mockReturnValue("real-segmind-key");
    isQstashConfigured.mockReturnValue(true);
  });

  it("401s when the QStash signature is invalid", async () => {
    verifyQstashRequest.mockRejectedValue(new Error("Invalid Upstash-Signature"));
    const res = await POST(makeRequest({ userId: "user-1", projectId: "p1", shotId: "s1" }));
    expect(res.status).toBe(401);
    expect(pollAndUpdateShotVideo).not.toHaveBeenCalled();
  });

  it("400s when required fields are missing from the verified payload", async () => {
    verifyQstashRequest.mockResolvedValue({ userId: "user-1" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("stops without rescheduling when the user has no usable Segmind key", async () => {
    verifyQstashRequest.mockResolvedValue({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 0 });
    decrypt.mockReturnValue("");
    const res = await POST(makeRequest({ userId: "user-1", projectId: "p1", shotId: "s1" }));
    const body = await res.json();
    expect(body.outcome).toBe("no_key");
    expect(scheduleCallback).not.toHaveBeenCalled();
  });

  it("reschedules another poll when the job is still processing and under the attempt cap", async () => {
    verifyQstashRequest.mockResolvedValue({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 2 });
    pollAndUpdateShotVideo.mockResolvedValue({ outcome: "generating_final" });
    const res = await POST(makeRequest({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 2 }));
    const body = await res.json();
    expect(body.outcome).toBe("generating_final");
    expect(scheduleCallback).toHaveBeenCalledWith(expect.objectContaining({
      body: { userId: "user-1", projectId: "p1", shotId: "s1", attempt: 3 },
    }));
  });

  it("does not reschedule once the job reaches final_ready", async () => {
    verifyQstashRequest.mockResolvedValue({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 1 });
    pollAndUpdateShotVideo.mockResolvedValue({ outcome: "final_ready", videoUrl: "https://cdn/final.mp4" });
    const res = await POST(makeRequest({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 1 }));
    const body = await res.json();
    expect(body.outcome).toBe("final_ready");
    expect(scheduleCallback).not.toHaveBeenCalled();
  });

  it("does not reschedule once the attempt cap is reached", async () => {
    verifyQstashRequest.mockResolvedValue({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 40 });
    pollAndUpdateShotVideo.mockResolvedValue({ outcome: "generating_final" });
    const res = await POST(makeRequest({ userId: "user-1", projectId: "p1", shotId: "s1", attempt: 40 }));
    await res.json();
    expect(scheduleCallback).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/subscription", () => ({
  getUserTier: vi.fn(async () => "story_pro"),
}));

const findFirstAudioExports = vi.fn();
const findFirstCharacters = vi.fn();
const findFirstUsers = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      audioExports: { findFirst: (...args: any[]) => findFirstAudioExports(...args) },
      characters: { findFirst: (...args: any[]) => findFirstCharacters(...args) },
      users: { findFirst: (...args: any[]) => findFirstUsers(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: (...args: any[]) => updateWhere(...args) };
      },
    }),
  },
}));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({ decrypt: (...args: any[]) => decrypt(...args) }));

const generateLipsync = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({ generateLipsync: (...args: any[]) => generateLipsync(...args) }));

const scheduleCallback = vi.fn();
vi.mock("@/lib/queue/qstash", () => ({ scheduleCallback: (...args: any[]) => scheduleCallback(...args) }));

const pollAndUpdateLipsync = vi.fn();
vi.mock("@/lib/audio/poll-lipsync", () => ({ pollAndUpdateLipsync: (...args: any[]) => pollAndUpdateLipsync(...args) }));

import { POST, GET } from "../route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/audio/lipsync", { method: "POST", body: JSON.stringify(body) });
}
function makeGetRequest(audioExportId: string) {
  return new Request(`http://localhost/api/audio/lipsync?audioExportId=${audioExportId}`);
}

describe("POST /api/audio/lipsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstAudioExports.mockResolvedValue({ id: "a1", projectId: "p1", audioUrl: "https://cdn/audio.mp3" });
    findFirstCharacters.mockResolvedValue({ id: "c1", projectId: "p1", portraitUrl: "https://cdn/portrait.png" });
    findFirstUsers.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted" });
    decrypt.mockReturnValue("real-key");
  });

  it("stores lipsyncJobId as requestId|pollingUrl (the real URL, not a guessed one) and schedules a QStash poll", async () => {
    generateLipsync.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    const res = await POST(makePostRequest({ audioExportId: "a1", characterId: "c1", projectId: "p1" }));

    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      lipsyncJobId: "req-1|https://api.segmind.com/v2/requests/req-1/status",
      lipsyncStatus: "processing",
    }));
    expect(scheduleCallback).toHaveBeenCalledWith(expect.objectContaining({
      body: { userId: "user-1", audioExportId: "a1", attempt: 0 },
    }));
  });

  it("does not schedule a poll when the job resolves synchronously", async () => {
    generateLipsync.mockResolvedValue({ mediaUrl: "https://cdn/final.mp4" });

    const res = await POST(makePostRequest({ audioExportId: "a1", characterId: "c1", projectId: "p1" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("completed");
    expect(scheduleCallback).not.toHaveBeenCalled();
  });
});

describe("GET /api/audio/lipsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstUsers.mockResolvedValue({ id: "user-1", segmindApiKey: "encrypted" });
    decrypt.mockReturnValue("real-key");
  });

  it("returns not_started when there's no job yet", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "", lipsyncJobId: "" });
    const res = await GET(makeGetRequest("a1"));
    const body = await res.json();
    expect(body.status).toBe("not_started");
    expect(pollAndUpdateLipsync).not.toHaveBeenCalled();
  });

  it("delegates to the shared poll helper rather than reconstructing a pollingUrl itself", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "req-1|https://real-url" });
    pollAndUpdateLipsync.mockResolvedValue({ outcome: "processing" });

    const res = await GET(makeGetRequest("a1"));

    expect(pollAndUpdateLipsync).toHaveBeenCalledWith({ audioExportId: "a1", segmindApiKey: "real-key" });
    const body = await res.json();
    expect(body.status).toBe("processing");
  });

  it("returns completed with the video URL", async () => {
    findFirstAudioExports.mockResolvedValue({ id: "a1", lipsyncStatus: "processing", lipsyncJobId: "req-1|https://real-url" });
    pollAndUpdateLipsync.mockResolvedValue({ outcome: "completed", videoUrl: "https://cdn/final.mp4" });

    const res = await GET(makeGetRequest("a1"));
    const body = await res.json();
    expect(body).toEqual({ status: "completed", videoUrl: "https://cdn/final.mp4" });
  });
});

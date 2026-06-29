import { describe, it, expect, vi, beforeEach } from "vitest";

const getRequiredSession = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: (...a: any[]) => getRequiredSession(...a) }));

const getUserTier = vi.fn();
vi.mock("@/lib/subscription", async (orig) => ({ ...(await orig() as any), getUserTier: (...a: any[]) => getUserTier(...a) }));

const findFirstUsers = vi.fn();
vi.mock("@/db", () => ({ db: { query: { users: { findFirst: (...a: any[]) => findFirstUsers(...a) } } } }));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({ decrypt: (...a: any[]) => decrypt(...a) }));

import { GET } from "../route";

function req(url = "http://localhost/api/capabilities") { return new Request(url); }

describe("GET /api/capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredSession.mockResolvedValue({ user: { id: "u1" } });
    getUserTier.mockResolvedValue("free");
    findFirstUsers.mockResolvedValue({ segmindApiKey: "enc", openaiApiKey: "" });
    decrypt.mockImplementation((v: string) => (v === "enc" ? "SG_key" : ""));
  });

  it("returns a stage→role grouped envelope reflecting the user's tier and keys", async () => {
    const res = await GET(req("http://localhost/api/capabilities?format=Novel"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Object.keys(body.envelope.stages).sort()).toEqual(["discover", "produce", "shape", "write"]);
    // hasSegmindKey true (decrypt → SG_key), hasOpenAIKey false → an openai cap is not available.
    const produceWriters = body.envelope.stages.produce.writer;
    const audio = produceWriters.find((c: any) => c.id === "audio_generate");
    if (audio) expect(audio.available).toBe(false); // openai key missing (and audio_novel gate on free)
  });

  it("401s without a session", async () => {
    getRequiredSession.mockRejectedValue(new Error("unauthenticated"));
    await expect(GET(req())).rejects.toThrow();
  });
});

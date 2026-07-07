// Regression test for the launch-blocking Audio Novel freeze bug (2026-06-20):
// the route looped TTS calls sequentially over every chapter segment with no
// `maxDuration` export, so a full chapter (many segments) could run past
// Vercel's default function timeout and get killed mid-run with no response
// ever reaching the client — a "Generate Audio" click that never resolves.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

const mocks = vi.hoisted(() => ({
  getRequiredSession: vi.fn(),
  checkAiRateLimit: vi.fn(),
  getUserTier: vi.fn(),
  findFirstProjects: vi.fn(),
  findFirstChapters: vi.fn(),
  findManyCharacters: vi.fn(),
  findFirstUsers: vi.fn(),
  decrypt: vi.fn(),
  insertReturning: vi.fn(),
  updateSet: vi.fn(),
  getTTSProvider: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: mocks.getRequiredSession }));
vi.mock("@/lib/ratelimit", () => ({ checkAiRateLimit: mocks.checkAiRateLimit }));
vi.mock("@/lib/subscription", () => ({ getUserTier: mocks.getUserTier }));
vi.mock("@/lib/crypto", () => ({ decrypt: mocks.decrypt }));
vi.mock("@/lib/audio/registry", () => ({ getTTSProvider: mocks.getTTSProvider }));
vi.mock("@/lib/audio/segment-chapter", () => ({
  parseChapterIntoSegments: () => [{ text: "Hello", voice: "fable", type: "narration" }],
}));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => mocks.findFirstProjects(...args) },
      chapters: { findFirst: (...args: any[]) => mocks.findFirstChapters(...args) },
      characters: { findMany: (...args: any[]) => mocks.findManyCharacters(...args) },
      users: { findFirst: (...args: any[]) => mocks.findFirstUsers(...args) },
    },
    insert: () => ({ values: () => ({ returning: (...args: any[]) => mocks.insertReturning(...args) }) }),
    update: () => ({ set: (vals: any) => { mocks.updateSet(vals); return { where: () => Promise.resolve(undefined) }; } }),
  },
}));

function makeFakeProvider(id: string, generate = vi.fn().mockResolvedValue(Buffer.from("audio"))) {
  return { id, name: id, description: "", requiresKey: true, voices: [], defaultVoiceId: "x", generate };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/audio/generate", { method: "POST", body: JSON.stringify(body) });
}

describe("audio generate route", () => {
  it("declares a maxDuration long enough for a multi-segment TTS loop", () => {
    const match = SOURCE.match(/export const maxDuration\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(300);
  });
});

describe("POST /api/audio/generate — provider selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.checkAiRateLimit.mockResolvedValue(null);
    mocks.getUserTier.mockResolvedValue("story_pro");
    mocks.findFirstProjects.mockResolvedValue({ id: "p1", userId: "user-1" });
    mocks.findFirstChapters.mockResolvedValue({ id: "c1", content: "Hello world" });
    mocks.findManyCharacters.mockResolvedValue([]);
    mocks.insertReturning.mockResolvedValue([{ id: "export-1" }]);
    mocks.put.mockResolvedValue({ url: "https://blob/export-1.mp3" });
  });

  it("defaults to the OpenAI provider and its own key when ttsProviderId is unset", async () => {
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "enc-openai", segmindApiKey: "enc-segmind", ttsProviderId: null });
    mocks.decrypt.mockImplementation((v: string) => v.replace("enc-", "real-"));
    const provider = makeFakeProvider("openai");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(mocks.getTTSProvider).toHaveBeenCalledWith("openai");
    expect(provider.generate).toHaveBeenCalledWith(expect.anything(), "real-openai");
    expect(res.status).toBe(200);
  });

  it("uses the Segmind key (not OpenAI's) when ttsProviderId is segmind_grok", async () => {
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "enc-openai", segmindApiKey: "enc-segmind", ttsProviderId: "segmind_grok" });
    mocks.decrypt.mockImplementation((v: string) => v.replace("enc-", "real-"));
    const provider = makeFakeProvider("segmind_grok");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(mocks.getTTSProvider).toHaveBeenCalledWith("segmind_grok");
    expect(provider.generate).toHaveBeenCalledWith(expect.anything(), "real-segmind");
  });

  it("400s with a Segmind-specific message when segmind_grok is selected but no Segmind key is set", async () => {
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "", segmindApiKey: "", ttsProviderId: "segmind_grok" });
    mocks.decrypt.mockReturnValue("");
    mocks.getTTSProvider.mockReturnValue(makeFakeProvider("segmind_grok"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Segmind/);
  });

  it("400s with an OpenAI-specific message when openai is selected but no key is set and no env fallback exists", async () => {
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "", segmindApiKey: "", ttsProviderId: "openai" });
    mocks.decrypt.mockReturnValue("");
    const originalEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    mocks.getTTSProvider.mockReturnValue(makeFakeProvider("openai"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/OpenAI/);
    if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
  });
});

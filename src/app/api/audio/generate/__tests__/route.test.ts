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
  concatAudioBuffers: vi.fn(),
  generatePodcastScript: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: mocks.getRequiredSession }));
vi.mock("@/lib/ratelimit", () => ({ checkAiRateLimit: mocks.checkAiRateLimit }));
vi.mock("@/lib/subscription", () => ({ getUserTier: mocks.getUserTier }));
vi.mock("@/lib/crypto", () => ({ decrypt: mocks.decrypt }));
vi.mock("@/lib/audio/registry", () => ({ getTTSProvider: mocks.getTTSProvider }));
vi.mock("@/lib/audio/segment-chapter", () => ({
  parseChapterIntoSegments: () => [{ text: "Hello", voice: "fable", type: "narration" }],
}));
vi.mock("@/lib/audio/concat-audio", () => ({
  concatAudioBuffers: (...args: any[]) => mocks.concatAudioBuffers(...args),
}));
vi.mock("@/lib/audio/podcast-script", () => ({
  generatePodcastScript: (...args: any[]) => mocks.generatePodcastScript(...args),
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
    mocks.concatAudioBuffers.mockResolvedValue(Buffer.from("combined-audio"));
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
  }, 20000); // per-test dynamic `import("../route")` + full-suite thread contention observed exceeding the 5s default (same class as preview-all/composite-panel's known-slow-under-load cases)

  it("uses the Segmind key (not OpenAI's) when ttsProviderId is segmind_grok", async () => {
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "enc-openai", segmindApiKey: "enc-segmind", ttsProviderId: "segmind_grok" });
    mocks.decrypt.mockImplementation((v: string) => v.replace("enc-", "real-"));
    const provider = makeFakeProvider("segmind_grok");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(mocks.getTTSProvider).toHaveBeenCalledWith("segmind_grok");
    expect(provider.generate).toHaveBeenCalledWith(expect.anything(), "real-segmind");
  }, 20000);

  it("400s with a Segmind-specific message when segmind_grok is selected but no Segmind key is set", async () => {
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "", segmindApiKey: "", ttsProviderId: "segmind_grok" });
    mocks.decrypt.mockReturnValue("");
    mocks.getTTSProvider.mockReturnValue(makeFakeProvider("segmind_grok"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Segmind/);
  }, 20000);

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
  }, 20000);
});

describe("POST /api/audio/generate — real audio concat (item 71, replaces Buffer.concat)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.checkAiRateLimit.mockResolvedValue(null);
    mocks.getUserTier.mockResolvedValue("story_pro");
    mocks.findFirstProjects.mockResolvedValue({ id: "p1", userId: "user-1", name: "Horizon Line" });
    mocks.findFirstChapters.mockResolvedValue({ id: "c1", content: "Hello world" });
    mocks.findManyCharacters.mockResolvedValue([]);
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "enc-openai", ttsProviderId: "openai" });
    mocks.decrypt.mockImplementation((v: string) => v.replace("enc-", "real-"));
    mocks.insertReturning.mockResolvedValue([{ id: "export-1" }]);
    mocks.put.mockResolvedValue({ url: "https://blob/export-1.mp3" });
    mocks.concatAudioBuffers.mockResolvedValue(Buffer.from("combined-audio"));
    mocks.getTTSProvider.mockReturnValue(makeFakeProvider("openai"));
  });

  it("stitches segments via concatAudioBuffers (real ffmpeg concat), not Buffer.concat", async () => {
    const { POST } = await import("../route");
    await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(mocks.concatAudioBuffers).toHaveBeenCalledTimes(1);
    const [buffers, opts] = mocks.concatAudioBuffers.mock.calls[0];
    expect(Array.isArray(buffers)).toBe(true);
    expect(opts).toEqual({ pauseMs: 150, normalize: true });

    const [, blobBuffer] = mocks.put.mock.calls[0];
    expect(blobBuffer).toEqual(Buffer.from("combined-audio"));
  }, 20000);
});

describe("POST /api/audio/generate — podcast mode (item 71)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.checkAiRateLimit.mockResolvedValue(null);
    mocks.getUserTier.mockResolvedValue("story_pro");
    mocks.findFirstProjects.mockResolvedValue({ id: "p1", userId: "user-1", name: "Horizon Line" });
    mocks.findFirstChapters.mockResolvedValue({ id: "c1", content: "Some chapter content." });
    mocks.findManyCharacters.mockResolvedValue([]);
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "enc-openai", ttsProviderId: "openai" });
    mocks.decrypt.mockImplementation((v: string) => v.replace("enc-", "real-"));
    mocks.insertReturning.mockResolvedValue([{ id: "export-1" }]);
    mocks.put.mockResolvedValue({ url: "https://blob/export-1.mp3" });
    mocks.concatAudioBuffers.mockResolvedValue(Buffer.from("combined-audio"));
  });

  it("generates a two-host script and uses two fixed voice IDs instead of per-character voices", async () => {
    mocks.generatePodcastScript.mockResolvedValue([
      { speaker: "A", text: "So this chapter opens strong." },
      { speaker: "B", text: "Right, the dome reveal." },
    ]);
    const provider = makeFakeProvider("openai");
    (provider as any).voices = [{ id: "host-a-voice", label: "A" }, { id: "host-b-voice", label: "B" }];
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1", mode: "podcast" }));

    expect(mocks.generatePodcastScript).toHaveBeenCalledWith("Some chapter content.", "Horizon Line");
    expect(provider.generate).toHaveBeenNthCalledWith(1, { text: "So this chapter opens strong.", voiceId: "host-a-voice", speed: 1.0 }, "real-openai");
    expect(provider.generate).toHaveBeenNthCalledWith(2, { text: "Right, the dome reveal.", voiceId: "host-b-voice", speed: 1.0 }, "real-openai");

    const [, opts] = mocks.concatAudioBuffers.mock.calls[0];
    expect(opts).toEqual({ pauseMs: 350, normalize: true }); // longer pause than narration mode

    const body = await res.json();
    expect(body.mode).toBe("podcast");
    expect(res.status).toBe(200);
  }, 20000);

  it("falls back to narration mode's default pauseMs and parseChapterIntoSegments when mode is omitted", async () => {
    mocks.getTTSProvider.mockReturnValue(makeFakeProvider("openai"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

    expect(mocks.generatePodcastScript).not.toHaveBeenCalled();
    const [, opts] = mocks.concatAudioBuffers.mock.calls[0];
    expect(opts.pauseMs).toBe(150);
    const body = await res.json();
    expect(body.mode).toBe("narration");
  }, 20000);

  it("marks the export failed and 500s when podcast script generation throws", async () => {
    mocks.generatePodcastScript.mockRejectedValue(new Error("Claude call failed"));
    mocks.getTTSProvider.mockReturnValue(makeFakeProvider("openai"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c1", mode: "podcast" }));

    expect(res.status).toBe(500);
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  }, 20000);
});

// ---------------------------------------------------------------------------
// Two-tenant regression coverage (Sprint 0 / v4 §3.1)
//
// The defect: project ownership WAS verified, but the chapter was then fetched
// with `eq(chapters.id, chapterId)` and no project scope. A caller who owned any
// project could pair their own projectId with a victim's chapterId and have that
// victim's prose synthesized into audio and returned — and because the speaker
// lookup resolves against projectId too, the foreign chapter was additionally
// narrated with the wrong project's cast.
//
// The fix scopes the chapter to the same verified project. These tests assert on
// the authorization input actually used, and — more importantly — on the TTS
// provider never being reached, since that call is where prose would leave.
// ---------------------------------------------------------------------------
describe("POST /api/audio/generate — chapter tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.checkAiRateLimit.mockResolvedValue(null);
    mocks.getUserTier.mockResolvedValue("story_pro");
    mocks.findFirstProjects.mockResolvedValue({ id: "p1", userId: "user-1" });
    mocks.findFirstUsers.mockResolvedValue({ id: "user-1", openaiApiKey: "enc-openai", ttsProviderId: "openai" });
    mocks.decrypt.mockImplementation((v: string) => v.replace("enc-", "real-"));
    mocks.findManyCharacters.mockResolvedValue([]);
    mocks.put.mockResolvedValue({ url: "https://blob/export-1.mp3" });
    mocks.concatAudioBuffers.mockResolvedValue(Buffer.from("combined-audio"));
    mocks.insertReturning.mockResolvedValue([{ id: "export-1" }]);
  });

  it("scopes the chapter lookup to the verified project, not to chapterId alone", async () => {
    // A chapter that genuinely belongs to the caller's own project still resolves.
    mocks.findFirstChapters.mockResolvedValue({ id: "c1", projectId: "p1", content: "my own words" });
    const provider = makeFakeProvider("openai");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    await POST(makeRequest({ projectId: "p1", chapterId: "c1" }));

// The authorization input must be a conjunction that includes the chapter's
    // project column — a bare `eq(chapters.id, chapterId)` would omit it.
    // Drizzle conditions are opaque builder trees, so walk them and pull out the
    // column/value pairs. A column reference exposes `.table` (keyed by the TS
    // field name) and `.name` (the SQL column name), so `chapters.projectId`
    // surfaces as "projectId.project_id".
    const parts: string[] = [];
    const walk = (n: any): void => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.table) {
        const key = Object.keys(n.table).find((k) => n.table[k] === n);
        parts.push(`${key}.${n.name}`);
        return;
      }
      if (n.constructor?.name === "StringChunk") return;
      if (n.value !== undefined) parts.push(`val:${String(n.value)}`);
      if (Array.isArray(n.queryChunks)) n.queryChunks.forEach(walk);
    };
    walk(mocks.findFirstChapters.mock.calls[0][0].where);

    expect(parts).toContain("projectId.project_id");
    expect(parts).toContain("val:p1");
  }, 20000);

  it("does not reach the TTS provider when the chapter belongs to another project", async () => {
    // A correctly scoped lookup returns nothing for a foreign chapterId.
    mocks.findFirstChapters.mockResolvedValue(undefined);
    const provider = makeFakeProvider("openai");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p1", chapterId: "c-victim" }));

    expect(res.status).toBe(400);
    // The decisive assertion: no prose was sent to any provider.
    expect(provider.generate).not.toHaveBeenCalled();
  }, 20000);

  it("never places a foreign chapter id or its content into any outbound call", async () => {
    mocks.findFirstChapters.mockResolvedValue(undefined);
    const provider = makeFakeProvider("openai");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    await POST(makeRequest({ projectId: "p1", chapterId: "c-victim" }));

    const outbound = JSON.stringify([
      ...provider.generate.mock.calls,
      ...mocks.put.mock.calls,
      ...mocks.generatePodcastScript.mock.calls,
    ]);
    expect(outbound).not.toContain("c-victim");
  }, 20000);

  it("404s before any chapter read when the project itself is not owned", async () => {
    mocks.findFirstProjects.mockResolvedValue(undefined);
    const provider = makeFakeProvider("openai");
    mocks.getTTSProvider.mockReturnValue(provider);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ projectId: "p-victim", chapterId: "c1" }));

    expect(res.status).toBe(404);
    // Ordering matters: an unowned project must short-circuit before the chapter
    // lookup, so no victim chapter id is even touched.
    expect(mocks.findFirstChapters).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
  }, 20000);
});

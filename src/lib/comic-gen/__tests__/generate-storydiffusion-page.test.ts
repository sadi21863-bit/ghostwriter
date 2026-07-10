import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const generateStoryDiffusion = vi.fn();
const pollJob = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateStoryDiffusion: (...args: any[]) => generateStoryDiffusion(...args),
  pollJob: (...args: any[]) => pollJob(...args),
}));

const cropFourPanelGrid = vi.fn();
vi.mock("../storydiffusion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../storydiffusion")>();
  return { ...actual, cropFourPanelGrid: (...args: any[]) => cropFourPanelGrid(...args) };
});

const originalFetch = global.fetch;

const { generateComicPageViaStoryDiffusion, STORYDIFFUSION_MAX_PANELS } = await import("../generate-storydiffusion-page");
const { ART_STYLES } = await import("@/lib/ai/panel-prompt-builder");

const ARTHUR_SPECS = [
  { beatIndex: 0, action: "Arthur boards the coaster", characters: ["Arthur"], location: "Platform", shotType: "Wide", mood: "tense" },
  { beatIndex: 1, action: "Arthur looks at the track ahead", characters: ["Arthur"], location: "Car 14", shotType: "Close-up", mood: "dread" },
  { beatIndex: 2, action: "The tunnel entrance looms", characters: [], location: "Tunnel", shotType: "Establishing", mood: "ominous" },
  { beatIndex: 3, action: "Arthur grips the safety bar", characters: ["Arthur"], location: "Car 14", shotType: "Close-up", mood: "fear" },
  { beatIndex: 4, action: "A fifth panel that should be dropped", characters: ["Arthur"], location: "Car 14", shotType: "Wide", mood: "calm" },
];

const CHARACTERS = [
  { id: "c1", name: "Arthur", appearance: "early forties, tired eyes", visualProfile: null, soulId: null, portraitUrl: "https://blob.example/arthur.jpg" },
];

describe("generateComicPageViaStoryDiffusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as any;
    cropFourPanelGrid.mockImplementation(async (_buf: Buffer, index: number) => Buffer.from(`panel-${index}`));
  });

  it("caps panels at STORYDIFFUSION_MAX_PANELS (4), dropping any beyond that", async () => {
    generateStoryDiffusion.mockResolvedValue({ mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async (_buf: Buffer, i: number) => `https://blob.example/panel-${i}.png`);

    const results = await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel,
    });

    expect(results).toHaveLength(STORYDIFFUSION_MAX_PANELS);
    expect(cropFourPanelGrid).toHaveBeenCalledTimes(4);
    // the 5th spec must never have been sent to the model at all
    const call = generateStoryDiffusion.mock.calls[0][0];
    expect(call.comicDescription).not.toContain("fifth panel that should be dropped");
  });

  it("resolves the media URL directly when the submission returns one synchronously (no polling needed)", async () => {
    generateStoryDiffusion.mockResolvedValue({ mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async () => "https://blob.example/x.png");

    await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel,
    });

    expect(pollJob).not.toHaveBeenCalled();
  });

  it("polls until COMPLETED when the submission returns a job instead of a direct media URL", async () => {
    generateStoryDiffusion.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://segmind.example/status" });
    pollJob
      .mockResolvedValueOnce({ status: "PROCESSING" })
      .mockResolvedValueOnce({ status: "COMPLETED", mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async () => "https://blob.example/x.png");

    const results = await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel, pollTimeoutMs: 20_000,
    });

    expect(pollJob).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(4);
  }, 15_000);

  it("throws when the poll reports FAILED, surfacing Segmind's real error text", async () => {
    generateStoryDiffusion.mockResolvedValue({ requestId: "req-1", pollingUrl: "https://segmind.example/status" });
    pollJob.mockResolvedValueOnce({ status: "FAILED", error: "OutputImageSensitiveContentDetected" });
    const uploadPanel = vi.fn();

    await expect(generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel, pollTimeoutMs: 20_000,
    })).rejects.toThrow(/OutputImageSensitiveContentDetected/);
    expect(uploadPanel).not.toHaveBeenCalled();
  }, 15_000);

  it("binds the character description to the first named character across specs (StoryDiffusion's one-identity model)", async () => {
    generateStoryDiffusion.mockResolvedValue({ mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async () => "https://blob.example/x.png");

    await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel,
    });

    const call = generateStoryDiffusion.mock.calls[0][0];
    expect(call.characterDescription).toContain("Arthur");
    expect(call.characterDescription).toContain("tired eyes");
  });

  it("passes a plain portraitUrl as refImage but never a soulId (StoryDiffusion's ref_image is a URL field, not a Higgsfield custom_reference_id)", async () => {
    generateStoryDiffusion.mockResolvedValue({ mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async () => "https://blob.example/x.png");
    const withSoulId = [{ ...CHARACTERS[0], soulId: "soul-uuid-1", portraitUrl: "https://blob.example/arthur.jpg" }];

    await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: withSoulId, artStyle: ART_STYLES[0], uploadPanel,
    });

    const call = generateStoryDiffusion.mock.calls[0][0];
    expect(call.refImage).toBeUndefined();
  });

  it("falls back to a generic character description when no spec names a character at all", async () => {
    generateStoryDiffusion.mockResolvedValue({ mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async () => "https://blob.example/x.png");
    const noCharSpecs = ARTHUR_SPECS.map(s => ({ ...s, characters: [] }));

    await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: noCharSpecs as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel,
    });

    const call = generateStoryDiffusion.mock.calls[0][0];
    expect(call.characterDescription).toBe("No recurring named character in this sequence.");
  });

  it("uses 'Four Pannel' comic style unconditionally, since that's the only layout cropFourPanelGrid can safely crop", async () => {
    generateStoryDiffusion.mockResolvedValue({ mediaUrl: "https://segmind.example/page.png" });
    const uploadPanel = vi.fn(async () => "https://blob.example/x.png");

    await generateComicPageViaStoryDiffusion({
      apiKey: "key", specs: ARTHUR_SPECS as any, characters: CHARACTERS, artStyle: ART_STYLES[0], uploadPanel,
    });

    expect(generateStoryDiffusion.mock.calls[0][0].comicStyle).toBe("Four Pannel");
  });
});

afterAll(() => { global.fetch = originalFetch; });

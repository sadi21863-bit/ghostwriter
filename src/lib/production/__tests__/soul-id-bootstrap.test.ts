import { describe, it, expect, vi, beforeEach } from "vitest";

const generateSoulImage = vi.fn();
const trainSoulId = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateSoulImage: (...args: any[]) => generateSoulImage(...args),
  trainSoulId: (...args: any[]) => trainSoulId(...args),
}));

const { bootstrapAndTrainSoulId } = await import("../soul-id-bootstrap");

const BASE_PARAMS = {
  characterName: "Arthur",
  soulIdPrompt: "A gaunt man in his mid-forties with dark jaw-length hair, deep-set grey-green eyes, a collapsed charcoal wool suit.",
  segmindApiKey: "segmind-key",
  higgsfieldApiKey: "hf-key",
  higgsfieldApiSecret: "hf-secret",
};

describe("bootstrapAndTrainSoulId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates 3 reference images then trains a real Soul ID, returning the job id", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/ref-1.png")
      .mockResolvedValueOnce("https://blob.example/ref-2.png")
      .mockResolvedValueOnce("https://blob.example/ref-3.png");
    trainSoulId.mockResolvedValue({ jobId: "job-123" });

    const jobId = await bootstrapAndTrainSoulId(BASE_PARAMS);

    expect(generateSoulImage).toHaveBeenCalledTimes(3);
    expect(trainSoulId).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "hf-key", apiSecret: "hf-secret", characterName: "Arthur",
      referenceImageUrls: ["https://blob.example/ref-1.png", "https://blob.example/ref-2.png", "https://blob.example/ref-3.png"],
    }));
    expect(jobId).toBe("job-123");
  });

  it("returns null without calling trainSoulId when any required key is missing", async () => {
    const jobId = await bootstrapAndTrainSoulId({ ...BASE_PARAMS, higgsfieldApiSecret: "" });
    expect(generateSoulImage).not.toHaveBeenCalled();
    expect(trainSoulId).not.toHaveBeenCalled();
    expect(jobId).toBeNull();
  });

  it("returns null when soulIdPrompt is empty", async () => {
    const jobId = await bootstrapAndTrainSoulId({ ...BASE_PARAMS, soulIdPrompt: "" });
    expect(generateSoulImage).not.toHaveBeenCalled();
    expect(jobId).toBeNull();
  });

  it("fails open (returns null, does not throw) when a reference image generation fails, as long as 3 still succeed via retries not needed - fewer than 3 successes skips training", async () => {
    generateSoulImage
      .mockRejectedValueOnce(new Error("503 overloaded"))
      .mockResolvedValueOnce("https://blob.example/ref-2.png")
      .mockResolvedValueOnce("https://blob.example/ref-3.png");

    const jobId = await bootstrapAndTrainSoulId(BASE_PARAMS);

    expect(trainSoulId).not.toHaveBeenCalled();
    expect(jobId).toBeNull();
  });

  it("fails open (returns null, does not throw) when trainSoulId itself throws", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/ref-1.png")
      .mockResolvedValueOnce("https://blob.example/ref-2.png")
      .mockResolvedValueOnce("https://blob.example/ref-3.png");
    trainSoulId.mockRejectedValue(new Error("Soul ID training failed (500): ..."));

    const jobId = await bootstrapAndTrainSoulId(BASE_PARAMS);
    expect(jobId).toBeNull();
  });
});

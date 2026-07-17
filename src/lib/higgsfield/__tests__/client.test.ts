import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.mock("undici", () => ({
  fetch: (...args: any[]) => fetchMock(...args),
  Agent: class {},
}));

const isCircuitOpen = vi.fn().mockResolvedValue(false);
const recordProviderFailure = vi.fn().mockResolvedValue(undefined);
const recordProviderSuccess = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/circuit-breaker", () => ({
  isCircuitOpen: (...args: any[]) => isCircuitOpen(...args),
  recordProviderFailure: (...args: any[]) => recordProviderFailure(...args),
  recordProviderSuccess: (...args: any[]) => recordProviderSuccess(...args),
}));

function jsonResponse(body: any, opts: { ok?: boolean; status?: number } = {}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

import { generateTextVideo, pollJob } from "../client";

describe("generateTextVideo — Seedance 2.0 reference_images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(jsonResponse({ request_id: "req-1", status_url: "https://api.segmind.com/v2/requests/req-1/status" }));
  });

  it("sends reference_images on the seedance request body when provided", async () => {
    await generateTextVideo({
      apiKey: "key",
      model: "seedance",
      prompt: "a scene",
      referenceImages: ["https://example.com/mara.png", "https://example.com/kessler.png"],
    });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.reference_images).toEqual(["https://example.com/mara.png", "https://example.com/kessler.png"]);
  });

  it("omits reference_images entirely when none are provided", async () => {
    await generateTextVideo({ apiKey: "key", model: "seedance", prompt: "a scene" });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.reference_images).toBeUndefined();
  });

  it("uses multiShotPrompt as the request prompt when provided, ignoring prompt", async () => {
    await generateTextVideo({
      apiKey: "key",
      model: "seedance",
      prompt: "ignored single-shot prompt",
      multiShotPrompt: "Shot 1: @image1 enters. Shot 2: @image1 turns.",
    });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.prompt).toBe("Shot 1: @image1 enters. Shot 2: @image1 turns.");
  });
});

describe("generateTextVideo — Wan 2.7 R2V (item 70)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(jsonResponse({ request_id: "req-1", status_url: "https://api.segmind.com/v2/requests/req-1/status" }));
  });

  it("hits the wan2.7-r2v endpoint with reference_images and uppercase resolution", async () => {
    await generateTextVideo({
      apiKey: "key",
      model: "wan-r2v",
      prompt: "he stands at the gate",
      referenceImages: ["https://example.com/young-man.png"],
      resolution: "1080p",
    });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("wan2.7-r2v");
    const body = JSON.parse(opts.body);
    expect(body.reference_images).toEqual(["https://example.com/young-man.png"]);
    expect(body.resolution).toBe("1080P");
  });

  it("defaults resolution to 720P when not specified", async () => {
    await generateTextVideo({
      apiKey: "key",
      model: "wan-r2v",
      prompt: "he stands at the gate",
      referenceImages: ["https://example.com/young-man.png"],
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body).resolution).toBe("720P");
  });

  it("throws before any request when no reference image is provided", async () => {
    await expect(generateTextVideo({
      apiKey: "key",
      model: "wan-r2v",
      prompt: "he stands at the gate",
    })).rejects.toThrow(/reference image/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pollJob — Seedance 2.0 v2 result shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Real Segmind v2 response, captured live: the status endpoint has no
  // `output` at all (just confirms status + gives `response_url`); the
  // result endpoint's `output` is a plain URL STRING, not an object with
  // media_url/image_url/video_url sub-fields as every other code path here
  // assumed. There's also a `video.url` field carrying the same URL.
  it("resolves mediaUrl when the result endpoint's `output` is a plain URL string", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        request_id: "req-1",
        status: "COMPLETED",
        response_url: "https://api.segmind.com/v2/requests/req-1",
        status_url: "https://api.segmind.com/v2/requests/req-1/status",
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: "COMPLETED",
        output: "https://segmind-inference-io.s3.amazonaws.com/c4dcb-output.mp4",
        video: { url: "https://segmind-inference-io.s3.amazonaws.com/c4dcb-output.mp4", content_type: "video/mp4" },
      }));

    const result = await pollJob({ apiKey: "key", pollingUrl: "https://api.segmind.com/v2/requests/req-1/status" });

    expect(result).toEqual({ status: "COMPLETED", mediaUrl: "https://segmind-inference-io.s3.amazonaws.com/c4dcb-output.mp4" });
  });

  it("still resolves mediaUrl from the older object-shaped output.video_url, unchanged", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: "COMPLETED",
      output: { video_url: "https://example.com/older-shape.mp4" },
    }));

    const result = await pollJob({ apiKey: "key", pollingUrl: "https://api.segmind.com/v2/requests/req-2/status" });

    expect(result).toEqual({ status: "COMPLETED", mediaUrl: "https://example.com/older-shape.mp4" });
  });
});

describe("fetchWithTimeout — circuit breaker integration (item 71/72)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws immediately without calling fetch at all when the circuit is open for the target provider", async () => {
    isCircuitOpen.mockResolvedValue(true);

    await expect(generateTextVideo({ apiKey: "key", model: "seedance", prompt: "a scene" }))
      .rejects.toThrow(/temporarily unavailable/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the circuit for the correct provider key derived from the URL (segmind.com -> 'segmind')", async () => {
    isCircuitOpen.mockResolvedValue(false);
    fetchMock.mockResolvedValue(jsonResponse({ request_id: "req-1", status_url: "https://api.segmind.com/v2/requests/req-1/status" }));

    await generateTextVideo({ apiKey: "key", model: "seedance", prompt: "a scene" });

    expect(isCircuitOpen).toHaveBeenCalledWith("segmind");
  });

  it("records a provider success after a completed fetch, even if the HTTP status itself is an error (a clean 4xx/5xx is still a successful round-trip)", async () => {
    isCircuitOpen.mockResolvedValue(false);
    fetchMock.mockResolvedValue(jsonResponse({ error: "bad request" }, { ok: false, status: 400 }));

    await expect(generateTextVideo({ apiKey: "key", model: "seedance", prompt: "a scene" })).rejects.toThrow();

    expect(recordProviderSuccess).toHaveBeenCalledWith("segmind");
    expect(recordProviderFailure).not.toHaveBeenCalled();
  });

  it("records a provider failure when the underlying fetch itself throws (real network-level failure)", async () => {
    isCircuitOpen.mockResolvedValue(false);
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(generateTextVideo({ apiKey: "key", model: "seedance", prompt: "a scene" })).rejects.toThrow("ECONNREFUSED");

    expect(recordProviderFailure).toHaveBeenCalledWith("segmind");
    expect(recordProviderSuccess).not.toHaveBeenCalled();
  });
});

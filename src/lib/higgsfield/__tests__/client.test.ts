import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.mock("undici", () => ({
  fetch: (...args: any[]) => fetchMock(...args),
  Agent: class {},
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

import { generateTextVideo } from "../client";

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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SegmindGrokTTSProvider } from "../adapters/segmind-grok-tts";

const realFetch = global.fetch;

describe("SegmindGrokTTSProvider.generate", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("sends the real request shape (text, voice_id, language, codec, speed) to v1/grok-tts", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => "audio/mpeg" },
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    await SegmindGrokTTSProvider.generate({ text: "Hello world", voiceId: "eve", speed: 1 }, "my-key");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.segmind.com/v1/grok-tts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "my-key" }),
      })
    );
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body).toEqual({ text: "Hello world", voice_id: "eve", language: "en", codec: "mp3", speed: 1 });
  });

  it("returns a Buffer of the audio bytes on a successful audio/* response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => "audio/mpeg" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    const result = await SegmindGrokTTSProvider.generate({ text: "Hi", voiceId: "eve" }, "key");
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("throws with the response body when the API returns a non-audio/error response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 406,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ detail: "Insufficient credits" }),
    });

    await expect(SegmindGrokTTSProvider.generate({ text: "Hi", voiceId: "eve" }, "key"))
      .rejects.toThrow(/406/);
  });
});

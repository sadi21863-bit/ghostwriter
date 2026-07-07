import { describe, it, expect, vi } from "vitest";

const speechCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    audio = { speech: { create: (...args: any[]) => speechCreate(...args) } };
  },
}));

import { OpenAITTSProvider } from "../adapters/openai-tts";

describe("OpenAITTSProvider.generate", () => {
  it("calls tts-1 with the given voice/text/speed and returns a Buffer", async () => {
    speechCreate.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer });

    const result = await OpenAITTSProvider.generate({ text: "Hi there", voiceId: "nova", speed: 1.0 }, "sk-test");

    expect(speechCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "tts-1", voice: "nova", input: "Hi there", speed: 1.0,
    }));
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(Array.from(result)).toEqual([9, 8, 7]);
  });

  it("has the expected 6 voices with fable as default (unchanged from before the refactor)", () => {
    expect(OpenAITTSProvider.voices.map(v => v.id).sort()).toEqual(["alloy", "echo", "fable", "nova", "onyx", "shimmer"]);
    expect(OpenAITTSProvider.defaultVoiceId).toBe("fable");
  });
});

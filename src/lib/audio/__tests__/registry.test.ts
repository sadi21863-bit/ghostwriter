import { describe, it, expect } from "vitest";
import { getTTSProvider, isValidVoiceForProvider, TTS_PROVIDERS } from "../registry";
import { OpenAITTSProvider } from "../adapters/openai-tts";
import { SegmindGrokTTSProvider } from "../adapters/segmind-grok-tts";

describe("getTTSProvider", () => {
  it("returns the OpenAI provider by id", () => {
    expect(getTTSProvider("openai")).toBe(OpenAITTSProvider);
  });

  it("returns the Segmind Grok provider by id", () => {
    expect(getTTSProvider("segmind_grok")).toBe(SegmindGrokTTSProvider);
  });

  it("falls back to OpenAI for an unknown id", () => {
    expect(getTTSProvider("bogus_provider")).toBe(OpenAITTSProvider);
  });

  it("lists exactly the 2 known providers", () => {
    expect(TTS_PROVIDERS.map(p => p.id).sort()).toEqual(["openai", "segmind_grok"]);
  });
});

describe("isValidVoiceForProvider", () => {
  it("accepts a voiceId that belongs to the given provider", () => {
    expect(isValidVoiceForProvider(OpenAITTSProvider, "nova")).toBe(true);
    expect(isValidVoiceForProvider(SegmindGrokTTSProvider, "rex")).toBe(true);
  });

  it("rejects a voiceId from a different provider's set", () => {
    expect(isValidVoiceForProvider(SegmindGrokTTSProvider, "nova")).toBe(false);
    expect(isValidVoiceForProvider(OpenAITTSProvider, "rex")).toBe(false);
  });

  it("rejects null/undefined/empty voiceId", () => {
    expect(isValidVoiceForProvider(OpenAITTSProvider, null)).toBe(false);
    expect(isValidVoiceForProvider(OpenAITTSProvider, undefined)).toBe(false);
    expect(isValidVoiceForProvider(OpenAITTSProvider, "")).toBe(false);
  });
});

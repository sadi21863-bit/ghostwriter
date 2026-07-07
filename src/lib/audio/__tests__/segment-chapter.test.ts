import { describe, it, expect } from "vitest";
import { parseChapterIntoSegments } from "../segment-chapter";
import { OpenAITTSProvider } from "../adapters/openai-tts";
import { SegmindGrokTTSProvider } from "../adapters/segmind-grok-tts";

describe("parseChapterIntoSegments", () => {
  it("assigns the provider's default voice to narration", () => {
    const segments = parseChapterIntoSegments("The room was silent.", [], OpenAITTSProvider);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: "narration", voice: "fable" });
  });

  it("assigns a matching character's own voiceId to their dialogue", () => {
    const content = 'Mara looked up. "I did it," Mara said.';
    const chars = [{ name: "Mara", voiceId: "nova" }];
    const segments = parseChapterIntoSegments(content, chars, OpenAITTSProvider);
    const dialogue = segments.find(s => s.type === "dialogue");
    expect(dialogue).toMatchObject({ voice: "nova", characterName: "Mara" });
  });

  it("falls back to the provider's default voice when no speaker is found", () => {
    const content = '"Hello there."';
    const segments = parseChapterIntoSegments(content, [], OpenAITTSProvider);
    expect(segments[0].voice).toBe("fable");
  });

  it("falls back to the provider's default voice when the stored voiceId doesn't belong to the current provider (cross-provider mismatch)", () => {
    // Mara's voiceId was assigned under OpenAI ("nova") but the account is
    // currently on Segmind Grok TTS, which has no "nova" voice.
    const content = 'Mara looked up. "I did it," Mara said.';
    const chars = [{ name: "Mara", voiceId: "nova" }];
    const segments = parseChapterIntoSegments(content, chars, SegmindGrokTTSProvider);
    const dialogue = segments.find(s => s.type === "dialogue");
    expect(dialogue!.voice).toBe("eve"); // Grok's defaultVoiceId
  });

  it("uses the Segmind Grok provider's own default for narration", () => {
    const segments = parseChapterIntoSegments("The room was silent.", [], SegmindGrokTTSProvider);
    expect(segments[0].voice).toBe("eve");
  });
});

import type { TTSProvider } from "./providers";
import { isValidVoiceForProvider } from "./registry";

export interface Segment {
  text: string;
  voice: string;
  type: "narration" | "dialogue";
  characterName?: string;
}

// Splits chapter prose into narration/dialogue segments, assigning each a
// provider-valid voice. A character's stored voiceId may have been assigned
// under a DIFFERENT provider (e.g. an OpenAI voice name while the account is
// now set to Segmind Grok TTS) — isValidVoiceForProvider() catches that and
// falls back to the provider's own default rather than sending an invalid
// voice_id to the API.
export function parseChapterIntoSegments(
  content: string,
  chars: Array<{ name: string; voiceId: string | null }>,
  provider: TTSProvider
): Segment[] {
  const segments: Segment[] = [];
  const parts = content.split(/("(?:[^"\\]|\\.)*")/g);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.trim()) continue;

    if (part.startsWith('"') && part.endsWith('"')) {
      const precedingText = parts[i - 1] || "";
      const followingText = parts[i + 1] || "";
      const speaker = findSpeaker(precedingText, followingText, chars);
      const voice = (speaker && isValidVoiceForProvider(provider, speaker.voiceId))
        ? speaker.voiceId
        : provider.defaultVoiceId;

      segments.push({
        text: part.slice(1, -1),
        voice,
        type: "dialogue",
        characterName: speaker?.name,
      });
    } else {
      const trimmed = part.trim();
      if (trimmed) {
        segments.push({
          text: trimmed,
          voice: provider.defaultVoiceId,
          type: "narration",
        });
      }
    }
  }

  return segments;
}

function findSpeaker(
  before: string,
  after: string,
  chars: Array<{ name: string; voiceId: string | null }>
): { name: string; voiceId: string } | null {
  const context = (before + " " + after).toLowerCase();
  for (const char of chars) {
    if (char.voiceId && context.includes(char.name.toLowerCase())) {
      return { name: char.name, voiceId: char.voiceId };
    }
  }
  return null;
}

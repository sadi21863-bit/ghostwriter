import { OpenAITTSProvider } from "./adapters/openai-tts";
import { SegmindGrokTTSProvider } from "./adapters/segmind-grok-tts";
import type { TTSProvider } from "./providers";

export const TTS_PROVIDERS: TTSProvider[] = [OpenAITTSProvider, SegmindGrokTTSProvider];

export const getTTSProvider = (id: string): TTSProvider =>
  TTS_PROVIDERS.find(p => p.id === id) ?? OpenAITTSProvider;

/** True if voiceId belongs to this provider's own voice set — used to fall back
 *  safely when a character's stored voiceId was assigned under a different
 *  provider (e.g. an OpenAI voice name after switching to Segmind Grok TTS). */
export function isValidVoiceForProvider(provider: TTSProvider, voiceId: string | null | undefined): boolean {
  return !!voiceId && provider.voices.some(v => v.id === voiceId);
}

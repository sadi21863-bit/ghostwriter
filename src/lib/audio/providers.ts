export interface TTSVoice { id: string; label: string; }

export interface TTSGenerationParams {
  text: string;
  voiceId: string;
  speed?: number;
}

export interface TTSProvider {
  id: string; name: string; description: string; requiresKey: boolean;
  voices: TTSVoice[];
  defaultVoiceId: string;
  /** Returns raw audio bytes (mp3) — callers concatenate segments themselves. */
  generate(params: TTSGenerationParams, apiKey: string): Promise<Buffer>;
}

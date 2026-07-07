import OpenAI from "openai";
import type { TTSProvider } from "../providers";

export const OpenAITTSProvider: TTSProvider = {
  id: "openai", name: "OpenAI TTS-1",
  description: "Mature, proven narration voices. $0.015/1K characters. Requires an OpenAI API key.",
  requiresKey: true,
  voices: [
    { id: "alloy", label: "Alloy — neutral, balanced" },
    { id: "echo", label: "Echo — warm, conversational" },
    { id: "fable", label: "Fable — expressive, storytelling" },
    { id: "onyx", label: "Onyx — deep, authoritative" },
    { id: "nova", label: "Nova — bright, energetic" },
    { id: "shimmer", label: "Shimmer — clear, precise" },
  ],
  defaultVoiceId: "fable",
  async generate(params, apiKey) {
    const openai = new OpenAI({ apiKey });
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: params.voiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: params.text,
      speed: params.speed ?? 1.0,
    });
    return Buffer.from(await response.arrayBuffer());
  },
};

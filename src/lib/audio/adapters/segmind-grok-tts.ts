import type { TTSProvider } from "../providers";

// Real contract verified live against Segmind's own API docs page
// (segmind.com/models/grok-tts/api, 2026-07-07) — not guessed. POST v1/grok-tts
// returns raw audio bytes synchronously (Content-Type audio/*) for a normal-length
// segment; a non-2xx response returns JSON with a "detail"/error message instead.
export const SegmindGrokTTSProvider: TTSProvider = {
  id: "segmind_grok", name: "Segmind (Grok TTS)",
  description: "Uses your existing Segmind key — no separate API key needed. $0.01875/1K characters.",
  requiresKey: true,
  voices: [
    { id: "ara", label: "Ara" },
    { id: "eve", label: "Eve — general narration, demos" },
    { id: "leo", label: "Leo" },
    { id: "rex", label: "Rex — authoritative, business tone" },
    { id: "sal", label: "Sal" },
  ],
  defaultVoiceId: "eve",
  async generate(params, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let res: Response;
    try {
      res = await fetch("https://api.segmind.com/v1/grok-tts", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: params.text,
          voice_id: params.voiceId,
          language: "en",
          codec: "mp3",
          speed: params.speed ?? 1,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.startsWith("audio/")) {
      return Buffer.from(await res.arrayBuffer());
    }

    const errBody = await res.text();
    throw new Error(`Grok TTS failed (${res.status}): ${errBody}`);
  },
};

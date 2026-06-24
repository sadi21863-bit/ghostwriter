# Lipsync — final findings

## What's fixed (real, confirmed bugs)
1. The original implementation invented a `higgsfield-wan-text2video` + `audio_url`/`talking_head` contract that doesn't exist on Segmind (`404 "Model information not found"`).
2. Replaced with the real single-step model: **`hallo`** (`input_image` + `input_audio` → talking-head video), confirmed via Segmind's own docs. No multi-step pipeline needed at all — an earlier interim fix (animate portrait → separately lipsync the clip) was real but unnecessarily complex; `hallo` does both in one call.
3. Along the way, found and fixed a separate, generally-applicable bug: Node's built-in `fetch` (undici) enforces its own internal `headersTimeout`/`bodyTimeout` (~5 min) **independently of any AbortController signal** passed to it — every long-running Segmind call in this client was silently capped at ~5 minutes no matter what timeout value we passed. Fixed by switching to the `undici` package's own `fetch` + `Agent` (imported directly, not Node's global fetch) with both timeouts disabled, so our own AbortController-based timeout is the only one that applies.

## The remaining limit (not fixable from our side)
Tested against a **164-second full-chapter** narration clip — once our own timeout layers were no longer the bottleneck, the request reached Segmind's infrastructure and ran until **Segmind's own nginx gateway returned a `504 Gateway Time-out`**. That's their reverse-proxy's own ceiling on a single long-running synchronous request, not something a client-side fix can address.

## Practical implication
- Lipsync is correctly implemented and works for normal-length segments (a single line of dialogue, a short paragraph) — this matches how Audio Novel's TTS already segments narration vs. dialogue internally.
- Full-chapter-length lipsync in one call hits a real provider-side scaling wall. Supporting it properly would mean chunking the source audio into multiple shorter segments and generating separate clips per chunk (no `ffmpeg` available in this environment to merge them into one continuous file) — scoped as a follow-up, not pursued further tonight per spend/time discipline.

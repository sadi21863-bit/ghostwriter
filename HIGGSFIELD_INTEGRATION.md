# Higgsfield Integration — Analysis & Improvements

## What Higgsfield is (2026)
Higgsfield AI is a cinematic media-generation platform. Capabilities relevant here:
- **Soul / Soul 2** image model (photoreal, style presets).
- **Image-to-video (DoP)** — animate a still frame; tiers `dop-lite`, `dop-turbo`, `dop-preview`.
- **Text-to-video** via a model zoo (Kling, Veo, Sora, Seedance, WAN, Hailuo…).
- **Camera motion** — 100+ presets (dolly, crane, orbit, dolly-zoom) + `camera_fixed`.
- **Character consistency** — **Soul ID** (define a character from references and reuse identity) and multi-image input (up to ~9 refs).

## How it's wired in GhostWriter (story-side visuals)
- `src/lib/higgsfield/client.ts` — the API client. **Image + video go through the Segmind proxy** (`api.segmind.com/v1`); **Soul ID training uses Higgsfield's native cloud** (`cloud.higgsfield.ai/v1`).
- `src/lib/higgsfield/models.ts` — single source of truth for video models (Kling/Veo/Seedance/WAN/Hailuo; Sora deprecated) + `MODE_TO_MODEL` (genre → best model).
- `src/lib/higgsfield/presets.ts` — camera + viral preset catalogs (injected into the prompt).
- Consumers: character **portraits** & **Soul ID** (`/characters/.../portrait`, `/soul-id`), **Comic Studio** (panel gen/regen), **Production Studio** (scene→shot→preview/animate/generate-video, lipsync), export.
- **Auth:** `decrypt(user.higgsfieldApiKey) || process.env.HIGGSFIELD_API_KEY`. NOTE: no key is set in the current env, so generation is inert until a user adds their key in Settings (can't be live-tested here).

## Problems found
1. **Fragile polling (highest risk).** `pollJob` returned `data.status` verbatim and read the media URL from only `output.media_url[0]` / `output.image_url`. Segmind/Higgsfield report status with varied casing/vocabulary (`success`, `done`, `in_queue`, `running`) and put URLs under different keys (`video_url`, `url`, `images[].url`, `outputs[]`). Any mismatch made a finished video **silently fail** or stall.
2. **No retry on transient provider hiccups** during polling (async providers 429/5xx intermittently).
3. **"Completed but no URL yet"** race wasn't handled — could resolve as success with an empty URL.
4. **Missing `polling_url` fallback** for text-video & lipsync (DoP had one; the others didn't).
5. **Cost:** image-to-video defaulted to **`dop-turbo` (~$0.42/5s)** even for previews, when **`dop-lite` (~$0.14/5s)** is ~3× cheaper.

## Improvements shipped (in `client.ts`, build-verified)
- **Status normalization** — `normalizeStatus()` maps all known provider vocab → `JobStatus`.
- **Robust URL extraction** — `extractMediaUrl()` checks `media_url / video_url / image_url / url / images[].url / outputs[]` as string or array, on both `data` and `data.output`.
- **Safe single retry** on polling (GET is idempotent) for 429/5xx and network errors.
- **Completed-without-URL → keep polling** (prevents empty-success).
- **`polling_url` fallbacks** added to text-video & lipsync (consistent with DoP).
- **Cost-smart default:** image-to-video now defaults to **`dop-lite`** (previews stay cheap; callers pass `dop-turbo`/`dop-preview` for final renders). Generation POSTs are intentionally **not** auto-retried (avoids double-charging / duplicate jobs).

## Recommended next (needs a live key to validate)
- **Soul 2 upgrade:** the image endpoint is `higgsfield-text2image-soul` (Soul 1). Soul 2 is newer and cheaper (~0.12 vs 0.25 credits/img). Confirm the exact Segmind endpoint id, then switch + A/B.
- **Structured camera controls:** pass `camera_fixed` and motion params as real fields where the proxy supports them, instead of prompt-injection only.
- **Webhooks over polling:** if Segmind supports callbacks, replace polling loops to cut latency and request volume.
- **Per-tier render quality routing:** previews → `dop-lite`/Seedance; final exports → `dop-preview`/Veo, mirroring the app's existing model-tier cost strategy.

# Video and Media Generation

How Higgsfield, Segmind, and the video pipeline actually work — corrected 2026-06-24/25 after a real-money pipeline test found this doc had drifted significantly from the shipped code (wrong function names, a lipsync contract that 404'd, model params that didn't match any real Segmind schema). Full incident report: `docs/2026-06-24-segmind-higgsfield-pipeline-test.md`.

---

## Provider Architecture

| Provider | Used for | Integration |
|---|---|---|
| **Segmind** | Soul 2.0 image generation, image-to-video (DoP), all 7 text-to-video models, lipsync | Proxy API at `api.segmind.com` — `x-api-key` header |
| **Higgsfield** | Soul ID training only | Native platform API at `platform.higgsfield.ai` — `hf-api-key`/`hf-secret` headers |
| **OpenAI** | Embeddings (`text-embedding-3-small`) + Audio Novel TTS (`tts-1`) | NOT used for image, video, or text generation |

**Almost everything is Segmind, not Higgsfield.** Despite the file being named `src/lib/higgsfield/client.ts`, only Soul ID *training* (`trainSoulId`/`pollSoulIdTraining`) actually calls Higgsfield's own API. Image generation, image-to-video, every text-to-video model, and lipsync all route through Segmind's proxy — which happens to host several Higgsfield-branded models (`higgsfield-text2image-soul`, `higgsfield-image2video`) alongside third-party ones (Kling, Veo, Seedance, Wan, Hailuo, Hallo, Pixverse).

**BYOK, no fallback**: image/video generation requires the user's own `segmindApiKey` (encrypted in `users` table). There is no app-level Segmind key fallback — if a user hasn't added their own key, every generation route 400s with a clear "Add your Segmind API key in Settings" message.

---

## Sync (v1) vs. Async (v2) — read this before adding any new Segmind call

Segmind has two endpoint versions per model:
- **`v1` (`api.segmind.com/v1/{model}`)**: synchronous. The HTTP response doesn't come back until the media is fully generated, returned as **raw binary bytes** (not JSON). Segmind's own docs say v1 is for things that "typically complete within 60 seconds."
- **`v2` (`api.segmind.com/v2/{model}`)**: asynchronous. Returns `{request_id, status_url, ...}` immediately; poll `status_url` until `COMPLETED`/`FAILED`.

**Every model in this client was originally wired to v1**, including video models that routinely take well over 60 seconds. This caused real, repeated multi-minute timeouts across three different models (DoP/`image2video`, Hallo, Kling) in production testing. `generateTextVideo` has since been switched to v2 (see below) — **`generateDoPVideo`, `generateLipsync`, and `generateSoulImage` are still on v1** and still vulnerable to the same latency pattern. Switching them to v2 is the natural next fix if they show the same symptom.

### Binary-vs-JSON response handling

Because v1 endpoints return raw bytes, every v1 call goes through `resolveMediaResponse(res, kind, blobPathPrefix)` (`src/lib/higgsfield/client.ts`), which:
1. Checks `Content-Type` — if it starts with `image/` or `video/`, reads the bytes and uploads them to Vercel Blob itself (or falls back to a `data:` URL if `BLOB_READ_WRITE_TOKEN` isn't set), returning `{ mediaUrl }`.
2. Otherwise, parses the response as JSON and returns `{ json }` for the caller to read `request_id`/etc. from.

### A critical, separate gotcha this surfaced: Node's `fetch` has its own ~5-minute timeout

Node's built-in `fetch` (backed by its bundled `undici`) enforces an internal `headersTimeout`/`bodyTimeout` (~5 min default) **completely independently of any `AbortController` signal** you pass to it. Every long-running Segmind call in this client was silently capped at ~5 minutes regardless of what timeout value the code specified — surfacing as `UND_ERR_HEADERS_TIMEOUT`, not whatever error message the code's own timeout logic was supposed to produce.

**Fix**: `fetchWithTimeout()` imports `fetch` and `Agent` directly **from the `undici` npm package** (not Node's global `fetch`) with `headersTimeout: 0, bodyTimeout: 0` on the Agent, making the function's own `AbortController`-based `ms` argument the only timeout that applies. Do not mix Node's global `fetch` with a separately-installed `undici` package's `Agent` as a `dispatcher` — that throws a *different* error (`UND_ERR_INVALID_ARG`, "invalid onRequestStart method") from a version mismatch between the two. Source `fetch` and `Agent` from the same package.

---

## Higgsfield Client: `src/lib/higgsfield/client.ts`

### Image generation — `generateSoulImage()`

```typescript
generateSoulImage(params: {
  apiKey: string;
  prompt: string;
  stylePreset?: string;
  referenceImageUrl?: string;  // plain portrait URL for consistency
  soulId?: string;             // trained Soul ID UUID for consistency (stronger)
  referenceStrength?: number;
  seed?: number; width?: number; height?: number;
}): Promise<string>  // returns image URL (already on Blob if binary)
```

Calls `POST v1/higgsfield-text2image-soul`. **Character consistency has two distinct paths that must not be conflated**: `soulId` (a trained Soul ID, a real UUID) goes into `custom_reference_id`; a plain portrait image URL goes into the separate `reference_image_url` field. Sending a plain URL into `custom_reference_id` 400s with a UUID-parsing error — this was a real bug, fixed.

Used in: character portraits (`/api/.../characters/[id]/portrait`), comic panels (`/api/.../comics` POST), shot previews (`/api/.../production/shots/[id]/preview`).

### Soul ID Training — `trainSoulId()` / `pollSoulIdTraining()`

The one genuinely Higgsfield-native path (everything else above is Segmind).

```typescript
trainSoulId(params: { apiKey: string; apiSecret: string; characterName: string; referenceImageUrls: string[] }): Promise<{ jobId: string }>
pollSoulIdTraining(params: { apiKey: string; apiSecret: string; jobId: string }): Promise<{ status: "processing"|"completed"|"failed"; soulId?: string }>
```

Real contract (verified against the `higgsfield-ai/higgsfield-js` SDK source, not docs scraping — the docs were unreliable for this one):
- Base URL: `https://platform.higgsfield.ai` (not `cloud.higgsfield.ai`)
- Auth: two headers, `hf-api-key` and `hf-secret` (not `Authorization: Bearer key:secret`)
- Endpoint: `POST /v1/custom-references` with body `{ name, input_images: [{ type: "image_url", image_url }, ...] }` — requires 3+ reference images
- The created `id` **is** the Soul ID immediately; poll `GET /v1/custom-references/{id}` for `status` (`not_ready`/`queued`/`in_progress`/`completed`/`failed`) — there's no separate job-id-vs-soul-id distinction.

**Wired into the production pipeline as of item 69** (was previously built but disconnected): `generate-package` fire-and-forget bootstraps and trains a Soul ID for any primary character appearing in 2+ shots via `src/lib/production/soul-id-bootstrap.ts`, never blocking the response, fails open at every step. `getCharacterSoulReference()` prefers a real trained `soulId` over the plain `reference_image_url` fallback once training completes. **Still not live-verified end-to-end against a real completed training job** — the one account tested against in item 70 had no `higgsfieldApiKey`/`higgsfieldApiSecret` set at all, so the bootstrap correctly no-op'd via its fail-open path rather than actually exercising a training run.

### Image-to-Video (DoP) — `generateDoPVideo()`

```typescript
generateDoPVideo(params: { apiKey: string; prompt: string; imageUrl: string; model?: "dop-lite"|"dop-turbo"|"dop-preview"; motionStrength?: number; cameraPreset?: string; seed?: number }): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }>
```

Calls `POST v1/higgsfield-image2video`. **Still on v1.** `dop-lite` (the documented cheapest/fastest tier) has never once completed within 280s across 3 real test attempts — this looks like genuine Higgsfield-side queue latency, not a parameter bug. If you need this reliably, switch it to v2 first (same pattern as `generateTextVideo` below).

### Text-to-Video — `generateTextVideo()`

```typescript
generateTextVideo(params: {
  apiKey: string; prompt: string; model: VideoModelId;
  aspectRatio?: "16:9"|"9:16"|"1:1"; duration?: number; seed?: number;
  cameraPreset?: string; viralPreset?: string;
  imageUrl?: string;  // required for hailuo; ignored by others
  referenceImages?: string[];  // seedance: optional extra; wan-r2v: REQUIRED, its primary mechanism
  multiShotPrompt?: string;  // "Shot 1: ... Shot 2: ..." — renders as one continuous scene, seedance only
}): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }>
```

**`duration` is not optional in practice when using `multiShotPrompt`** — item 70 found live that omitting it silently applies the *single-shot* default (5s) to the whole multi-shot sequence regardless of how many shots are in the script, crushing a 3-shot scene to ~1.7s/shot. The one real caller (`generate-video/route.ts`'s `multiShot=1` path) now sums each shot's own requested duration and caps it to Seedance's documented 4-15s range before calling — any new caller of `multiShotPrompt` must do the same.

**On v2 (async)** as of the pipeline test — confirmed working end-to-end (instant submission, clean polling) via a real Kling job. `POST v2/{model}` returns `{request_id, status_url}` immediately; `pollJob()` polls `status_url`.

Each model has a genuinely different real request schema — handled by `buildVideoRequestBody(model, params)`:

| Model | Real slug | Key quirks |
|---|---|---|
| `kling` | `kling-text2video` | `duration` must be 5 or 10; `mode: "std"\|"pro"`, no `enhance_prompt` |
| `veo` | `veo-3.1-fast` | `duration` must be 4, 6, or 8 (not 5!); only 16:9/9:16; `generate_audio` |
| `seedance` | `seedance-2.0` | Closest to a generic shape — the only one that "just worked" with a one-size-fits-all body. Image-to-video variant **blocks images with real human faces** (ByteDance policy) |
| `wan` | `wan2.1-t2v` | No `duration` field — needs `base_model` (hardcoded `"14b"`) + `video_length` (1-5). Plain, cheap, budget text2video only — as of item 70 the label no longer falsely claims lipsync/avatar capability (that was always wrong; see `docs/gotchas.md`) |
| `wan-r2v` | `wan2.7-r2v` | **New in item 70, not yet live-verified.** `reference_images` is REQUIRED (the model's whole point — character-consistent video straight from reference photos, no training job), `resolution` is uppercase `"720P"/"1080P"` unlike every other model's lowercase convention. Confirmed via Segmind's own blog post, not guessed |
| `hailuo` | `hailuo-02-fast` | **Not pure text2video** — `first_frame_image` is required. `duration` must be 6 or 10 |
| `sora` | — | `deprecated: true`, excluded from `ACTIVE_VIDEO_MODELS` |

None of the `higgsfield-{model}-text2video` slugs from the original implementation exist on Segmind — that prefix is only real for genuinely Higgsfield-branded models (`higgsfield-image2video`, `higgsfield-text2image-soul`).

**`pollJob()`'s v2 result-shape is best-effort, not fully verified**: Segmind's docs describe the v2 contract structurally but never showed a verbatim completed-job JSON body. Current logic tries `data.output?.media_url?.[0] ?? data.output?.image_url ?? data.output?.video_url` from the status response, falling back to a separate result-URL fetch (`response_url`, or the status URL minus its `/status` suffix) if the status payload doesn't embed the result directly. Ran cleanly against a real in-flight job (no errors across 10+ minutes of polling) but was never observed against an actual `COMPLETED` payload — verify the field names the first time a job actually finishes if something looks off.

### Lipsync — `generateLipsync()`

```typescript
generateLipsync(params: { apiKey: string; audioUrl: string; characterImageUrl: string }): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }>
```

Calls `POST v1/hallo` — **a single step**, photo + audio → talking-head video. `hallo`'s real fields are `input_image` + `input_audio` (plus optional `pose_weight`/`face_weight`/`lip_weight`/`face_expand_ratio` tuning, left at defaults). Cheap (~$0.007/GPU-second).

There is **no** direct Segmind model that does "any custom photo + audio → video" other than `hallo` — checked `HeyGen Avatar V` first (rejected: only 24 fixed stock avatars or a paid custom-trained Digital Twin, can't use a freshly-generated character portrait) before finding `hallo`.

**Known limit**: full-chapter-length audio (164s tested) in one call gets all the way through this client's own timeouts (once the undici bug above is fixed) but then hits **Segmind's own nginx gateway returning `504 Gateway Time-out`** — their reverse-proxy's own ceiling on a single long-running synchronous request. This is a provider-side limit, not something fixable from the client. `hallo` is still on v1; switching it to v2 (like `generateTextVideo`) is the most likely real fix, not yet done. The fallback if that doesn't pan out is chunking the source audio into shorter segments before lipsyncing each one — not implemented (no `ffmpeg` available in the dev environment used for the test).

### Polling — `pollJob()`

```typescript
pollJob(params: { apiKey: string; pollingUrl: string }): Promise<{ status: JobStatus; mediaUrl?: string }>
```

`JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "ERROR"`. See the v2 result-shape caveat above.

---

## Camera & Viral Presets: `src/lib/higgsfield/presets.ts`

Unchanged by the pipeline test — camera presets (20, e.g. `slow_push`/`crane_up`/`bullet_time`) and viral presets (15, e.g. `kung_fu_hit`/`samurai_duel`) inject a `promptInjection` string into the final prompt text. `getRecommendedViralPreset(sceneDescription)` does keyword matching against scene text. Not independently re-verified against real Segmind behavior this session — these only affect prompt text, not request parameters, so they're lower-risk than the structural bugs above.

---

## Job Status / Polling Routes (app-side)

```
POST /api/projects/[projectId]/production/shots/[shotId]/generate-video   → kicks off generateTextVideo
GET  /api/projects/[projectId]/production/shots/[shotId]/generate-video/status → polls via pollJob

POST /api/projects/[projectId]/production/shots/[shotId]/animate          → kicks off generateDoPVideo
GET  /api/projects/[projectId]/production/shots/[shotId]/animate/status   → polls via pollJob
```

Both POST routes check `mediaUrl` in the result first: if present (v1 synchronous completion), the shot is marked `final_ready`/`animated` immediately with no polling needed. If absent (v2 async submission), `generationStatus` is set to `generating_final`/`animating` and `higgsfieldJobId` stores `${requestId}|${pollingUrl}` for the `/status` route to pick up. **This dual-path handling means the same routes correctly support both v1 and v2 models without further changes** — extending `generateDoPVideo`/`generateLipsync` to v2 doesn't require touching the route logic, only the client functions.

---

## Audio Generation (OpenAI or Segmind — user-selectable as of 2026-07-07)

```
POST /api/audio/generate   { projectId, chapterId } → provider.generate(), stores audioExports.audioUrl
POST /api/audio/lipsync    { audioExportId, characterId, projectId } → generateLipsync() → audioExports.lipsyncVideoUrl
```

Audio Novel narration now has two interchangeable providers behind `src/lib/audio/{providers,registry}.ts` (mirrors the image-provider abstraction in `src/lib/media/`), selected per-user via `users.ttsProviderId` (default `"openai"`, settings-page toggle at "Audio Novel narration"):

| | OpenAI TTS-1 (`adapters/openai-tts.ts`) | Segmind Grok TTS (`adapters/segmind-grok-tts.ts`) |
|---|---|---|
| Cost | $0.015/1K chars | $0.01875/1K chars (~25% more) |
| Voices | 6: alloy/echo/fable/onyx/nova/shimmer | 5: ara/eve/leo/rex/sal |
| API key | Needs its own OpenAI key (`users.openaiApiKey`, env fallback — the one feature in this doc with an env fallback) | Reuses the same Segmind key already used for images/video/lipsync — no second key |
| Maturity | Proven, no known issues | Newer model (xAI), no track record in this app yet |

Neither is a strict win — Grok TTS costs more and has one fewer voice, but removes the second-API-key requirement; shipped as a user choice rather than a replacement. Grok TTS's real contract (scraped live from `segmind.com/models/grok-tts/api`, not guessed): `POST https://api.segmind.com/v1/grok-tts`, body `{text, voice_id, language, codec, speed}`, synchronous — returns raw audio bytes directly (`Content-Type: audio/*`) for a normal-length segment, or a JSON error body on failure. `text` is capped at 15,000 characters (well above what any single narration/dialogue segment needs).

Both providers split chapter content into narration/dialogue segments via `parseChapterIntoSegments` (`src/lib/audio/segment-chapter.ts`), assigning each character's `voiceId` if it's valid for the currently-active provider, else that provider's own default narrator voice (`isValidVoiceForProvider()` — handles the case where a character's voice was assigned under the *other* provider, e.g. an OpenAI voice name while the account is now on Segmind Grok TTS, without sending an invalid `voice_id` to the API). The `WorldBiblePanel` voice picker shows both providers' voices in one `<select>`, grouped by `<optgroup>`, so a user can pre-assign voices for either provider regardless of which is currently active.

TTS confirmed solid for any chapter length on the OpenAI path (unchanged from before this refactor). Grok TTS has not yet been validated against a real Segmind call — the request/response contract above is scraped from live docs, not exercised end-to-end.

---

## Comic Studio

```
POST /api/projects/[projectId]/comics   { chapterId, artStyleId } → up to 6 panels generated in parallel (Promise.allSettled)
```

Uses `generateSoulImage()` under the hood — benefits from fix #1/#2 above automatically. Generates **all panels for a page in one call**, in parallel — there's no per-panel inspect-before-bulk checkpoint at this route's granularity (unlike the production-shots flow, which is one-call-per-shot). Confirmed working: 6/6 panels, zero errors, in a real test.

---

## Export: Comic / Video Package

Unchanged by this session — `/api/projects/[projectId]/comics/export` (ZIP of pages+panels) and `/api/projects/[projectId]/production/generate-package` (the production package itself, fixed to auto-create World Bible rows — see the incident report) were not otherwise touched.

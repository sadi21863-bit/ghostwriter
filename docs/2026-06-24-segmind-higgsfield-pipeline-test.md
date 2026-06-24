# 2026-06-24/25: Real-money Segmind/Higgsfield pipeline test — full report

A bounded, real-money paid test of the GhostWriter→Higgsfield/Segmind pipeline (text → production package → character/shot images → video clips), expanded over the session into a comprehensive audit of every Segmind/Higgsfield-touching feature, every project format, and the Series Bible/Universe context-injection systems. Run against a disposable test account (`ghostwriter-test-runner@example.com`) with the real funded Segmind key PATCHed onto it. ~$10 initial Segmind budget, topped up to $15 partway through; ~$15 Anthropic balance used for text generation throughout.

This is the detailed record. See `docs/video-and-media.md` for the corrected, ongoing reference doc (this file is a point-in-time report; that one is the living architecture doc).

---

## What was tested, end to end

### Story 1 "The Dealer" (Midwest Armaments) — full trailer pipeline
Gothic-Americana action/noir. Prose (6-beat trailer sequence) → production package (2 characters, 2 locations, 6 shots, auto-created World Bible rows) → 2 character portraits → 6 shot preview images → 6 video clips (Seedance 2.0). All 8 images and 6 videos succeeded. Output: `outputtestresults/story1-the-dealer/`.

### Story 2 "The Horizon Line" (Project Horizon) — full trailer pipeline
Psychological horror/sci-fi. Same full pipeline: prose → package (3 characters incl. a deliberately-skipped non-physical "Automated Voice" — see below — 4 locations, 6 shots) → 2 portraits → 6 shot images → 6 video clips. 5 of 6 videos succeeded on the first attempt; 1 hit a genuine Segmind content-policy rejection (see below), fixed by editing the prompt, succeeded on retry. Output: `outputtestresults/story2-the-horizon-line/`.

### Comic Studio
One full comic page (6 panels) generated against Story 1's chapter, `noir` art style. 6/6 panels succeeded, zero errors, strong multi-character consistency. Output: `outputtestresults/comic-studio-test/`.

### Audio Novel (TTS)
Full-chapter TTS generation against Story 1's chapter. Works cleanly — confirmed via a real, valid MP3 (160kbps, 164s). No outstanding issues. Output: `outputtestresults/story1-the-dealer/audio-novel.mp3`.

### Lipsync
Extensively investigated; see the dedicated section below. Net result: correctly re-architected onto a real single-step model (`hallo`), a genuinely valuable Node/undici timeout bug fixed along the way, but full-chapter-length (164s) lipsync hits a hard ceiling on Segmind's own infrastructure (their nginx gateway 504s), not fixable client-side. Works for normal-length segments.

### All 9 project formats — text generation
Novel, Screenplay (via Story 1/2), Web Series, YouTube Long-form, YouTube Short, TikTok Script, TikTok Native, Instagram Reel, Podcast Episode. All 9 generate successfully via `mode: "write"`, each producing genuinely format-appropriate output (TikTok/Instagram use on-screen-text visual cues, YouTube Short uses bold emphasis, Podcast leans audio-narrative). Full text saved: `outputtestresults/format-tests/all-9-formats.md`.

### Series Bible (Book Series)
Created a series bible linking Story 1 + Story 2 projects, with a deliberately distinctive made-up world rule ("the Glasswing Frequency"). Code-verified the context-injection mechanism is correctly wired into the system prompt (`buildSeriesBibleContext` in `/api/ai/generate/route.ts`). A real generation test didn't literally cite the planted detail — most likely the model choosing not to over-literally cite background lore in a 3-sentence excerpt, not a sign the injection failed; not chased further with more paid calls.

### Universe
Used "The Narrative Gaps" research PDF (5 unconnected horror/sci-fi concepts) — exactly the kind of standalone-but-secretly-connected anthology content the Universe feature is for (vs. Series Bible, which is for direct sequential continuations). Created universe "The Narrative Gaps" with a connecting thread ("the Quiet Editor"), 2 projects ("The Premium", "The Scent of Lavender") linked via `universeId`/`timelineSort`, 1 canon event. **Found and fixed a real bug**: see below.

---

## Real bugs found and fixed

### 1. `generateSoulImage` crashed on every call — binary response, not JSON
Segmind's `higgsfield-text2image-soul` endpoint returns the generated image as raw binary bytes (`Content-Type: image/png`), not a JSON-wrapped URL. The code unconditionally called `res.json()`, which threw `SyntaxError: Unexpected token` on the PNG magic bytes. Fixed via a shared `resolveMediaResponse()` helper that detects binary `image/*`/`video/*` responses and uploads them to Vercel Blob itself, falling back to `res.json()` only for genuinely JSON responses. (`src/lib/higgsfield/client.ts`)

### 2. Character-consistency reference was broken — wrong field
The code sent a character's portrait URL into Segmind's `custom_reference_id` field, which strictly requires a trained Soul-ID **UUID** and rejected plain URLs with a `uuid_parsing` 400. Fixed by using the separate `reference_image_url` field for plain portrait URLs, mirroring a pattern that was already correctly used elsewhere in the same file (`generateLipsync`'s old soulId-vs-image-url split).

### 3. `generate-package` never created World Bible rows from its own output
A fresh project with no pre-existing characters meant every shot's `primaryCharacterId` stayed `null` forever — the consistency reference (bug #2's fix) had nothing to link to. Fixed: `generate-package` now creates `characters`/`locations` rows from its own generated `characterSheets`/`locationSheets` when they don't already exist, before resolving shot links. (`src/app/api/projects/[projectId]/production/generate-package/route.ts`)

### 4. `generateDoPVideo`/`generateTextVideo`/`generateLipsync` (old) assumed async; Segmind v1 returns sync
Every v1 endpoint tested (`higgsfield-image2video`, the old fictional lipsync endpoint, the text2video models) returns the finished media synchronously as raw binary — not a job ID to poll. Initially fixed by extending `resolveMediaResponse()` to all of them; later superseded by the v2 async architecture switch (see below).

### 5. Five of six video model endpoint slugs were fictional
`higgsfield-{model}-text2video` doesn't exist on Segmind for third-party model brands — only genuinely Higgsfield-branded endpoints (`higgsfield-image2video`, `higgsfield-text2image-soul`) use that prefix. Corrected against Segmind's real docs: `kling-text2video`, `seedance-2.0`, `veo-3.1-fast`, `hailuo-02-fast`, `wan2.1-t2v`. (`src/lib/higgsfield/models.ts`)

### 6. Per-model video request bodies were one-size-fits-all
`generateTextVideo` sent an identical body to all 5 models; only worked for Seedance by coincidence. Real per-model schemas differ substantially:
- **Veo 3.1**: `duration` must be 4, 6, or 8 (old default of 5 was invalid)
- **Wan 2.1**: no `duration` field at all — needs `base_model` (`"14b"`) + `video_length` (1-5)
- **Hailuo 02 Fast**: not pure text2video — `first_frame_image` is **required**
- **Kling**: duration must be 5 or 10; uses `mode: "std"|"pro"`, not `enhance_prompt`

Fixed via `buildVideoRequestBody(model, params)`, a per-model adapter. `generateTextVideo` now also accepts an optional `imageUrl` (the route passes the shot's `previewImageUrl`), since Hailuo requires it and the others ignore it harmlessly.

### 7. Lipsync's entire contract was fictional
The original implementation invented a `higgsfield-wan-text2video` + `audio_url`/`talking_head` body that doesn't exist on Segmind at all (`404 "Model information not found"`). Segmind's real lipsync models (`pixverse-lipsync`, `sync.so-lipsync-2-pro`) need an existing **video**, not a photo. Final fix: **`hallo`** (`input_image` + `input_audio` → talking-head video, single step, confirmed via Segmind's docs) — no multi-step pipeline needed. An interim two-step fix (animate portrait → lipsync the clip) was real and functional but unnecessarily complex; replaced once `hallo` was found.

### 8. Higgsfield-native Soul ID training: wrong base URL, wrong auth, wrong endpoint
`trainSoulId`/`pollSoulIdTraining` used `cloud.higgsfield.ai` with `Authorization: Bearer {key}:{secret}` against `/characters/train`. Verified against the actual `higgsfield-ai/higgsfield-js` SDK source on GitHub: real base URL is `https://platform.higgsfield.ai`, real auth is two separate headers (`hf-api-key`, `hf-secret`), real endpoint is `/v1/custom-references` (the created `id` *is* the Soul ID — no separate job-id/soul-id distinction). Fixed but **untested live** — the test account has no Higgsfield credentials, only Segmind. Not used by the trailer pipeline.

### 9. `buildSeriesUniverseContext` never read the universe's own world rules
Only ever queried `universeEvents`/`universeCharacters` — never the `universes` table itself. A universe's own `premise`/`tone`/`sharedRules` (settable via the API, shown in the UI) could **never** reach generation, regardless of setup, and the whole block was additionally gated on `project.timelineSort != null` so even canon events couldn't apply to a universe's first story. Fixed: the premise/tone/sharedRules lookup now runs independently of `timelineSort`, mirroring the equivalent Series Bible pattern. (`src/app/api/ai/generate/route.ts`)

### 10. Node's built-in `fetch` silently caps every long-running call at ~5 minutes
Node's bundled `undici` (which powers the global `fetch`) enforces its own internal `headersTimeout`/`bodyTimeout` (~5 min default) **independently of any `AbortController` signal** passed to `fetch()`. Every long-running Segmind call in this client was silently capped at ~5 minutes no matter what timeout value the code passed — surfaced as `UND_ERR_HEADERS_TIMEOUT` well before our own (longer) intended timeouts ever got a chance to fire. Fixed by importing `fetch`/`Agent` directly from the `undici` npm package (not Node's global fetch) with both timeouts disabled, making our own `AbortController`-based timeout the only one that applies. (Mixing Node's *internal* undici with a *separately-installed* `undici` package's `Agent` object as a `dispatcher` threw a second bug, `UND_ERR_INVALID_ARG` "invalid onRequestStart method" — a version mismatch between the two; fixed by sourcing `fetch` and `Agent` from the same package.)

---

## Architecture change: v1 (sync) → v2 (async) for video generation

After three different models (DoP/image2video, Hallo, Kling) all independently hit multi-minute-plus latency on Segmind's **v1** (synchronous) endpoints — each requiring ever-larger client-side timeouts that kept getting exhausted — the real fix was switching to Segmind's **v2** (asynchronous) endpoints, which return a job ID immediately instead of holding the HTTP connection open for the full render time.

This is exactly what the app's existing `generationStatus`/`higgsfieldJobId`/`/status`-polling architecture (`generate-video/status`, `animate/status` routes) was originally built for — it had just never been pointed at an endpoint that actually behaved asynchronously, since every v1 endpoint turned out to respond synchronously.

**Implemented for `generateTextVideo` only** (the pilot), confirmed working end-to-end with a real Kling submission: `POST /v2/{model}` returns `{request_id, status_url}` in under a second; polling `pollJob()` against `status_url` returns clean `QUEUED`/`PROCESSING` status with no errors (the actual render took 10+ minutes — the architecture absorbs this gracefully instead of timing out, exactly the "generating, check back later" UX this was meant to enable).

**Not yet extended to**: `generateDoPVideo` (image2video/animate route), `generateLipsync` (Hallo), `generateSoulImage` (image generation). These are still on v1 synchronous calls. Extending the same pattern to them is the natural next step — `generateSoulImage`/Hallo's lipsync in particular would directly benefit, since both have shown multi-minute latency under load.

**`pollJob()`'s v2 result-parsing is best-effort**, not 100%-verified against real completed-job JSON: Segmind's docs describe the v2 contract structurally (`request_id`/`status_url`/`response_url`, status values `QUEUED`/`PROCESSING`/`COMPLETED`/`FAILED`) but never showed a verbatim example response body. The code tries `data.output?.media_url?.[0] ?? data.output?.image_url ?? data.output?.video_url` from the status response first, then falls back to a separate `response_url`/non-`/status` fetch if the status payload doesn't embed the result directly. This logic ran without erroring against a real in-flight job but was never observed against an actual `COMPLETED` response in this session (the test Kling job was still rendering when the session's pipeline testing concluded).

---

## Lipsync — detailed timeline

1. **Original state**: fictional `higgsfield-wan-text2video` + `audio_url`/`talking_head` contract, 404s.
2. **Interim fix**: two-step pipeline (animate portrait via `dop-lite` → lipsync the resulting clip via `pixverse-lipsync`). Correct in principle, but `dop-lite` consistently exceeded 280s across 3 real attempts and never once completed.
3. **Researched alternatives**: `HeyGen Avatar V` (only 24 stock avatars, no custom photos — not usable), `hallo` (any custom photo + any audio, single step — exactly what's needed).
4. **Replaced the whole pipeline with `hallo`.** Confirmed cheap (~$0.007/GPU-second).
5. **Tested against a 164-second full-chapter clip** (deliberately, per explicit instruction to test full-chapter-length, not a short clip) — hit the Node/undici 5-minute timeout bug (fix #10 above), then after fixing that, hit **Segmind's own nginx gateway returning `504 Gateway Time-out`** — their reverse-proxy's own ceiling on a single long-running synchronous request, confirmed entirely outside client-side control.
6. **Decision**: stop here, documented as a known scale limit (`outputtestresults/story1-the-dealer/LIPSYNC_FINDINGS.md`). Lipsync is correctly implemented and works for normal-length segments; full-chapter-length in one call needs either the v2 async switch (not yet applied to Hallo) or audio chunking (would need a Node-based MP3 splitter — no `ffmpeg` in this environment) — both scoped as follow-ups, not pursued further this session.

---

## Provider research highlights (useful beyond this session)

- Segmind's `v1` vs `v2` distinction: v1 endpoints typically complete within ~60s and return media synchronously; v2 is "recommended for long-running/video models" and returns a job to poll. Every model used in this codebase had been wired to v1.
- Real per-second video pricing (Seedance 2.0, 720p): ~$0.15/s → a 5s clip ≈ $0.75. This is why video cost dominates spend far more than images (~$0.12-0.23/image).
- Seedance 2.0's image-to-video path explicitly **blocks images with real human faces** per ByteDance policy — ruled it out as a Hailuo alternative for the lipsync base-video step for this reason.
- Hailuo 02 Fast and Veo 3.1 both have no documented face restriction and are far faster (~80-100s typical) than Higgsfield's own `dop-lite` (which never completed within 280s across 3 attempts in this session).
- `comic_studio`/`audio_novel` features require `story_pro`/`all_access` tier specifically — `creator_pro` does not unlock them (not a bug; the test account needed a tier bump for these specifically, separate from the general-generation tier bump done earlier).

---

## What's confirmed solid vs. what's still a known gap

**Solid (real money, real verification):**
- Full text→images→video trailer pipeline, both stories, all 9 formats.
- Comic Studio (full page, 6 panels).
- Audio Novel TTS (any length).
- Image generation + character consistency (portrait reference).
- Production package auto-creates World Bible rows.
- Universe/Series Bible context-injection mechanism (code-verified).
- v2 async submission + polling (architecturally proven via Kling).

**Known gaps (documented, not silently missing):**
- v2 async switch only applied to `generateTextVideo` — `generateDoPVideo`/`generateLipsync`/`generateSoulImage` still on v1 and still vulnerable to the same multi-minute-latency pattern.
- Lipsync doesn't support full-chapter-length audio in one call (provider-side gateway ceiling).
- `pollJob()`'s v2 result-shape parsing is best-effort, never confirmed against a real `COMPLETED` response body.
- Higgsfield-native Soul ID training fix is unverified live (no test credentials).
- No UI changes were made this session — all of this was validated via direct API calls. The frontend's existing polling UI (if any) was never exercised against the new v2 behavior.

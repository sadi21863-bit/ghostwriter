# Video and Media Generation

How Higgsfield, Segmind, and the video pipeline work, what Soul ID is, and how the text-to-video models differ.

---

## Provider Architecture

GhostWriter uses two providers for media generation:

| Provider | Used for | Integration |
|---|---|---|
| **Higgsfield** | Soul ID training, image-to-video (DoP), text-to-video, lipsync | Native Higgsfield API |
| **Segmind** | Soul 2.0 image generation, some video models | Segmind proxy API |
| **OpenAI** | Embeddings ONLY (`text-embedding-3-small`) | NOT used for image or video |

**Why Segmind as a proxy?**
Segmind provides access to multiple open-source models (Stable Diffusion variants, Soul 2.0) through a unified API. It's cheaper than generating through each model's native API and simplifies integration.

---

## Higgsfield Client: `src/lib/higgsfield/client.ts`

The central media client. All image/video generation calls go through this file.

### Soul 2.0 (Image Generation)

Soul 2.0 is a Segmind model that generates photorealistic character portraits:

```typescript
export async function generateSoul2Image({
  prompt,
  soulId,       // optional — trained character consistency
  width, height,
  steps, seed,
}: Soul2Options): Promise<string> // returns image URL
```

Used in:
- Character portrait generation (`/api/.../characters/[id]/portrait`)
- Comic panel image generation (`/api/.../comics/.../regenerate`)
- Production shot preview (`/api/.../production/shots/[id]/preview`)

### Soul ID Training

Soul ID is Higgsfield's character consistency system. A user uploads 5-10 reference photos of a character, and Higgsfield trains a lightweight LoRA that can be used in subsequent generations to keep the character's face consistent.

```typescript
export async function trainSoulId({
  characterId,
  imageUrls,    // 5-10 reference images
  name,
}: SoulIdTrainOptions): Promise<{ jobId: string }>
```

Training takes 5-15 minutes. Status is polled via:
```typescript
export async function getSoulIdStatus(jobId: string): Promise<{
  status: "pending" | "training" | "complete" | "failed";
  soulId?: string;  // ready to use once "complete"
}>
```

The `soulId` string is stored in `characters.higgsfield_soul_id` and passed to subsequent Soul 2.0 calls for that character.

### Image-to-Video (DoP)

"Director of Photography" — animates a still image with cinematic camera movement:

```typescript
export async function generateDoPVideo({
  imageUrl,
  cameraPreset, // one of 20 presets
  duration,     // seconds
  fps,
}: DoPOptions): Promise<{ jobId: string }>
```

DoP is best for: character portraits animated with subtle movement, establishing shots with camera push/pull, scenes where a specific camera move is needed.

### Text-to-Video

Six text-to-video models with different strengths:

| Model | Best for | Notes |
|---|---|---|
| `kling` | Cinematic, realistic motion | Chinese model, excellent quality |
| `veo` | Google's model, natural motion | Photorealistic, slower |
| `sora` | OpenAI's model | High creativity, less control |
| `seedance` | Fast, consistent characters | Good for action sequences |
| `wan` | Anime/stylized content | Works well with illustrated styles |
| `hailuo` | Short clips, viral-style | Fast generation, MiniMax model |

```typescript
export async function generateTextToVideo({
  prompt,
  model,        // "kling" | "veo" | "sora" | "seedance" | "wan" | "hailuo"
  duration,
  aspectRatio,
  viralPreset,  // optional — applies preset's camera and motion instructions
}: TextToVideoOptions): Promise<{ jobId: string }>
```

### Lipsync

Generates a talking-head video synced to audio:

```typescript
export async function generateLipsync({
  imageUrl,     // face reference
  audioUrl,     // TTS or uploaded audio
  soulId,       // optional character consistency
}: LipsyncOptions): Promise<{ jobId: string }>
```

Uses WAN 2.5 with character consistency. Best results with a front-facing portrait and clean audio.

---

## Camera Presets: `src/lib/higgsfield/presets.ts`

20 camera presets that map to DoP generation parameters:

| Preset | Motion |
|---|---|
| `static` | No movement |
| `slow_push` | Slow dolly in |
| `slow_pull` | Slow dolly out |
| `tracking_left` | Camera tracks left |
| `tracking_right` | Camera tracks right |
| `crane_up` | Crane/jib up |
| `crane_down` | Crane/jib down |
| `drone_aerial` | Birds-eye pull-out |
| `handheld` | Subtle handheld shake |
| `bullet_time` | 360° freeze-frame |
| `pov` | First-person perspective |
| `dutch_angle` | Tilted frame (unease) |
| `slow_motion` | 120fps slow-mo |
| `timelapse` | Rapid time progression |
| `zoom_in` | Optical zoom in |
| `zoom_out` | Optical zoom out |
| `orbit_left` | Circular orbit left |
| `orbit_right` | Circular orbit right |
| `whip_pan` | Fast horizontal pan |
| `crash_zoom` | Rapid zoom + shake |

### Viral Presets

15 preset combinations tuned for high-engagement short-form content:

| Preset | Style |
|---|---|
| `kung_fu_hit` | Impact frame + slow-mo + crash zoom |
| `dragon_fantasy` | Orbital camera + atmospheric haze |
| `samurai_duel` | Whip pan + dutch angle + desaturated |
| `bollywood_entrance` | Crane up + warm grade |
| (+ 11 more) | ... |

`getRecommendedViralPreset(sceneDescription)` takes the scene text and returns the best-matching preset based on keyword matching against scene content.

---

## Job Polling Pattern

All async video/image jobs use the same polling pattern:

```typescript
// 1. Start job → returns jobId
const { jobId } = await generateTextToVideo({ ... });

// 2. Store jobId in DB
await db.update(productionShots).set({ higgsfield_job_id: jobId, status: "generating" });

// 3. Frontend polls status route
GET /api/.../shots/[shotId]/generate-video/status

// 4. Status route polls Higgsfield
const status = await getJobStatus(jobId);
if (status.complete) {
  await db.update(productionShots).set({ videoUrl: status.url, status: "complete" });
}
```

The frontend polls every 3-5 seconds. Polling stops when `status === "complete"` or `status === "failed"`.

---

## Audio Generation

Audio uses Higgsfield's TTS:

```typescript
POST /api/audio/generate
  body: { projectId, chapterId, voice, speed }
  → generates MP3, stores URL in audioExports.audioUrl
```

Lipsync takes the generated audio:
```typescript
POST /api/audio/lipsync
  body: { audioExportId, characterId }
  → higgsfield lipsync job → stores URL in audioExports.lipsyncVideoUrl
```

---

## OpenAI: Embeddings Only

OpenAI is used **exclusively** for generating text embeddings for the craft library:

```typescript
// src/lib/ai/embeddings.ts
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});
```

This powers semantic search in the Work Packets craft library. It has nothing to do with text generation — Anthropic Claude handles all AI writing.

**Why OpenAI for embeddings when we use Claude for everything else?**
Anthropic does not offer a text embedding API. `text-embedding-3-small` is the industry standard for semantic search at low cost. The `OPENAI_API_KEY` is only needed if you use the craft library search feature.

---

## Export: Comic

`/api/projects/[projectId]/comics/export` generates a ZIP of the comic:

1. Fetches all pages and panels from DB
2. Downloads each panel image URL
3. Uses JSZip to package images + metadata JSON
4. Returns ZIP as blob download

---

## Export: Video Package

`/api/projects/[projectId]/production/generate-package` creates a production package:

1. Fetches all shots from DB
2. Generates shot list as structured JSON + printable format
3. Includes video URLs for all generated shots
4. Returns package as JSON (or ZIP if videos are included)

Uses `MODELS.default` to generate creative brief copy for the package.

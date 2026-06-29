// src/lib/higgsfield/client.ts
// Higgsfield generation client.
// Image/video generation routes through Segmind proxy (api.segmind.com/v1).
// Soul ID training uses Higgsfield's native platform API (platform.higgsfield.ai).

import { CAMERA_PRESETS, VIRAL_PRESETS } from "./presets";
import { VIDEO_ENDPOINTS, type VideoModelId } from "./models";
import { buildStoryDiffusionBody } from "@/lib/comic-gen/storydiffusion";
// Using undici's own fetch + Agent (not Node's global fetch) — mixing Node's
// built-in fetch with a separately-installed undici package's Agent threw
// "InvalidArgumentError: invalid onRequestStart method" (UND_ERR_INVALID_ARG),
// a version mismatch between Node's bundled internal undici and this package.
// Sourcing both from the same package guarantees they're compatible.
import { fetch as undiciFetch, Agent } from "undici";

const SEGMIND_BASE = "https://api.segmind.com/v1";

// Node's built-in fetch (undici) has its own internal headersTimeout/bodyTimeout
// (~5min default) that fires independently of any AbortController signal passed
// to fetch — observed directly as UND_ERR_HEADERS_TIMEOUT on long-running Segmind
// calls (Hallo lipsync on full-chapter audio, Kling) well before our own longer
// timeouts ever got a chance to fire. Disabling both here makes our own
// AbortController-based `ms` argument the only timeout that actually applies.
const longRunningDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

/** Wraps fetch with an abort timeout so a hung provider response can't block a request indefinitely. */
async function fetchWithTimeout(url: string, opts: RequestInit, ms = 120_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await undiciFetch(url, { ...opts, signal: ctrl.signal, dispatcher: longRunningDispatcher } as any) as unknown as Response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Generation timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every Segmind generation endpoint observed so far (text2image-soul, image2video)
 * returns the finished media as raw binary bytes synchronously, not a JSON-wrapped
 * job/URL — despite the calling code throughout this file originally assuming a
 * JSON response shape. This uploads a binary response to Blob (or falls back to a
 * data URL) and returns it; callers fall back to JSON parsing when the response
 * isn't binary, in case some model variant genuinely does return JSON.
 */
async function resolveMediaResponse(
  res: Response,
  kind: "image" | "video",
  blobPathPrefix: string,
): Promise<{ mediaUrl?: string; json?: any }> {
  const contentType = res.headers.get("content-type") ?? "";
  const isBinary = kind === "image" ? contentType.startsWith("image/") : contentType.startsWith("video/");
  if (!isBinary) return { json: await res.json() };

  const buf = Buffer.from(await res.arrayBuffer());
  const ext = kind === "image" ? (contentType.includes("png") ? "png" : "jpg") : "mp4";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${blobPathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, buf, {
      access: "public",
      contentType: contentType || (kind === "image" ? "image/png" : "video/mp4"),
    });
    return { mediaUrl: blob.url };
  }
  return { mediaUrl: `data:${contentType};base64,${buf.toString("base64")}` };
}

// ── IMAGE GENERATION (Soul 2.0) ──────────────────────────────────────────────

export async function generateSoulImage(params: {
  apiKey: string;
  prompt: string;
  stylePreset?: string;
  referenceImageUrl?: string;
  soulId?: string;
  referenceStrength?: number;
  seed?: number;
  width?: number;
  height?: number;
}): Promise<string> {
  const body: Record<string, any> = {
    prompt: params.prompt,
    seed: params.seed ?? Math.floor(Math.random() * 999999),
    enhance_prompt: true,
  };

  if (params.stylePreset) body.style_preset = params.stylePreset;

  // custom_reference_id is a trained Soul ID (must be a UUID) — a plain portrait
  // image URL goes through the separate reference_image_url field instead (mirrors
  // the same soulId-vs-image-url split already used in generateLipsync below).
  if (params.soulId) {
    body.custom_reference_id = params.soulId;
    body.custom_reference_strength = params.referenceStrength ?? 0.95;
  } else if (params.referenceImageUrl) {
    body.reference_image_url = params.referenceImageUrl;
  }

  if (params.width)  body.width  = params.width;
  if (params.height) body.height = params.height;

  const res = await fetchWithTimeout(`${SEGMIND_BASE}/higgsfield-text2image-soul`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soul image failed (${res.status}): ${err}`);
  }

  const { mediaUrl, json } = await resolveMediaResponse(res, "image", "soul-images");
  if (mediaUrl) return mediaUrl;
  const url = json.image_url ?? json.output?.image_url;
  if (!url) throw new Error("No image URL in Soul response");
  return url;
}

// ── SOUL ID TRAINING ──────────────────────────────────────────────────────────
// Uses native Higgsfield cloud API (not Segmind proxy). Contract verified against
// the official higgsfield-js SDK source (github.com/higgsfield-ai/higgsfield-js) —
// the previous implementation's base URL, auth headers, endpoint path, and request/
// response shape were all guessed wrong:
//   - base URL is platform.higgsfield.ai, not cloud.higgsfield.ai
//   - auth is two separate headers (hf-api-key / hf-secret), not "Authorization: Bearer key:secret"
//   - the resource is "custom-references" (matches the custom_reference_id field
//     already used correctly elsewhere in this file), not "characters/train"
//   - the created id IS the Soul ID immediately — there's no separate job-id vs.
//     soul-id distinction; you poll the same resource until its status flips.

const HF_PLATFORM_BASE = "https://platform.higgsfield.ai";

export async function trainSoulId(params: {
  apiKey: string;
  apiSecret: string;
  characterName: string;
  referenceImageUrls: string[];
}): Promise<{ jobId: string }> {
  if (params.referenceImageUrls.length < 3) {
    throw new Error("Soul ID training requires at least 3 reference images");
  }

  const res = await fetchWithTimeout(`${HF_PLATFORM_BASE}/v1/custom-references`, {
    method: "POST",
    headers: {
      "hf-api-key": params.apiKey,
      "hf-secret": params.apiSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.characterName,
      input_images: params.referenceImageUrls.map(url => ({ type: "image_url", image_url: url })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soul ID training failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { jobId: data.id };
}

export async function pollSoulIdTraining(params: {
  apiKey: string;
  apiSecret: string;
  jobId: string;
}): Promise<{ status: "processing" | "completed" | "failed"; soulId?: string }> {
  const res = await fetchWithTimeout(`${HF_PLATFORM_BASE}/v1/custom-references/${params.jobId}`, {
    headers: {
      "hf-api-key": params.apiKey,
      "hf-secret": params.apiSecret,
    },
  });

  if (!res.ok) return { status: "failed" };

  const data = await res.json();
  if (data.status === "completed") return { status: "completed", soulId: data.id };
  if (data.status === "failed") return { status: "failed" };
  return { status: "processing" }; // covers not_ready / queued / in_progress
}

// ── IMAGE-TO-VIDEO (DoP) ──────────────────────────────────────────────────────

export async function generateDoPVideo(params: {
  apiKey: string;
  prompt: string;
  imageUrl: string;
  model?: "dop-lite" | "dop-turbo" | "dop-preview";
  motionStrength?: number;
  cameraPreset?: string;
  seed?: number;
}): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }> {
  let finalPrompt = params.prompt;
  if (params.cameraPreset && CAMERA_PRESETS[params.cameraPreset]) {
    finalPrompt += `. ${CAMERA_PRESETS[params.cameraPreset].promptInjection}`;
  }

  const res = await fetchWithTimeout(`${SEGMIND_BASE}/higgsfield-image2video`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model ?? "dop-turbo",
      prompt: finalPrompt,
      seed: params.seed ?? Math.floor(Math.random() * 999999),
      motion_strength: params.motionStrength ?? 0.7,
      image_urls: [params.imageUrl],
      enhance_prompt: true,
    }),
  }, 280_000); // observed to need >240s in practice; 280s leaves headroom under the route's 300s ceiling

  if (!res.ok) throw new Error(`DoP video failed (${res.status}): ${await res.text()}`);
  const { mediaUrl, json } = await resolveMediaResponse(res, "video", "production-videos");
  if (mediaUrl) return { mediaUrl };
  return {
    requestId: json.request_id,
    pollingUrl: json.polling_url ?? `${SEGMIND_BASE}/requests/${json.request_id}`,
  };
}

// ── TEXT-TO-VIDEO ─────────────────────────────────────────────────────────────
// Each model has a genuinely different real request schema (confirmed against
// Segmind's own per-model docs) — the previous implementation sent one identical
// body to all of them, which only ever worked for seedance by coincidence:
//   - kling-text2video:  duration must be 5 or 10 (5 happened to be valid)
//   - veo-3.1-fast:      duration must be 4, 6, or 8 — our old default of 5 was invalid
//   - wan2.1-t2v:        no "duration" field at all; needs base_model + video_length (1-5)
//   - hailuo-02-fast:    not pure text2video — first_frame_image is REQUIRED
//   - seedance-2.0:      matches our old generic shape closely enough to have worked
function nearestOf(allowed: number[], value: number): number {
  return allowed.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best));
}

function buildVideoRequestBody(
  model: VideoModelId,
  p: { prompt: string; aspectRatio: string; duration?: number; seed: number; imageUrl?: string; referenceImages?: string[] },
): Record<string, any> {
  switch (model) {
    case "kling":
      return {
        prompt: p.prompt,
        aspect_ratio: p.aspectRatio,
        duration: nearestOf([5, 10], p.duration ?? 5),
        mode: "std",
      };
    case "veo":
      return {
        prompt: p.prompt,
        aspect_ratio: p.aspectRatio === "1:1" ? "16:9" : p.aspectRatio, // veo only supports 16:9/9:16
        duration: nearestOf([4, 6, 8], p.duration ?? 8),
        seed: p.seed,
        generate_audio: true,
        ...(p.imageUrl && { image: p.imageUrl }),
      };
    case "wan":
      return {
        prompt: p.prompt,
        aspect_ratio: p.aspectRatio,
        base_model: "14b",
        video_length: Math.min(5, Math.max(1, p.duration ?? 5)),
        seed: p.seed,
      };
    case "hailuo":
      if (!p.imageUrl) {
        throw new Error("Hailuo requires a starting image — generate this shot's preview image first.");
      }
      return {
        first_frame_image: p.imageUrl,
        last_frame_image: null,
        prompt: p.prompt,
        duration: nearestOf([6, 10], p.duration ?? 6),
        prompt_optimizer: true,
      };
    case "seedance":
      // reference_images (up to 9) and first_frame_image are mutually exclusive on
      // Seedance 2.0 — this branch never sent an image field before, so there's
      // nothing to drop; reference_images is purely additive for character consistency.
      return {
        prompt: p.prompt,
        aspect_ratio: p.aspectRatio,
        duration: p.duration ?? 5,
        seed: p.seed,
        enhance_prompt: true,
        ...(p.referenceImages?.length && { reference_images: p.referenceImages }),
      };
    default: // any future model not yet given a specific mapping
      return {
        prompt: p.prompt,
        aspect_ratio: p.aspectRatio,
        duration: p.duration ?? 5,
        seed: p.seed,
        enhance_prompt: true,
      };
  }
}

export async function generateTextVideo(params: {
  apiKey: string;
  prompt?: string;
  model: VideoModelId;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: 5 | 10 | 15;
  cameraPreset?: string;
  viralPreset?: string;
  seed?: number;
  /** Required for hailuo (image-to-video only); ignored by models that don't use it. */
  imageUrl?: string;
  /** Seedance 2.0 only: up to 9 character-reference image URLs for cross-shot consistency. */
  referenceImages?: string[];
  /** When set, used as the base prompt instead of `prompt` — a "Shot 1: ... Shot 2: ..." script for one connected multi-shot sequence. */
  multiShotPrompt?: string;
}): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }> {
  const endpoint = VIDEO_ENDPOINTS[params.model];
  if (!endpoint) throw new Error(`Unknown model: ${params.model}`);

  let finalPrompt = params.multiShotPrompt ?? params.prompt ?? "";

  if (params.cameraPreset && CAMERA_PRESETS[params.cameraPreset]) {
    finalPrompt += `. ${CAMERA_PRESETS[params.cameraPreset].promptInjection}`;
  }

  if (params.viralPreset) {
    const vp = VIRAL_PRESETS.find(p => p.id === params.viralPreset);
    if (vp) finalPrompt += `. ${vp.promptInjection}`;
  }

  const body = buildVideoRequestBody(params.model, {
    prompt: finalPrompt,
    aspectRatio: params.aspectRatio ?? "16:9",
    duration: params.duration,
    seed: params.seed ?? Math.floor(Math.random() * 999999),
    imageUrl: params.imageUrl,
    referenceImages: params.referenceImages,
  });

  // v2 (async submit) instead of v1 (synchronous) — v1 endpoints have repeatedly
  // shown unpredictable multi-minute latency across several different models
  // (DoP, Hallo, Kling all observed exceeding 240s+ on v1). v2 returns a job
  // immediately instead of holding the connection open for the full render time,
  // which is what the app's existing generationStatus/status-polling routes were
  // actually built for in the first place.
  const res = await fetchWithTimeout(`https://api.segmind.com/v2/${endpoint}`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 60_000); // submission itself should return almost immediately

  if (!res.ok) throw new Error(`Video generation submit failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return { requestId: json.request_id, pollingUrl: json.status_url ?? `https://api.segmind.com/v2/requests/${json.request_id}/status` };
}

// ── LIPSYNC ───────────────────────────────────────────────────────────────────
// Segmind's "lipsync" models (pixverse-lipsync, sync.so-lipsync-2-pro) require an
// existing VIDEO plus audio, not a static photo — the previous implementation's
// "higgsfield-wan-text2video" + audio_url/talking_head contract didn't exist on
// Segmind at all (404 "Model information not found"). An interim fix animated the
// portrait into a base clip first (dop-lite, then hailuo-02-fast) then ran that
// through pixverse-lipsync — a real two-step pipeline, but unnecessary: Segmind's
// "hallo" model takes a plain photo (input_image) + audio (input_audio) directly
// in one call and produces a talking-head video, confirmed via
// segmind.com/models/hallo/api. This replaces the two-step workaround entirely.

export async function generateLipsync(params: {
  apiKey: string;
  audioUrl: string;
  characterImageUrl: string;
}): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }> {
  // Full-chapter narration can run minutes long, and Hallo's processing time scales
  // with audio length — no artificial cap here. (On Vercel in production this would
  // still be bounded by the platform's own serverless function ceiling regardless
  // of what's passed here; this matters only for this local test harness.)
  const res = await fetchWithTimeout(`${SEGMIND_BASE}/hallo`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      input_image: params.characterImageUrl,
      input_audio: params.audioUrl,
    }),
  }, 30 * 60_000);

  if (!res.ok) throw new Error(`Lipsync failed (${res.status}): ${await res.text()}`);
  const { mediaUrl, json } = await resolveMediaResponse(res, "video", "production-videos");
  if (mediaUrl) return { mediaUrl };
  return { requestId: json.request_id, pollingUrl: json.polling_url };
}

// ── STORYDIFFUSION (sequence-aware comic) ─────────────────────────────────────
// Segmind's StoryDiffusion keeps ONE character consistent across a whole multi-
// panel `comic_description` in a single call — the sequence-aware comic model the
// research called for, vs N independent generateSoulImage calls. Submitted async
// (v2) and polled with the same pollJob/extractMediaUrl path as video. The result
// is a single composed comic-strip page image (see src/lib/comic-gen/storydiffusion.ts
// notes). OPT-IN: kept alongside the proven per-panel path until cost/output-shape
// are confirmed with a real validation call.
export async function generateStoryDiffusion(params: {
  apiKey: string;
  characterDescription: string;
  comicDescription: string;
  styleName?: string;
  comicStyle?: "Classic Comic Style" | "Four Pannel";
  refImage?: string;
  numIds?: number;
  seed?: number;
}): Promise<{ requestId?: string; pollingUrl?: string; mediaUrl?: string }> {
  const body = buildStoryDiffusionBody(params);
  const res = await fetchWithTimeout(`https://api.segmind.com/v2/storydiffusion`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 60_000);
  if (!res.ok) throw new Error(`StoryDiffusion submit failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  if (extractMediaUrl(json)) return { mediaUrl: extractMediaUrl(json) };
  return { requestId: json.request_id, pollingUrl: json.status_url ?? `https://api.segmind.com/v2/requests/${json.request_id}/status` };
}

// ── POLLING ───────────────────────────────────────────────────────────────────

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "ERROR";

// Segmind's v2 result payload shape varies by model: `output` is sometimes an
// object with media_url/image_url/video_url sub-fields, but for Seedance 2.0
// (confirmed live) `output` is itself a plain URL string, with the same URL
// duplicated at `video.url`/`image.url`. Check the string case first since
// property access on a string silently returns undefined rather than throwing.
function extractMediaUrl(data: any): string | undefined {
  if (typeof data?.output === "string") return data.output;
  return data?.output?.media_url?.[0]
    ?? data?.output?.image_url
    ?? data?.output?.video_url
    ?? data?.video?.url
    ?? data?.image?.url;
}

export async function pollJob(params: {
  apiKey: string;
  pollingUrl: string;
}): Promise<{ status: JobStatus; mediaUrl?: string }> {
  const res = await fetchWithTimeout(params.pollingUrl, {
    headers: { "x-api-key": params.apiKey },
  });
  if (!res.ok) return { status: "ERROR" };
  const data = await res.json();
  let mediaUrl = extractMediaUrl(data);

  // v2's status endpoint may not embed the result directly even once COMPLETED —
  // fall back to the dedicated result endpoint (same URL minus the /status suffix,
  // or an explicit response_url if the status payload provided one).
  if (data.status === "COMPLETED" && !mediaUrl) {
    const resultUrl = data.response_url ?? params.pollingUrl.replace(/\/status$/, "");
    if (resultUrl !== params.pollingUrl) {
      const resultRes = await fetchWithTimeout(resultUrl, { headers: { "x-api-key": params.apiKey } });
      if (resultRes.ok) {
        const resultData = await resultRes.json();
        mediaUrl = extractMediaUrl(resultData);
      }
    }
  }

  return { status: data.status as JobStatus, mediaUrl };
}

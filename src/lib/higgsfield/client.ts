// src/lib/higgsfield/client.ts
// Higgsfield generation client.
// Image/video generation routes through Segmind proxy (api.segmind.com/v1).
// Soul ID training uses Higgsfield native cloud API (cloud.higgsfield.ai).

import { CAMERA_PRESETS, VIRAL_PRESETS } from "./presets";
import { VIDEO_ENDPOINTS, type VideoModelId } from "./models";

const SEGMIND_BASE  = "https://api.segmind.com/v1";
const HF_CLOUD_BASE = "https://cloud.higgsfield.ai/v1";

/** Wraps fetch with an abort timeout so a hung provider response can't block a request indefinitely. */
async function fetchWithTimeout(url: string, opts: RequestInit, ms = 120_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Generation timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

  const referenceId = params.soulId || params.referenceImageUrl;
  if (referenceId) {
    body.custom_reference_id       = referenceId;
    body.custom_reference_strength = params.soulId
      ? (params.referenceStrength ?? 0.95)
      : (params.referenceStrength ?? 0.85);
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

  const data = await res.json();
  const url = data.image_url ?? data.output?.image_url;
  if (!url) throw new Error("No image URL in Soul response");
  return url;
}

// ── SOUL ID TRAINING ──────────────────────────────────────────────────────────
// Uses native Higgsfield cloud API (not Segmind proxy)

export async function trainSoulId(params: {
  apiKey: string;
  apiSecret: string;
  characterName: string;
  referenceImageUrls: string[];
}): Promise<{ jobId: string }> {
  if (params.referenceImageUrls.length < 3) {
    throw new Error("Soul ID training requires at least 3 reference images");
  }

  const res = await fetchWithTimeout(`${HF_CLOUD_BASE}/characters/train`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.apiKey}:${params.apiSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.characterName,
      reference_images: params.referenceImageUrls,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Soul ID training failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { jobId: data.job_id ?? data.id };
}

export async function pollSoulIdTraining(params: {
  apiKey: string;
  apiSecret: string;
  jobId: string;
}): Promise<{ status: "processing" | "completed" | "failed"; soulId?: string }> {
  const res = await fetchWithTimeout(`${HF_CLOUD_BASE}/characters/train/${params.jobId}`, {
    headers: {
      "Authorization": `Bearer ${params.apiKey}:${params.apiSecret}`,
    },
  });

  if (!res.ok) return { status: "failed" };

  const data = await res.json();
  if (data.status === "completed") {
    return { status: "completed", soulId: data.soul_id ?? data.character_id };
  }
  if (data.status === "failed") return { status: "failed" };
  return { status: "processing" };
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
}): Promise<{ requestId: string; pollingUrl: string }> {
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
  });

  if (!res.ok) throw new Error(`DoP video failed (${res.status})`);
  const data = await res.json();
  return {
    requestId: data.request_id,
    pollingUrl: data.polling_url ?? `${SEGMIND_BASE}/requests/${data.request_id}`,
  };
}

// ── TEXT-TO-VIDEO ─────────────────────────────────────────────────────────────

export async function generateTextVideo(params: {
  apiKey: string;
  prompt: string;
  model: VideoModelId;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: 5 | 10 | 15;
  cameraPreset?: string;
  viralPreset?: string;
  seed?: number;
}): Promise<{ requestId: string; pollingUrl: string }> {
  const endpoint = VIDEO_ENDPOINTS[params.model];
  if (!endpoint) throw new Error(`Unknown model: ${params.model}`);

  let finalPrompt = params.prompt;

  if (params.cameraPreset && CAMERA_PRESETS[params.cameraPreset]) {
    finalPrompt += `. ${CAMERA_PRESETS[params.cameraPreset].promptInjection}`;
  }

  if (params.viralPreset) {
    const vp = VIRAL_PRESETS.find(p => p.id === params.viralPreset);
    if (vp) finalPrompt += `. ${vp.promptInjection}`;
  }

  const res = await fetchWithTimeout(`${SEGMIND_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: finalPrompt,
      aspect_ratio: params.aspectRatio ?? "16:9",
      duration: params.duration ?? 5,
      seed: params.seed ?? Math.floor(Math.random() * 999999),
      enhance_prompt: true,
    }),
  });

  if (!res.ok) throw new Error(`Video generation failed (${res.status})`);
  const data = await res.json();
  return { requestId: data.request_id, pollingUrl: data.polling_url };
}

// ── LIPSYNC (WAN 2.5) ────────────────────────────────────────────────────────

export async function generateLipsync(params: {
  apiKey: string;
  prompt: string;
  audioUrl: string;
  characterImageUrl: string;
  soulId?: string;
  seed?: number;
}): Promise<{ requestId: string; pollingUrl: string }> {
  let finalPrompt = params.prompt;
  if (params.soulId) {
    finalPrompt += `. Maintain character consistency with Soul ID reference.`;
  }

  const res = await fetchWithTimeout(`${SEGMIND_BASE}/higgsfield-wan-text2video`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: finalPrompt,
      audio_url: params.audioUrl,
      reference_image_url: params.soulId ? undefined : params.characterImageUrl,
      custom_reference_id: params.soulId || undefined,
      aspect_ratio: "9:16",
      duration: 10,
      seed: params.seed ?? Math.floor(Math.random() * 999999),
      enhance_prompt: true,
      talking_head: true,
    }),
  });

  if (!res.ok) throw new Error(`Lipsync failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { requestId: data.request_id, pollingUrl: data.polling_url };
}

// ── POLLING ───────────────────────────────────────────────────────────────────

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "ERROR";

export async function pollJob(params: {
  apiKey: string;
  pollingUrl: string;
}): Promise<{ status: JobStatus; mediaUrl?: string }> {
  const res = await fetchWithTimeout(params.pollingUrl, {
    headers: { "x-api-key": params.apiKey },
  });
  if (!res.ok) return { status: "ERROR" };
  const data = await res.json();
  return {
    status: data.status as JobStatus,
    mediaUrl: data.output?.media_url?.[0] ?? data.output?.image_url,
  };
}

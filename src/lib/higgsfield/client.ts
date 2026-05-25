const BASE = "https://api.segmind.com/v1";

// ── IMAGE GENERATION (Soul 2.0) ──────────────────────────────────────────────

export async function generateSoulImage(params: {
  apiKey: string;
  prompt: string;
  stylePreset?: string;
  referenceImageUrl?: string;
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
  if (params.stylePreset)       body.style_preset = params.stylePreset;
  if (params.referenceImageUrl) {
    body.custom_reference_id       = params.referenceImageUrl;
    body.custom_reference_strength = params.referenceStrength ?? 0.85;
  }
  if (params.width)  body.width  = params.width;
  if (params.height) body.height = params.height;

  const res = await fetch(`${BASE}/higgsfield-text2image-soul`, {
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

// ── IMAGE-TO-VIDEO (DoP) ──────────────────────────────────────────────────────

export async function generateDoPVideo(params: {
  apiKey: string;
  prompt: string;
  imageUrl: string;
  model?: "dop-lite" | "dop-turbo" | "dop-preview";
  motionStrength?: number;
  seed?: number;
}): Promise<{ requestId: string; pollingUrl: string }> {
  const res = await fetch(`${BASE}/higgsfield-image2video`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model ?? "dop-turbo",
      prompt: params.prompt,
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
    pollingUrl: data.polling_url ?? `${BASE}/requests/${data.request_id}`,
  };
}

// ── TEXT-TO-VIDEO ─────────────────────────────────────────────────────────────

const VIDEO_ENDPOINTS: Record<string, string> = {
  kling:    "higgsfield-kling-text2video",
  veo:      "higgsfield-veo-text2video",
  sora:     "higgsfield-sora-text2video",
  seedance: "higgsfield-seedance-text2video",
  wan:      "higgsfield-wan-text2video",
};

export async function generateTextVideo(params: {
  apiKey: string;
  prompt: string;
  model: "kling" | "veo" | "sora" | "seedance" | "wan";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: 5 | 10 | 15;
  seed?: number;
}): Promise<{ requestId: string; pollingUrl: string }> {
  const endpoint = VIDEO_ENDPOINTS[params.model];
  if (!endpoint) throw new Error(`Unknown model: ${params.model}`);
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
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

// ── POLLING ───────────────────────────────────────────────────────────────────

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "ERROR";

export async function pollJob(params: {
  apiKey: string;
  pollingUrl: string;
}): Promise<{ status: JobStatus; mediaUrl?: string }> {
  const res = await fetch(params.pollingUrl, {
    headers: { "x-api-key": params.apiKey },
  });
  if (!res.ok) return { status: "ERROR" };
  const data = await res.json();
  return {
    status: data.status as JobStatus,
    mediaUrl: data.output?.media_url?.[0] ?? data.output?.image_url,
  };
}

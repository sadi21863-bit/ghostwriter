// src/lib/higgsfield/models.ts
// Single source of truth for Higgsfield/Segmind video model identity.
// VIDEO_ENDPOINTS, VIDEO_MODEL_INFO, ACTIVE_VIDEO_MODELS, and MODE_TO_MODEL are
// all derived from VIDEO_MODELS — add, update, or deprecate a model here only.

export type VideoModelId = string;

export interface VideoModelDef {
  id: VideoModelId;
  segmindEndpoint: string;
  label: string;
  note: string;
  badge: string | null;
  generatesAudio: boolean;
  bestFor: string[];
  /** Never auto-selected (MODE_TO_MODEL / AI suggestion) when true; excluded from ACTIVE_VIDEO_MODELS. */
  deprecated?: boolean;
}

export const VIDEO_MODELS: Record<VideoModelId, VideoModelDef> = {
  kling: {
    id: "kling",
    segmindEndpoint: "higgsfield-kling-text2video",
    label: "Kling 3.0",
    note: "Physics-aware · 4K · Best for action",
    badge: null,
    generatesAudio: false,
    bestFor: ["action", "combat"],
  },
  veo: {
    id: "veo",
    segmindEndpoint: "higgsfield-veo-text2video",
    label: "Veo 3.1",
    note: "Realistic · Cinematic · Native audio",
    badge: "AUDIO",
    generatesAudio: true,
    bestFor: ["realism", "drama", "nature"],
  },
  sora: {
    id: "sora",
    segmindEndpoint: "higgsfield-sora-text2video",
    label: "Sora 2",
    note: "Stylized · Narrative · Best for drama",
    badge: null,
    generatesAudio: false,
    bestFor: ["drama", "fantasy", "stylized"],
    deprecated: true,
  },
  seedance: {
    id: "seedance",
    segmindEndpoint: "higgsfield-seedance-text2video",
    label: "Seedance 2.0",
    note: "Fast · Social content · Best for shorts",
    badge: null,
    generatesAudio: false,
    bestFor: ["social", "shorts", "quick"],
  },
  wan: {
    id: "wan",
    segmindEndpoint: "higgsfield-wan-text2video",
    label: "WAN 2.5",
    note: "Talking heads · Lip-sync · Avatars",
    badge: null,
    generatesAudio: false,
    bestFor: ["avatar", "talking_head", "lipsync"],
  },
  hailuo: {
    id: "hailuo",
    segmindEndpoint: "higgsfield-hailuo-text2video",
    label: "Hailuo 02",
    note: "Smooth motion · Cinematic quality",
    badge: "NEW",
    generatesAudio: false,
    bestFor: ["cinematic", "smooth", "general"],
  },
};

/** Models eligible for manual selection or auto-selection — deprecated entries excluded. */
export const ACTIVE_VIDEO_MODELS: VideoModelDef[] =
  Object.values(VIDEO_MODELS).filter(m => !m.deprecated);

export const VIDEO_ENDPOINTS: Record<VideoModelId, string> = Object.fromEntries(
  Object.values(VIDEO_MODELS).map(m => [m.id, m.segmindEndpoint])
);

export const VIDEO_MODEL_INFO: Record<VideoModelId, {
  label: string;
  note: string;
  badge: string | null;
  bestFor: string[];
  generatesAudio: boolean;
}> = Object.fromEntries(
  Object.values(VIDEO_MODELS).map(m => [m.id, {
    label: m.label,
    note: m.note,
    badge: m.badge,
    bestFor: m.bestFor,
    generatesAudio: m.generatesAudio,
  }])
);

/** Maps a generation mode to the video model best suited for converting its scenes. */
export const MODE_TO_MODEL: Record<string, VideoModelId> = {
  combat:     "kling",
  horror:     "veo",
  comedy:     "seedance",
  romance:    "veo",
  dialogue:   "veo",
  atmosphere: "veo",
  tension:    "kling",
  emotional:  "veo",
  default:    "kling",
};

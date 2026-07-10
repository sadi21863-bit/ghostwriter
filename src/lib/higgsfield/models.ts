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
    // Confirmed against Segmind's own docs (segmind.com/models/kling-text2video/api) —
    // the "higgsfield-" prefix this codebase previously used doesn't exist on Segmind's
    // side and 404s. Real Higgsfield-branded endpoints (text2image-soul, image2video)
    // do use that prefix; these third-party model brands don't.
    segmindEndpoint: "kling-text2video",
    label: "Kling 3.0",
    note: "Physics-aware · 4K · Best for action",
    badge: null,
    generatesAudio: false,
    bestFor: ["action", "combat"],
  },
  veo: {
    id: "veo",
    segmindEndpoint: "veo-3.1-fast", // confirmed via segmind.com/models/veo-3.1-fast/api
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
    segmindEndpoint: "seedance-2.0", // confirmed via segmind.com/models/seedance-2.0/api
    label: "Seedance 2.0",
    note: "Fast · Social content · Best for shorts",
    badge: null,
    generatesAudio: false,
    bestFor: ["social", "shorts", "quick"],
  },
  wan: {
    id: "wan",
    // Plain text2video only — this entry has never had any lipsync/avatar capability
    // despite the label this replaced claiming otherwise (real audio lipsync is a
    // fully separate, already-working feature: generateLipsync() below calls the
    // dedicated /hallo endpoint with input_image/input_audio, nothing to do with
    // this model or wan2.1-t2v's actual contract). Found + fixed via live research
    // into Segmind's real Wan catalog (item 70): Alibaba/Segmind have since shipped
    // Wan 2.2, 2.5, 2.6, and 2.7 — see `wan-r2v` below for the newer
    // character-consistent Wan 2.7 Reference-to-Video model, added alongside this
    // fix. Left wan2.1-t2v itself unchanged (still a real, working, cheap plain
    // text2video endpoint) rather than guessing at a newer t2v endpoint's contract
    // without a live call to confirm it.
    segmindEndpoint: "wan2.1-t2v", // confirmed via segmind.com/models/wan2.1-t2v/api
    label: "WAN 2.1",
    note: "Fast · Budget text-to-video",
    badge: null,
    generatesAudio: false,
    bestFor: ["quick", "budget"],
  },
  "wan-r2v": {
    id: "wan-r2v",
    // Wan 2.7 Reference-to-Video: character-consistent video generation straight
    // from reference photos, no Soul ID training job required. Confirmed via
    // Segmind's own blog (blog.segmind.com/wan-2-7-reference-to-video-is-now-on-segmind)
    // — real endpoint/schema, not guessed. Added as a new opt-in model, not wired
    // as a default anywhere: it has not been live-verified with a real call (no
    // remaining budget at the time this was added), so ACTIVE_VIDEO_MODELS still
    // treats it like any other selectable model but nothing auto-selects it yet.
    segmindEndpoint: "wan2.7-r2v",
    label: "WAN 2.7 R2V",
    note: "Character-consistent · From reference photos",
    badge: "NEW",
    generatesAudio: false,
    bestFor: ["consistency", "character"],
  },
  hailuo: {
    id: "hailuo",
    segmindEndpoint: "hailuo-02-fast", // confirmed via segmind.com/models/hailuo-02-fast/api
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

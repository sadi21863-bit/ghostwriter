import { generateSoulImage, generateTextVideo, pollJob } from "@/lib/higgsfield/client";
import type { ImageProvider, VideoProvider } from "../providers";

export const SegmindImageProvider: ImageProvider = {
  id: "segmind_soul", name: "Segmind (Soul 2.0)",
  description: "Character-consistent portrait generation. Recommended.", requiresKey: true,
  async generate(params, apiKey) {
    const url = await generateSoulImage({
      apiKey, prompt: params.prompt, stylePreset: params.stylePreset,
      referenceImageUrl: params.referenceImageUrl, soulId: params.soulId,
      referenceStrength: params.referenceStrength,
      width: params.width, height: params.height,
    });
    return { url, async: false };
  },
};

export const SegmindVideoProvider: VideoProvider = {
  id: "segmind_video", name: "Segmind Video", requiresKey: true,
  models: [
    { id: "kling",    label: "Kling 3.0",  note: "Physics-aware, 4K" },
    { id: "veo",      label: "Veo 3.1",    note: "Realistic/cinematic" },
    { id: "sora",     label: "Sora 2",     note: "Stylized narrative" },
    { id: "seedance", label: "Seedance",   note: "Smooth motion" },
    { id: "wan",      label: "Wan",        note: "Fast generation" },
  ],
  async generate(params, apiKey) {
    const result = await generateTextVideo({
      apiKey, prompt: params.prompt, model: params.model as any,
      aspectRatio: params.aspectRatio as any, duration: params.duration as any,
    });
    return { requestId: result.requestId, pollingUrl: result.pollingUrl, async: true };
  },
  async pollJob(apiKey, pollingUrl) {
    return pollJob({ apiKey, pollingUrl });
  },
};

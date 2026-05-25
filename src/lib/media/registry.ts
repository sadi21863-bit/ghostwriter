import { SegmindImageProvider, SegmindVideoProvider } from "./adapters/segmind";
import { OpenAIImageProvider } from "./adapters/openai-image";
import type { ImageProvider, VideoProvider } from "./providers";

export const IMAGE_PROVIDERS: ImageProvider[] = [SegmindImageProvider, OpenAIImageProvider];
export const VIDEO_PROVIDERS: VideoProvider[] = [SegmindVideoProvider];

export const getImageProvider = (id: string): ImageProvider =>
  IMAGE_PROVIDERS.find(p => p.id === id) ?? SegmindImageProvider;
export const getVideoProvider = (id: string): VideoProvider =>
  VIDEO_PROVIDERS.find(p => p.id === id) ?? SegmindVideoProvider;

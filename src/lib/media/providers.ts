export interface ImageGenerationParams {
  prompt: string; stylePreset?: string; referenceImageUrl?: string;
  referenceStrength?: number; width?: number; height?: number;
}

export interface VideoGenerationParams {
  prompt: string; model: string; aspectRatio?: "16:9" | "9:16" | "1:1"; duration?: number;
}

export interface GenerationResult {
  url?: string; requestId?: string; pollingUrl?: string; async: boolean;
}

export interface ImageProvider {
  id: string; name: string; description: string; requiresKey: boolean;
  generate(params: ImageGenerationParams, apiKey: string): Promise<GenerationResult>;
}

export interface VideoProvider {
  id: string; name: string; models: { id: string; label: string; note: string }[];
  requiresKey: boolean;
  generate(params: VideoGenerationParams, apiKey: string): Promise<GenerationResult>;
  pollJob?(apiKey: string, pollingUrl: string): Promise<{ status: string; mediaUrl?: string }>;
}

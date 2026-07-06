import { isValidTipTapJson, tiptapToPlainText } from "@/lib/editor/content-migration";

// Pure preview-derivation for the showcase area — auto-derives a small, fixed
// preview shape from data a project already has (no new content generation,
// no manual multi-asset picker UI for v1; see the showcase plan's "curation
// over completeness" reasoning).

export interface ShowcaseSourceProject {
  chapters?: { content?: string | null; sortOrder?: number | null }[];
  characters?: { portraitUrl?: string | null }[];
  comicPanels?: { letteredImageUrl?: string | null; imageUrl?: string | null }[];
  productionShots?: { previewImageUrl?: string | null; sceneFinalVideoUrl?: string | null }[];
}

export interface ShowcasePreview {
  coverImageUrl: string | null;
  excerpt: string;
  previewImages: string[];
  previewVideoUrl: string | null;
}

const EXCERPT_MAX_CHARS = 400;

function firstChapterExcerpt(chapters: ShowcaseSourceProject["chapters"]): string {
  const sorted = [...(chapters ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const first = sorted.find(c => c.content?.trim());
  if (!first?.content) return "";
  const plain = isValidTipTapJson(first.content) ? tiptapToPlainText(JSON.parse(first.content)) : first.content;
  const trimmed = plain.trim();
  return trimmed.length > EXCERPT_MAX_CHARS ? trimmed.slice(0, EXCERPT_MAX_CHARS).trimEnd() + "…" : trimmed;
}

export function buildShowcasePreview(project: ShowcaseSourceProject): ShowcasePreview {
  const panelImages = (project.comicPanels ?? [])
    .map(p => p.letteredImageUrl || p.imageUrl)
    .filter((u): u is string => !!u);
  const shotImages = (project.productionShots ?? [])
    .map(s => s.previewImageUrl)
    .filter((u): u is string => !!u);
  const portraits = (project.characters ?? [])
    .map(c => c.portraitUrl)
    .filter((u): u is string => !!u);

  const coverImageUrl = panelImages[0] || portraits[0] || shotImages[0] || null;
  const previewImages = (panelImages.length > 0 ? panelImages : shotImages).slice(0, 3);
  const previewVideoUrl = (project.productionShots ?? []).map(s => s.sceneFinalVideoUrl).find((u): u is string => !!u) ?? null;

  return {
    coverImageUrl,
    excerpt: firstChapterExcerpt(project.chapters),
    previewImages,
    previewVideoUrl,
  };
}

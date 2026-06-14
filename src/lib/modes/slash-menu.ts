// src/lib/modes/slash-menu.ts
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { MODES, isStoryFormat } from "@/lib/formats";

/** Modes selectable via the writing room's slash menu for a given project format. */
export function getVisibleModes(format: string): GenerationMode[] {
  if (format === "Podcast Episode") return ["brainstorm", "outline", "write"];
  if (isStoryFormat(format)) return MODES;
  return MODES.filter(m => MODE_REGISTRY[m].visibility !== "story_only");
}

/**
 * Filters modes by a slash-menu query, matching each mode's slash command, label,
 * and keywords. An empty (or whitespace-only) query returns the given modes unchanged.
 */
export function filterModesByQuery(query: string, modes: GenerationMode[]): GenerationMode[] {
  const q = query.trim().toLowerCase();
  if (!q) return modes;
  return modes.filter(m => {
    const config = MODE_REGISTRY[m];
    if (config.slash.slice(1).toLowerCase().startsWith(q)) return true;
    if (config.label.toLowerCase().includes(q)) return true;
    return config.keywords.some(k => k.toLowerCase().includes(q));
  });
}

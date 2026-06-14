// src/lib/modes/classify.ts
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";

/** The 23 library modes (all generation modes except brainstorm/outline/write), in registry order. */
export const LIBRARY_MODES: GenerationMode[] = [
  "dialogue", "combat", "emotional", "atmosphere", "tension", "composition",
  "horror", "comedy", "mystery", "romance", "action", "monologue", "voice",
  "thriller", "sports", "setting", "historical", "scitech", "ethics",
  "endings", "isekai", "interrogation", "chase",
];

/**
 * Classifies free-form beat/prompt text against each candidate mode's keywords,
 * returning the mode with the most whole-word (case-insensitive) keyword matches.
 * Ties go to whichever candidate appears first in `candidates`. Returns null if
 * the text is empty or no candidate's keywords match.
 */
export function classifyBeat(text: string, candidates: GenerationMode[] = LIBRARY_MODES): GenerationMode | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let best: GenerationMode | null = null;
  let bestScore = 0;
  for (const mode of candidates) {
    let score = 0;
    for (const keyword of MODE_REGISTRY[mode].keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(trimmed)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = mode;
    }
  }
  return best;
}

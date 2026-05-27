// src/lib/compact/index.ts
// Context compaction utility.
// When the Composition layer is active, multiple libraries inject large context blocks.
// This module trims the full context to stay within model limits while preserving
// the highest-value sections (directives, failure modes, system rules).

const SECTION_WEIGHTS: [string, number][] = [
  ["COMPOSITION MODE",         100],
  ["COMPOSITION INTERSECTION", 100],
  ["DIRECTIVE:",                90],
  ["SYSTEM DIRECTIVES",         90],
  ["FAILURE MODES",             85],
  ["ABSOLUTE RULES",            85],
  ["FACS SIGNATURE",            80],
  ["SOMATIC SIGNATURE",         80],
  ["INFORMATION STATE",         80],
  ["TENSION LIBRARY",           75],
  ["EMOTIONAL SCENE LIBRARY",   75],
  ["HORROR LIBRARY",            75],
  ["COMEDY LIBRARY",            75],
  ["ATMOSPHERE LIBRARY",        70],
  ["COMBAT LIBRARY",            70],
  ["MATCHUP:",                  65],
  ["STYLE:",                    60],
  ["PSYCHOLOGICAL EFFECT",      60],
  ["SENSORY LAYERS",            60],
];

function scoreSection(section: string): number {
  const upper = section.slice(0, 200).toUpperCase();
  let best = 0;
  for (const [key, weight] of SECTION_WEIGHTS) {
    if (upper.includes(key)) best = Math.max(best, weight);
  }
  return best;
}

/**
 * Compact a context string to `maxChars`, preserving highest-priority sections.
 * Sections are split on double newlines. High-priority sections are kept first.
 * If a section would overflow, it is truncated with a [compacted] marker.
 */
export function compactContext(context: string, maxChars = 14000): string {
  if (context.length <= maxChars) return context;

  const sections = context.split(/\n{2,}/).filter(s => s.trim().length > 0);

  // Score and sort descending
  const scored = sections
    .map(s => ({ s, score: scoreSection(s) }))
    .sort((a, b) => b.score - a.score);

  const kept: string[] = [];
  let used = 0;

  for (const { s } of scored) {
    const needed = s.length + 2; // +2 for \n\n separator
    if (used + needed <= maxChars) {
      kept.push(s);
      used += needed;
    } else {
      const remaining = maxChars - used - 2;
      if (remaining > 120) {
        kept.push(s.substring(0, remaining) + "\n...[compacted]");
        used += remaining + 14;
      }
      break;
    }
  }

  return kept.join("\n\n");
}

/**
 * Compact the story context only (the part after the library injections).
 * Used to shorten World Bible entries when multiple technique libraries are active.
 */
export function compactStoryContext(storyContext: string, maxChars = 6000): string {
  if (storyContext.length <= maxChars) return storyContext;

  const lines = storyContext.split("\n");
  const kept: string[] = [];
  let used = 0;

  for (const line of lines) {
    if (used + line.length + 1 > maxChars) break;
    kept.push(line);
    used += line.length + 1;
  }

  return kept.join("\n") + "\n...[story context compacted]";
}

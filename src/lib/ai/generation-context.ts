/**
 * Context assembly for /api/ai/generate (v4 §7 `generateChapter`).
 *
 * Extracted from the route so the assembly order — aiisms → series/universe →
 * research → prose augmentation — lives in one reviewable module instead of an
 * inline block. The DB-coupled bible builders move VERBATIM (byte-identical
 * wire contract); the pure helpers are what a local Story OS host can reuse
 * without inheriting the Neon schema.
 *
 * Byte-identical migration from the route:
 * - `applyModePromptDirective` produces exactly the brainstorm/outline suffixes
 *   the route appended when `effectivePrompt` was computed inline.
 * - `appendSeriesContext` is the `'\n\n---\n'` join that placed server-derived
 *   series/universe context AFTER the tier cap (never truncated by a
 *   client-inflated static block).
 * - `composeDynamicContext` is the filter(Boolean).join('\n\n') used for both
 *   `effectiveDynamic` and `finalDynamic`.
 * - `shouldRunProseAugmentation` is the exact qualification gate that kept
 *   non-qualifying requests at zero added latency.
 */
import { and, eq, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  seriesBibles,
  universeCharacters,
  universeEvents,
  universes,
  projects,
} from "@/db/schema";
import { isProseMode, type GenerationMode } from "@/lib/modes/registry";

// ── pure: prompt transform ────────────────────────────────────────────────

/**
 * Brainstorm/outline mode directives. The suffix is appended AFTER tier capping
 * (it is policy, not user content, and must never be truncated away).
 */
export function applyModePromptDirective(mode: string, cappedPrompt: string): string {
  if (mode === "brainstorm") {
    return (
      cappedPrompt +
      `\n\nReturn exactly 3 distinct structural approaches as options. Do not pick one.\nFormat strictly:\n\nOPTION A — [SHORT NAME]:\n[2-3 sentences describing the structural direction, opening, key tension]\n\nOPTION B — [SHORT NAME]:\n[2-3 sentences describing a different structural direction]\n\nOPTION C — [SHORT NAME]:\n[2-3 sentences describing a third structural direction]\n\n---\nEach option must represent a genuinely different creative direction, not variations of the same idea.\nOne option should subvert expectations.`
    );
  }
  if (mode === "outline") {
    return (
      cappedPrompt +
      `\n\nFormat each beat as a numbered list item starting with "BEAT:":\nBEAT: [beat description in present tense, 1-2 sentences]\n\nGenerate 6-12 beats appropriate for this story. Each beat should describe what happens in the scene and what changes as a result.`
    );
  }
  return cappedPrompt;
}

// ── pure: static/dynamic composition ──────────────────────────────────────

/**
 * Series/universe context is appended AFTER the tier cap so server-derived
 * context is never truncated by a client-inflated static block.
 */
export function appendSeriesContext(cappedStatic: string | undefined, seriesCtx: string): string | undefined {
  return seriesCtx ? (cappedStatic ?? "") + "\n\n---\n" + seriesCtx : cappedStatic;
}

/** Parts are joined in order with '\n\n', empty/undefined parts dropped. */
export function composeDynamicContext(parts: (string | undefined | null | false)[]): string {
  return parts.filter(Boolean).join("\n\n");
}

/** Research modes with no synthetic craft library — grounded via web/Gemini. */
const RESEARCH_MODES = new Set(["historical", "scitech", "sports", "setting"]);
export const isResearchMode = (mode: string): boolean => RESEARCH_MODES.has(mode);

/**
 * Qualification gate for the prose-augmentation helpers (promise ledger, voice
 * exemplars, author voice, blueprint): prose modes only, project-scoped, never
 * free tier. Checked before anything else so non-qualifying requests pay zero
 * added latency.
 */
export function shouldRunProseAugmentation(
  mode: GenerationMode,
  projectId: string | undefined,
  tier: string,
): boolean {
  return isProseMode(mode) && !!projectId && tier !== "free";
}

// ── DB-coupled bible builders (moved verbatim from the route) ─────────────

export async function buildSeriesUniverseContext(proj: any, userId: string): Promise<string> {
  if (!proj) return "";
  const lines: string[] = [];

  // SERIES: walk seriesParentId chain to collect previous stories' key events
  if (proj.storyType === "series" && proj.seriesParentId) {
    const previousStories: any[] = [];
    let currentId: string | null = proj.seriesParentId;
    let depth = 0;
    while (currentId && depth < 10) {
      const prev = await db.query.projects.findFirst({
        where: and(eq(projects.id, currentId), eq(projects.userId, userId)),
        columns: { id: true, name: true, seriesParentId: true },
        with: { storyMemories: { limit: 5, orderBy: (m, { desc }) => [desc(m.createdAt)] } },
      });
      if (!prev) break;
      previousStories.unshift(prev);
      currentId = (prev as any).seriesParentId ?? null;
      depth++;
    }
    if (previousStories.length > 0) {
      lines.push("SERIES CONTEXT — events from previous books that inform this story:");
      previousStories.forEach((story: any, i: number) => {
        lines.push(`\nBook ${i + 1}: ${story.name}`);
        if (story.storyMemories?.length) {
          story.storyMemories.forEach((m: any) => {
            if (m.structuredData?.keyEvents?.length) {
              lines.push(`  Key: ${m.structuredData.keyEvents.join(" | ")}`);
            } else if (m.fact) {
              lines.push(`  - ${m.fact}`);
            }
          });
        }
      });
    }
  }

  // UNIVERSE: inject the universe's own premise/tone/sharedRules, plus canonical events
  // and character states from earlier-positioned stories. The premise/tone/sharedRules
  // half was previously missing entirely — this function only ever queried
  // universeEvents/universeCharacters, never the universes table itself, so a
  // universe's own foundational world rules could never reach generation regardless
  // of timelineSort. Mirrors the equivalent series-bible pattern below.
  if (proj.storyType === "universe-story" && proj.universeId) {
    const universe = await db.query.universes.findFirst({ where: eq(universes.id, proj.universeId) });
    if (universe) {
      lines.push(`UNIVERSE: "${universe.name}"`);
      if (universe.premise) lines.push(`Premise: ${universe.premise}`);
      if (universe.tone) lines.push(`Tone: ${universe.tone}`);
      const sharedRules = (universe.sharedRules as string[] | null) ?? [];
      if (sharedRules.length > 0) {
        lines.push("Shared rules (must hold across every story in this universe):");
        sharedRules.forEach((r) => lines.push(`- ${r}`));
      }
    }
  }

  if (proj.storyType === "universe-story" && proj.universeId && proj.timelineSort != null) {
    const canonEvents = await db.query.universeEvents.findMany({
      where: and(
        eq(universeEvents.universeId, proj.universeId),
        eq(universeEvents.isCanon, true),
        lte(universeEvents.timelineSort, (proj.timelineSort ?? 0) - 1)
      ),
      orderBy: (e, { asc }) => [asc(e.timelineSort)],
      limit: 15,
    });
    if (canonEvents.length > 0) {
      lines.push("UNIVERSE CANON — events established before this story:");
      canonEvents.forEach((e: any) => {
        lines.push(`- ${e.name}${e.description ? ": " + e.description : ""}`);
      });
    }

    // Universe characters with states from prior stories
    const uniChars = await db.query.universeCharacters.findMany({
      where: eq(universeCharacters.universeId, proj.universeId),
      with: { states: true },
    });
    const priorProjs = await db.query.projects.findMany({
      where: and(eq(projects.universeId, proj.universeId), ne(projects.id, proj.id)),
      columns: { id: true, timelineSort: true },
    });
    const priorProjIds = new Set(
      priorProjs
        .filter((p: any) => (p.timelineSort ?? 0) < (proj.timelineSort ?? 0))
        .map((p: any) => p.id)
    );
    if (uniChars.length > 0) {
      const charLines: string[] = [];
      for (const char of uniChars) {
        const priorState = (char as any).states
          ?.filter((s: any) => priorProjIds.has(s.projectId))
          .sort((a: any, b: any) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))[0];
        if (priorState?.isDeceased) {
          charLines.push(`${char.name}: DECEASED (do not include in this story)`);
          continue;
        }
        const parts: string[] = [`${char.name}:`];
        const baseProfile = (char as any).baseProfile as any;
        if (baseProfile?.role) parts.push(`  Role: ${baseProfile.role}`);
        if (priorState?.emotionalState) parts.push(`  State: ${priorState.emotionalState}`);
        if (priorState?.stateNotes) parts.push(`  History: ${priorState.stateNotes}`);
        charLines.push(parts.join("\n"));
      }
      if (charLines.length > 0) {
        lines.push("\nUNIVERSE CHARACTERS — state at the start of this story:");
        lines.push(...charLines);
      }
    }
  }

  return lines.length > 0 ? "\n\n--- STORY UNIVERSE ---\n" + lines.join("\n") : "";
}

export async function buildSeriesBibleContext(projectId: string, userId: string): Promise<string> {
  const bibles = await db.query.seriesBibles.findMany({ where: eq(seriesBibles.userId, userId) });
  const bible = bibles.find((b: any) => (b.projectIds as string[] | null)?.includes(projectId));
  if (!bible) return "";

  const lines: string[] = [`Series: "${bible.name}"`];
  if (bible.premise) lines.push(`Premise: ${bible.premise}`);
  if (bible.tone) lines.push(`Tone: ${bible.tone}`);

  const worldRules = (bible.worldRules as string[] | null) ?? [];
  if (worldRules.length > 0) {
    lines.push("World rules (must hold across every book in this series):");
    worldRules.forEach((r) => lines.push(`- ${r}`));
  }

  const arcs = (bible.seriesCharacterArcs as { characterName: string; arcSummary: string; booksInvolved: string[] }[] | null) ?? [];
  if (arcs.length > 0) {
    lines.push("Series-spanning character arcs:");
    arcs.forEach((a) => lines.push(`- ${a.characterName}: ${a.arcSummary}${a.booksInvolved?.length ? ` (books: ${a.booksInvolved.join(", ")})` : ""}`));
  }

  if (bible.continuityNotes) lines.push(`Continuity notes: ${bible.continuityNotes}`);

  const timeline = (bible.timeline as { event: string; period: string; projectId?: string }[] | null) ?? [];
  if (timeline.length > 0) {
    lines.push("Series timeline:");
    timeline.forEach((t) => lines.push(`- ${t.period ? `[${t.period}] ` : ""}${t.event}`));
  }

  return lines.length > 1 ? "\n\n--- SERIES BIBLE ---\n" + lines.join("\n") : "";
}

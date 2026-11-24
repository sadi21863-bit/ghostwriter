/**
 * Master-plan Phase 4 slice 4d (§9 sketch items 1, 2, and 5's port set) — the
 * §2.7 local composition of the cloud context half.
 *
 * The cloud route's `buildContext` (src/app/api/ai/generate/route.ts) is a
 * thin server-side assembly: the World Bible content itself rides in from the
 * client, and the route adds, in order, the size ceiling → the tier cap →
 * `applyModePromptDirective` → the aiisms note → the series/universe context
 * → the series bible → domain research → `composeDynamicContext` → the
 * prose-augmentation pre-passes. This module binds the pieces a SINGLE-OWNER
 * local host can honor, over the SQLite twins (`src/db/sqlite-schema.ts` —
 * the §2.7 open item), with EVERY read scoped to the ONE `localOwnerId`
 * users row (§5.6 — the owner IS the actor). The ceiling pre-spend guard and
 * the mode prompt directive are the MOUNT's own assembly (local-host.ts
 * already applies both around a planted bundle's buildContext) — do NOT
 * re-check them here; and there is NO recordPrompt bookkeeping here (locally
 * there is no tier cap, so `persist` records `req.prompt` — the raw body
 * prompt — which IS the cloud route's recordPrompt parity).
 *
 * The settled absences, each a named settled decision — nothing above this
 * list is silently claimed:
 *  - no aiisms note / domain research: §2.2 opens those decisions locally,
 *    and research is GEMINI-keyed server work;
 *  - no voice-exemplars / author-voice: embedding-based, and the §4.2
 *    degrade keeps embeddings off in the local baseline (noEmbedText);
 *  - no scene-blueprint: the Haiku pre-pass was tier-gated (cash) even in
 *    the cloud and stays out locally;
 *  - no web-research (the groundInResearch opt-in extra call): settled out
 *    of the local floor;
 *  - no tier cap: the mount's LOCAL_GENERATE_CONTEXT_CEILING is the local
 *    budget.
 *
 * `appendSeriesContext`, `composeDynamicContext`, and
 * `shouldRunProseAugmentation` are REUSED from `@/lib/ai/generation-context`
 * (that file's pure exports — never its db-coupled builders as functions;
 * those are translated 1:1 here) so composition stays byte-identical to the
 * cloud. The translations mirror `sqlite-project-snapshot.ts`'s conventions:
 * factory bound to `(db, ownerId)`, plain drizzle-sqlite selects, and NO
 * relational `with:` (the sqlite schema deliberately ported ZERO relations
 * blocks) — multi-table reads are flat selects + in-memory joins.
 *
 * One deliberate local TIGHTENING vs the cloud: the universe read and the
 * prior-projects read carry the owner predicate too (the cloud trusted its
 * `userId` argument; §5.6 scopes EVERY local read to the owner row). The
 * storyMemories reads stay PROJECT-scoped exactly as the cloud's were — their
 * rows descend the owner-gated projects table, and on the wire the mount's
 * projectScope check refuses a foreign projectId before the pipeline runs.
 */

import { and, asc, desc, eq, inArray, lte, ne } from "drizzle-orm";

import {
  generations,
  projectCharacterStates,
  projects,
  seriesBibles,
  storyMemories,
  universeCharacters,
  universeEvents,
  universes,
} from "@/db/sqlite-schema";
import {
  appendSeriesContext,
  composeDynamicContext,
  shouldRunProseAugmentation,
} from "@/lib/ai/generation-context";
import type { GenerationMode } from "@/lib/modes/registry";
import type { DrizzleSqliteDb } from "@/db/sqlite";
import type { GenerateChapterInput, GenerateChapterPorts } from "./handlers/generate-chapter";
import type { ConfirmedViolations } from "./policy/generation-violations";

export interface LocalContextBuilderDeps {
  /** The composition's ONE SQLite db handle (never a Neon import). */
  readonly db: DrizzleSqliteDb;
  /** §5.6 — the single local owner's users-row id; every read is scoped to it. */
  readonly ownerId: string;
  /** The resolved subscription tier (prose-augmentation tier guard); default `all_access`. */
  readonly tier?: string;
}

export interface LocalContextBuilderPorts {
  readonly buildContext: NonNullable<GenerateChapterPorts["buildContext"]>;
  /**
   * The cloud route's violation-record read, translated to the projects twin.
   * The `actorId` argument is part of the shared port shape but REDUNDANT
   * under §5.6 — the factory is already bound to the ONE owner row, and the
   * owner IS the actor — so it is ignored (kept only to satisfy the port).
   */
  readonly loadViolations: NonNullable<GenerateChapterPorts["loadViolations"]>;
  /**
   * The `generations`-table write, mirroring the cloud route's insert.
   * `prompt` is `req.prompt` — the RAW body prompt, exact recordPrompt parity
   * (the cloud stores the tier-capped raw prompt; locally there is no cap, so
   * the raw prompt IS the record — the mode directive never lands in it).
   */
  readonly persist: NonNullable<GenerateChapterPorts["persist"]>;
}

/** Row-lite shapes for the translated cloud builders (flat-select joins). */
interface LocalProjectLite {
  id: string;
  name: string;
  storyType: string | null;
  seriesParentId: string | null;
  universeId: string | null;
  timelineSort: number | null;
}

interface SeriesStoryLite {
  name: string;
  memories: { fact: string; structuredData: { keyEvents?: string[] } | null }[];
}

/**
 * `additionalContext` is slice 4d's NEW optional carry on GenerateChapterInput
 * (the composition half's edit adds the field; local-host's
 * `LocalGenerateBody` already carries it as the client block that joins the
 * dynamic context). Read STRUCTURALLY so this module type-checks
 * independently of that edit's landing order — the runtime read is the exact
 * same property either way, in the same slot the cloud read
 * `body.additionalContext`.
 */
type WithAdditionalContext = GenerateChapterInput & { readonly additionalContext?: string };

export function makeLocalContextBuilder(
  deps: LocalContextBuilderDeps,
): LocalContextBuilderPorts {
  const { db, ownerId } = deps;
  // The resolved tier gates ONLY the prose-augmentation gate (the exact
  // `shouldRunProseAugmentation(mode, projectId, tier)` qualification the
  // cloud route applied).
  const tier = deps.tier ?? "all_access";

  /**
   * The promise-ledger pre-pass (P1) — `promise-ledger.ts` translated onto
   * the sqlite twin: storyMemories ordered by chapterIndex ASC, open =
   * created minus fuzzy-resolved (`r.includes(p) || p.includes(r)`), dedupe +
   * the 8 most recent (`slice(-8)`), and the GENERATE header — the cloud
   * route passes NO mode, so the ledger ALWAYS answers the generate header.
   * Same `try { … } catch { return ""; }` fail-open. DB-only — no LLM cost.
   */
  async function buildLocalPromiseLedger(projectId: string): Promise<string> {
    try {
      const memories = await db
        .select({ structuredData: storyMemories.structuredData })
        .from(storyMemories)
        .where(eq(storyMemories.projectId, projectId))
        .orderBy(asc(storyMemories.chapterIndex));
      const created: string[] = [];
      const resolved: string[] = [];
      for (const m of memories) {
        // The cast mirrors the cloud's `(m as any).structuredData || {}`: the
        // runtime value is db-controlled JSON, and garbage must reach the
        // fail-open catch below rather than be sanitized away.
        const sd = (m.structuredData || {}) as {
          openPromisesCreated?: string[];
          openPromisesResolved?: string[];
        };
        (sd.openPromisesCreated || []).forEach((p) => { if (p?.trim()) created.push(p.trim()); });
        (sd.openPromisesResolved || []).forEach((p) => { if (p?.trim()) resolved.push(p.trim()); });
      }
      // Unresolved = created promises not fuzzily matched by any resolution.
      const open = created.filter(
        (p) => !resolved.some((r) => r && (r.includes(p) || p.includes(r))),
      );
      // De-dupe, keep the 8 most recent.
      const uniq = [...new Set(open)].slice(-8);
      if (!uniq.length) return "";
      const header =
        "OPEN STORY PROMISES (honor these threads — advance or deepen them; do NOT resolve prematurely or let them vanish):";
      return header + "\n" + uniq.map((p) => `- ${p}`).join("\n");
    } catch {
      return "";
    }
  }

  /**
   * `buildSeriesUniverseContext(proj, userId)` translated — same branch
   * order, same byte-exact push sequence, flat selects + in-memory joins
   * instead of the cloud's relational `with:` reads.
   */
  async function buildLocalSeriesUniverseContext(proj: LocalProjectLite): Promise<string> {
    const lines: string[] = [];

    // SERIES: walk the seriesParentId chain to collect previous stories' key
    // events. Two flat queries per step (the cloud's one relational read);
    // the owner predicate also gates the walk — a book owned by anyone else
    // ends the chain silently.
    if (proj.storyType === "series" && proj.seriesParentId) {
      const previousStories: SeriesStoryLite[] = [];
      let currentId: string | null = proj.seriesParentId;
      let depth = 0;
      while (currentId && depth < 10) {
        const stepId = currentId;
        const [prev] = await db
          .select({ id: projects.id, name: projects.name, seriesParentId: projects.seriesParentId })
          .from(projects)
          .where(and(eq(projects.id, stepId), eq(projects.userId, ownerId)))
          .limit(1);
        if (!prev) break;
        const memories = await db
          .select({ fact: storyMemories.fact, structuredData: storyMemories.structuredData })
          .from(storyMemories)
          .where(eq(storyMemories.projectId, prev.id))
          .orderBy(desc(storyMemories.createdAt))
          .limit(5);
        previousStories.unshift({ name: prev.name, memories });
        currentId = prev.seriesParentId ?? null;
        depth++;
      }
      if (previousStories.length > 0) {
        lines.push("SERIES CONTEXT — events from previous books that inform this story:");
        previousStories.forEach((story, i) => {
          lines.push(`\nBook ${i + 1}: ${story.name}`);
          if (story.memories.length) {
            story.memories.forEach((m) => {
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

    // UNIVERSE: inject the universe's own premise/tone/sharedRules. The cloud
    // read this by id only; the §5.6 owner predicate is a deliberate local
    // tightening (§5.6 scopes EVERY local read to the owner row), not a
    // behavior change for a single-owner db.
    if (proj.storyType === "universe-story" && proj.universeId) {
      const universeId = proj.universeId;
      const [universe] = await db
        .select({
          id: universes.id,
          name: universes.name,
          premise: universes.premise,
          sharedRules: universes.sharedRules,
          tone: universes.tone,
        })
        .from(universes)
        .where(and(eq(universes.id, universeId), eq(universes.userId, ownerId)))
        .limit(1);
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

    // Canon events + universe characters with states from PRIOR-positioned
    // stories. The character states are the local counterpart of the cloud's
    // `universeCharacters.states` relation: flat selects + an in-memory join
    // (the sqlite schema deliberately ported ZERO relations blocks).
    if (proj.storyType === "universe-story" && proj.universeId && proj.timelineSort != null) {
      const universeId = proj.universeId;
      const projSort = proj.timelineSort ?? 0;

      const canonEvents = await db
        .select({ name: universeEvents.name, description: universeEvents.description })
        .from(universeEvents)
        .where(and(
          eq(universeEvents.universeId, universeId),
          eq(universeEvents.isCanon, true),
          lte(universeEvents.timelineSort, projSort - 1),
        ))
        .orderBy(asc(universeEvents.timelineSort))
        .limit(15);
      if (canonEvents.length > 0) {
        lines.push("UNIVERSE CANON — events established before this story:");
        canonEvents.forEach((e) => {
          lines.push(`- ${e.name}${e.description ? ": " + e.description : ""}`);
        });
      }

      const uniChars = await db
        .select({
          id: universeCharacters.id,
          name: universeCharacters.name,
          baseProfile: universeCharacters.baseProfile,
        })
        .from(universeCharacters)
        .where(eq(universeCharacters.universeId, universeId));
      const charStates =
        uniChars.length > 0
          ? await db
              .select({
                projectId: projectCharacterStates.projectId,
                universeCharId: projectCharacterStates.universeCharId,
                emotionalState: projectCharacterStates.emotionalState,
                stateNotes: projectCharacterStates.stateNotes,
                isDeceased: projectCharacterStates.isDeceased,
                createdAt: projectCharacterStates.createdAt,
              })
              .from(projectCharacterStates)
              .where(inArray(projectCharacterStates.universeCharId, uniChars.map((c) => c.id)))
          : [];
      // §5.6: the cloud's prior-projects read carried no owner predicate; the
      // local one keeps the sibling pool inside the ONE users row, so a
      // stranger's same-universe book can never feed character history.
      const priorProjs = await db
        .select({ id: projects.id, timelineSort: projects.timelineSort })
        .from(projects)
        .where(and(
          eq(projects.universeId, universeId),
          ne(projects.id, proj.id),
          eq(projects.userId, ownerId),
        ));
      const priorProjIds = new Set(
        priorProjs.filter((p) => (p.timelineSort ?? 0) < projSort).map((p) => p.id),
      );
      if (uniChars.length > 0) {
        const charLines: string[] = [];
        for (const char of uniChars) {
          const priorState = charStates
            .filter((s) => s.universeCharId === char.id && priorProjIds.has(s.projectId))
            .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))[0];
          if (priorState?.isDeceased) {
            charLines.push(`${char.name}: DECEASED (do not include in this story)`);
            continue;
          }
          const parts: string[] = [`${char.name}:`];
          const baseProfile = char.baseProfile;
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

  /**
   * `buildSeriesBibleContext(projectId, userId)` translated — a user-scoped
   * flat select of series_bibles, the in-memory find by `projectIds`, then
   * the EXACT cloud lines. Series Bibles are user-level, outside any
   * per-project snapshot by §10's own design, so this read travels with the
   * context builder rather than the snapshot. No hit → "".
   */
  async function buildLocalSeriesBibleContext(projectId: string): Promise<string> {
    const bibles = await db
      .select()
      .from(seriesBibles)
      .where(eq(seriesBibles.userId, ownerId));
    const bible = bibles.find((b) => (b.projectIds as string[] | null)?.includes(projectId));
    if (!bible) return "";

    const lines: string[] = [`Series: "${bible.name}"`];
    if (bible.premise) lines.push(`Premise: ${bible.premise}`);
    if (bible.tone) lines.push(`Tone: ${bible.tone}`);

    const worldRules = (bible.worldRules as string[] | null) ?? [];
    if (worldRules.length > 0) {
      lines.push("World rules (must hold across every book in this series):");
      worldRules.forEach((r) => lines.push(`- ${r}`));
    }

    const arcs = (bible.seriesCharacterArcs as {
      characterName: string;
      arcSummary: string;
      booksInvolved: string[];
    }[] | null) ?? [];
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

  return {
    /**
     * The cloud route's buildContext, minus its cloud-only parts — the EXACT
     * cloud order: the mount has already applied the ceiling and the mode
     * directive when this runs, aiisms/research and the other prose
     * pre-passes are the settled absences named in the header, so this adds
     * the series/universe context → the series bible → static/dynamic
     * composition → (gated) the promise ledger. Returns the EXACT cloud
     * shape `{ static, dynamic }` — possibly-undefined values, NOT
     * presence-keyed omits. NO recordPrompt bookkeeping here: the mount owns
     * it, and `persist` records the raw prompt.
     */
    buildContext: async (req) => {
      let seriesUniverseCtx = "";

      // ── Series/universe + series-bible context, only when the request
      // carries a project (the cloud's own gate). ONE project read for both
      // halves, owner-scoped (§5.6): a foreign project id is simply not this
      // host's story and composes nothing.
      if (req.projectId) {
        const [proj] = await db
          .select({
            id: projects.id,
            name: projects.name,
            storyType: projects.storyType,
            seriesParentId: projects.seriesParentId,
            universeId: projects.universeId,
            timelineSort: projects.timelineSort,
          })
          .from(projects)
          .where(and(eq(projects.id, req.projectId), eq(projects.userId, ownerId)))
          .limit(1);
        // The cloud's outer gate (route lines 202-204) — the builder itself
        // no-ops for any other storyType, so this is cloud parity, not
        // filtering.
        if (proj && (proj.storyType === "series" || proj.storyType === "universe-story")) {
          seriesUniverseCtx = await buildLocalSeriesUniverseContext(proj);
        }

        // The series bible is USER-level and independent of the project row's
        // existence (the cloud reads it for any projectId — route line 205).
        const seriesBibleCtx = await buildLocalSeriesBibleContext(req.projectId);
        if (seriesBibleCtx) seriesUniverseCtx += seriesBibleCtx;
      }

      // Series/universe context belongs in the static (cached) block —
      // appended with the cloud's own join so it is never a client-truncation
      // victim. `appendSeriesContext` is the CLOUD's pure export, byte-exact.
      const effectiveStatic = appendSeriesContext(req.staticContext, seriesUniverseCtx);

      const effectiveDynamic = composeDynamicContext([
        req.dynamicContext,
        (req as WithAdditionalContext).additionalContext,
      ]);

      // Prose-augmentation pre-passes, the subset the local floor CAN honor:
      // the promise ledger ONLY (DB-only, no LLM). Voice/author exemplars,
      // scene-blueprint, and web-research are the settled absences named in
      // the header; the augmentation gate is the CLOUD's pure export.
      const promiseLedger = shouldRunProseAugmentation(req.mode as GenerationMode, req.projectId, tier)
        ? await buildLocalPromiseLedger(req.projectId!)
        : "";

      const finalDynamic = composeDynamicContext([effectiveDynamic, promiseLedger]) || undefined;

      return { static: effectiveStatic, dynamic: finalDynamic };
    },

    loadViolations: async (projectId, _actorId) => {
      // §5.6 — the actorId is redundant here: the factory is bound to the ONE
      // owner row (the owner IS the actor), and a foreign projectId is not
      // this host's story — it reads as an EMPTY record, never as another
      // user's confirmations.
      void _actorId;
      const [row] = await db
        .select({ intentionalViolations: projects.intentionalViolations })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, ownerId)))
        .limit(1);
      return (row?.intentionalViolations ?? {}) as ConfirmedViolations;
    },

    persist: async (out, req) => {
      // The cloud route's insert, minus the tier-cap chain: locally the
      // pipeline hands `req.prompt` = the raw body prompt (the mount swaps
      // the directive-suffixed prompt only for the GENERATE port — the
      // record must never carry the directive). Omitted optional columns ride
      // their DDL defaults (model 'claude-sonnet-5', tokensUsed NULL).
      await db.insert(generations).values({
        projectId: req.projectId ?? null,
        chapterId: req.chapterId ?? null,
        mode: req.mode,
        prompt: req.prompt,
        output: out.text ?? "",
        ...(out.model !== undefined ? { model: out.model } : {}),
        ...(out.tokensUsed !== undefined ? { tokensUsed: out.tokensUsed } : {}),
      });
      return undefined;
    },
  };
}

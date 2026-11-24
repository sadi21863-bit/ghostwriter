/**
 * Phase 2 / v4 §7 — the Story Graph health-probe read as a shared handler.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/story-graph/route.ts`:
 * an ownership probe, the multi-relation project read, and the pure
 * `buildStoryGraph` → `analyzeGraphHealth` → `contextIsTrimmed` pipeline. The
 * graph builder itself already lives in `src/lib/graph/` as a pure component,
 * so this handler keeps the exact port shape "read → build → health" — the only
 * thing extracted is the authorization + the read, behind a repository port.
 * The handler composes the (pure) builder, health analyzer, and Headroom trim
 * signal exactly as the route did, so Studio's graph view sees an identical
 * payload.
 *
 * No §11 hook: this is a read, not a canonical mutation.
 */

import type { RequestContext } from "@/lib/core/request-context";
import { buildStoryGraph, type StoryGraphResult } from "@/lib/graph/story-graph";
import { analyzeGraphHealth } from "@/lib/graph/graph-health";
import { contextIsTrimmed } from "@/lib/ai/context-builder";

export interface StoredRelationshipRow {
  characterAId: string;
  characterBId: string;
  trustLevel: number | null;
  relationshipType: string | null;
  [key: string]: unknown;
}

export interface StoryGraphData {
  /**
   * The project row with the graph's entity relations loaded
   * (characters/locations/plotThreads/chapters/worldEntities), or null when the
   * project vanished after the ownership probe.
   */
  project: Record<string, unknown> | null;
  storedRels: StoredRelationshipRow[];
}

export interface StoryGraphRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  readGraphData(projectId: string): Promise<StoryGraphData>;
}

export type ReadStoryGraphResult =
  | {
      ok: true;
      graph: StoryGraphResult;
      health: ReturnType<typeof analyzeGraphHealth>;
      contextTrimmed: boolean;
    }
  | { ok: false; status: 403 | 404; reason: string };

export async function readStoryGraph(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<StoryGraphRepository, "ownsProject" | "readGraphData">,
): Promise<ReadStoryGraphResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const data = await repo.readGraphData(input.projectId);
  if (!data.project) return { ok: false, status: 404, reason: "Not found" };
  const project = data.project as {
    characters?: unknown[];
    locations?: unknown[];
    plotThreads?: unknown[];
    chapters?: unknown[];
    worldEntities?: unknown[];
  };

  const graph = buildStoryGraph({
    characters: (project.characters ?? []) as never,
    locations: (project.locations ?? []) as never,
    plotThreads: (project.plotThreads ?? []) as never,
    chapters: (project.chapters ?? []) as never,
    storedRels: data.storedRels.map((r) => ({
      characterAId: r.characterAId,
      characterBId: r.characterBId,
      trustLevel: r.trustLevel,
      relationshipType: r.relationshipType,
    })),
    worldEntities: (project.worldEntities ?? []) as never,
  });

  // Headroom trims context silently (by design, for prompt-cache stability) — this
  // is the one place that surfaces it as a yes/no signal, in the same response as
  // the structural graph health, since Studio's graph view is where a user would
  // naturally look to understand whether their project's full story reaches the AI.
  const contextTrimmed = contextIsTrimmed(
    { ...data.project, characterRelationships: data.storedRels } as unknown as Parameters<
      typeof contextIsTrimmed
    >[0],
  );

  return { ok: true, graph, health: analyzeGraphHealth(graph), contextTrimmed };
}

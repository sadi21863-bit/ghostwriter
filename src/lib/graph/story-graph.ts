// Pure builder for the multi-entity Story Graph (Story Graph sub-project, Phase 1).
// Surfaces character + location + thread nodes and the relationships that ALREADY
// exist in the World Bible (co-occurrence + characterRelationships, plus the
// linkedLocationIds/linkedPlotThreadIds/linkedCharacterIds link fields) — no new
// data, just a graph view over it. Kept pure so it's unit-testable without a DB.
export type StoryGraphNodeType = "character" | "location" | "thread";
export type StoryGraphEdgeKind = "relationship" | "appears_at" | "drives";

export interface StoryGraphNode {
  id: string;
  type: StoryGraphNodeType;
  name: string;
  role?: string;
  portraitUrl?: string;
}

export interface StoryGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: StoryGraphEdgeKind;
  relationshipType?: string;
  trustLevel?: number;
  sharedChapters?: number;
}

export interface StoryGraphInput {
  characters: { id: string; name: string; role?: string | null; portraitUrl?: string | null; linkedLocationIds?: string[] | null; linkedPlotThreadIds?: string[] | null }[];
  locations: { id: string; name: string; linkedCharacterIds?: string[] | null }[];
  plotThreads: { id: string; name: string }[];
  chapters: { content?: string | null }[];
  storedRels: { characterAId: string; characterBId: string; trustLevel?: number | null; relationshipType?: string | null }[];
}

export interface StoryGraphResult {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  isolated: { id: string; name: string }[];
}

export function buildStoryGraph(input: StoryGraphInput): StoryGraphResult {
  const { characters, locations, plotThreads, chapters, storedRels } = input;
  const charIds = new Set(characters.map(c => c.id));
  const locIds = new Set(locations.map(l => l.id));
  const threadIds = new Set(plotThreads.map(t => t.id));

  const nodes: StoryGraphNode[] = [
    ...characters.map((c): StoryGraphNode => ({ id: c.id, type: "character", name: c.name, role: c.role ?? undefined, portraitUrl: c.portraitUrl ?? undefined })),
    ...locations.map((l): StoryGraphNode => ({ id: l.id, type: "location", name: l.name })),
    ...plotThreads.map((t): StoryGraphNode => ({ id: t.id, type: "thread", name: t.name })),
  ];

  const edges: StoryGraphEdge[] = [];
  const touched = new Set<string>(); // character ids that have at least one edge

  // 1. Character ↔ character relationship edges (co-occurrence + stored data).
  const relMap = new Map<string, { trustLevel?: number | null; relationshipType?: string | null }>();
  for (const r of storedRels) {
    relMap.set(pairKey(r.characterAId, r.characterBId), r);
  }
  const coOccur = new Map<string, number>();
  for (const ch of chapters) {
    const content = (ch.content || "").toLowerCase();
    if (!content.trim()) continue;
    const present = characters.filter(c => content.includes(c.name.toLowerCase()));
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const k = pairKey(present[i].id, present[j].id);
        coOccur.set(k, (coOccur.get(k) ?? 0) + 1);
      }
    }
  }
  // Union of co-occurring pairs and stored pairs (a stored relationship is shown
  // even if the characters never share an on-page chapter yet).
  const relPairs = new Set<string>([...coOccur.keys(), ...relMap.keys()]);
  for (const key of relPairs) {
    const [a, b] = key.split(":");
    if (!charIds.has(a) || !charIds.has(b)) continue;
    const stored = relMap.get(key);
    edges.push({
      id: `rel:${key}`, source: a, target: b, kind: "relationship",
      relationshipType: stored?.relationshipType ?? "",
      trustLevel: stored?.trustLevel ?? 50,
      sharedChapters: coOccur.get(key) ?? 0,
    });
    touched.add(a); touched.add(b);
  }

  // 2. appears_at edges (character → location), from both link directions, deduped.
  const seenAppears = new Set<string>();
  const addAppears = (charId: string, locId: string) => {
    if (!charIds.has(charId) || !locIds.has(locId)) return;
    const k = `${charId}:${locId}`;
    if (seenAppears.has(k)) return;
    seenAppears.add(k);
    edges.push({ id: `loc:${k}`, source: charId, target: locId, kind: "appears_at" });
    touched.add(charId);
  };
  for (const c of characters) for (const locId of c.linkedLocationIds ?? []) addAppears(c.id, locId);
  for (const l of locations) for (const charId of l.linkedCharacterIds ?? []) addAppears(charId, l.id);

  // 3. drives edges (character → thread).
  for (const c of characters) {
    for (const threadId of c.linkedPlotThreadIds ?? []) {
      if (!threadIds.has(threadId)) continue;
      edges.push({ id: `thr:${c.id}:${threadId}`, source: c.id, target: threadId, kind: "drives" });
      touched.add(c.id);
    }
  }

  const isolated = characters.filter(c => !touched.has(c.id)).map(c => ({ id: c.id, name: c.name }));
  return { nodes, edges, isolated };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

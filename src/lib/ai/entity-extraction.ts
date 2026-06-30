export type EntityKey = "characters" | "locations" | "plotThreads" | "worldEntities";

export const ENTITY_API_PATH: Record<EntityKey, string> = {
  characters: "characters",
  locations: "locations",
  plotThreads: "plot-threads",
  worldEntities: "world-entities",
};

export const ENTITY_TYPE: Record<EntityKey, string> = {
  characters: "character",
  locations: "location",
  plotThreads: "plotThread",
  worldEntities: "worldEntity",
};

export interface EntityChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface EntitySuggestion {
  type: EntityKey;
  entity: any;
  changes: EntityChange[];
}

export const DIFF_FIELDS: Record<EntityKey, { field: string; label: string }[]> = {
  characters: [
    ["desires", "Want"], ["arc", "Need"], ["fears", "Contradiction"], ["speechPattern", "Voice note"],
    ["role", "Role"], ["age", "Age"], ["appearance", "Appearance"], ["personality", "Personality"],
    ["thinkingStyle", "Thinking style"], ["behavior", "Behavior patterns"], ["habits", "Habits & quirks"],
    ["backstory", "Backstory"],
  ].map(([field, label]) => ({ field, label })),
  locations: [
    ["description", "Description"], ["atmosphere", "Atmosphere"], ["history", "History"], ["sensoryDetails", "Sensory details"],
  ].map(([field, label]) => ({ field, label })),
  plotThreads: [
    ["description", "Description"], ["stakes", "Stakes"], ["connections", "Connections"], ["status", "Status"],
  ].map(([field, label]) => ({ field, label })),
  worldEntities: [
    ["summary", "Summary"], ["description", "Description"],
  ].map(([field, label]) => ({ field, label })),
};

const ENTITY_KEYS: EntityKey[] = ["characters", "locations", "plotThreads", "worldEntities"];

/**
 * Finds Story Bible entities whose name appears (case-insensitively, whole-word)
 * in the generated text. Prioritizes characters > locations > plot threads,
 * preserving each list's existing order, and caps total matches.
 */
export function matchEntities(text: string, project: any, maxMatches = 3): { type: EntityKey; entity: any }[] {
  const matches: { type: EntityKey; entity: any }[] = [];
  for (const type of ENTITY_KEYS) {
    const items: any[] = project?.[type] || [];
    for (const entity of items) {
      const name = (entity?.name || "").trim();
      if (name.length < 2) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) {
        matches.push({ type, entity });
        if (matches.length >= maxMatches) return matches;
      }
    }
  }
  return matches;
}

/**
 * Compares an "improved" entity proposal against the existing entity, returning
 * only fields where the proposal is non-empty and differs from the current value.
 */
export function diffEntity(type: EntityKey, existing: any, proposed: any): EntityChange[] {
  if (!proposed || typeof proposed !== "object") return [];
  const changes: EntityChange[] = [];
  for (const { field, label } of DIFF_FIELDS[type]) {
    const oldValue = String(existing?.[field] ?? "").trim();
    const newValue = String(proposed?.[field] ?? "").trim();
    if (!newValue) continue;
    if (newValue === oldValue) continue;
    changes.push({ field, label, oldValue, newValue });
  }
  return changes;
}

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

/**
 * §13.1 field allowlist — the single source of truth for BOTH readers:
 *
 *  1. the AI-suggestion chip: `diffEntity` diffs a model-proposed "improved"
 *     entity against the existing row over exactly these fields; and
 *  2. the story-transaction validator: `validateChanges`
 *     (src/lib/core/handlers/apply-story-transaction.ts) imports this table as
 *     the allowlist that decides what a recorded transaction may write.
 *
 * Migration principle (v4 §13.1): every field listed per entity is a REAL
 * column on that entity's table that a UI form save writes (StoryBible cards,
 * WorldBiblePanel char/location/thread forms, the Elements card, and — via
 * link arrays — ConstellationView's canvas-link writes). Text columns ride the
 * string wire of `StoryChange.oldValue/newValue` as-is; jsonb columns (link
 * arrays, `properties`, `skills`/knowledge blobs) carry the JSON-serialized
 * value in those same string cells, and `diffEntity` encodes them the same way
 * so old/new stay faithful. Exported for the form-save client adapter
 * (`src/lib/story/edit-transaction.ts`), which must send the same wire.
 *
 * Deliberately NOT allowlisted (per-field decisions, not omissions):
 *
 *  - `embedding` — a derived vector, written only by the embedding pipeline,
 *    never a user-edit surface.
 *  - `characters.voiceId` — TTS-provider metadata (providers config, not story
 *    canon); the Audio Novel panel keeps its direct PATCH, which is correct.
 *  - `characters.portraitUrl`/`soulId`/`soulIdTrainingJobId` — media/production
 *    asset metadata in the same class as voiceId.
 *  - `id`/`projectId`/`createdAt`/`updatedAt` — server-owned identity columns.
 *  - Columns with NO UI writer (characters.selfJustificationPattern,
 *    characters.moralFoundationProfile, characters.proxemicsIntimateList,
 *    characters.hapticsTraumaModifier, characters.chronemicsLateness,
 *    characters.dominantLanguageContext, characters.languageLossHistory,
 *    characters.compensationTrigger, characters.disabilityProfile) — the
 *    allowlist never invents a write surface nothing can produce.
 *  - Engine-managed bookkeeping (plotThreads.lastMentionedChapterId,
 *    plotThreads.starvationWarning) and `alwaysInContext`/`sortOrder` on
 *    characters/locations/plotThreads — written by the context-star toggle,
 *    not the migrated form saves. worldEntities DOES carry them because the
 *    Elements card's full-draft save does.
 *
 * MIRROR RULE: `pgStoryTransactionRepository`'s ENTITY_TABLES column map
 * (src/lib/core/pg-repositories.ts) is the apply/revert write-pass projection
 * of this table. It is COMPLETE as of the §13.1 mirror pass: every field below
 * maps to a real column, with the adapter decoding string-wire values for the
 * boolean/integer/jsonb entries (`decodeChangeValue`/`encodeChangeValue`).
 * Any future field added here must be mirrored there — a new core mirror test
 * pins the exact per-entity set equality, so the drift fails at type/test time.
 */
export const DIFF_FIELDS: Record<EntityKey, { field: string; label: string }[]> = {
  characters: [
    // Identity + the soul pairs the drafting chip reads first.
    ["name", "Name"],
    ["desires", "Want"], ["arc", "Need"], ["fears", "Contradiction"], ["speechPattern", "Voice note"],
    ["role", "Role"], ["age", "Age"], ["appearance", "Appearance"], ["personality", "Personality"],
    ["thinkingStyle", "Thinking style"], ["behavior", "Behavior patterns"], ["habits", "Habits & quirks"],
    ["backstory", "Backstory"],
    // Structural/voice card (WorldBiblePanel char form).
    ["structuralFunction", "Structural function"], ["visualProfile", "Visual profile"],
    ["voiceProfile", "Voice profile"], ["voiceRegister", "Voice register"],
    ["voiceCompression", "Voice compression"], ["verbalTic", "Verbal tic"],
    // Antagonist card.
    ["antagonistToggle", "Antagonist"], ["antagonistType", "Antagonist archetype"],
    // NVC card.
    ["kinesicsBaseline", "Kinesics baseline"], ["kinesicsMicro", "Microexpression map"],
    ["kinesicsIdiosyncrasy", "Signature gesture"], ["proxemicsCulture", "Proxemics culture"],
    ["proxemicsViolationResponse", "Proxemics violation"], ["paralanguageBaseline", "Paralanguage baseline"],
    ["paralanguageStressDegradation", "Paralanguage under stress"],
    ["paralanguageSignatureSound", "Paralanguage signature"], ["hapticsTouchLevel", "Touch level"],
    ["chronemicsTimeType", "Time relationship"], ["oculesicsDefault", "Gaze default"],
    ["oculesicsDeception", "Gaze when hiding"], ["objecticsSignature", "Object signature"],
    ["appearanceSignature", "Appearance signature"], ["appearanceTrajectory", "Appearance trajectory"],
    // Language profile.
    ["nativeLanguage", "Native language"], ["acquiredLanguages", "Acquired languages"],
    ["accentProfile", "Accent"], ["reversionTrigger", "Reversion trigger"],
    ["registerDefault", "Default register"], ["registerRange", "Register range"],
    ["codeSwitchingTriggers", "Code-switching triggers"], ["idiolectFingerprint", "Idiolect fingerprint"],
    // Flaw-Strength-Compensation card.
    ["rootWound", "Root wound"], ["hamartia", "Hamartia"], ["cognitiveBias", "Cognitive bias"],
    ["blindSpot", "Blind spot"], ["strengthBranch", "Strength branch"],
    ["compensationMode", "Compensation mode"], ["compensationBehavior", "Compensation behavior"],
    ["flawArcMode", "Flaw arc mode"],
    // World Logic Matrix.
    ["culturalWorldview", "Cultural worldview"], ["characterWant", "Character want"],
    ["characterNeed", "Character need"], ["contradiction", "Inner contradiction"],
    ["narratorBlindSpot", "Narrator blind spot"], ["firstImpressionNote", "First impression"],
    // AI-context visibility select.
    ["contextVisibility", "Context visibility"],
    // jsonb blobs — carry their JSON-serialized value on the string wire.
    ["significantFlaws", "Significant flaws"], ["skills", "Skills"],
    ["knowledgeMap", "Knowledge map"], ["intelligenceProfile", "Intelligence profile"],
    // Link arrays — ConstellationView canvas-link writes ride these.
    ["linkedLocationIds", "Linked locations"], ["linkedPlotThreadIds", "Linked plot threads"],
  ].map(([field, label]) => ({ field, label })),
  locations: [
    ["name", "Name"], ["description", "Description"], ["atmosphere", "Atmosphere"],
    ["history", "History"], ["sensoryDetails", "Sensory details"],
    ["linkedCharacterIds", "Linked characters"],
  ].map(([field, label]) => ({ field, label })),
  plotThreads: [
    ["name", "Name"], ["description", "Description"], ["stakes", "Stakes"], ["connections", "Connections"],
    ["status", "Status"],
  ].map(([field, label]) => ({ field, label })),
  worldEntities: [
    // kind is the row's discriminator column: reverting it re-classifies the
    // row (updates the column only — no data migration, exactly like a direct PATCH).
    ["name", "Name"], ["kind", "Kind"],
    ["summary", "Summary"], ["description", "Description"],
    ["properties", "Properties"],
    ["alwaysInContext", "Always in AI context"], ["sortOrder", "Sort order"],
    ["linkedCharacterIds", "Linked characters"], ["linkedLocationIds", "Linked locations"],
    ["linkedPlotThreadIds", "Linked plot threads"], ["linkedEntityIds", "Linked entities"],
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
 * The string-wire canonical form of a column value. The audit cells
 * (`StoryChange.oldValue/newValue`) are strings, so a jsonb/link-array value
 * is carried JSON-serialized — the exact string a client transaction must send
 * for the same field. Strings behave exactly as before (trimmed); booleans and
 * numbers read the same through both String() and JSON.stringify(); empty
 * arrays/objects stay "no value", matching the old String([])/String({}) skip.
 */
function canonicalFieldValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
    if (empty) return "";
    return JSON.stringify(value) ?? String(value);
  }
  return String(value);
}

/** Exposed for the §13.1 client save adapter: forms must encode exactly like
 * the chip path so a recorded transaction and its audit cells stay faithful. */
export { canonicalFieldValue };

/**
 * Compares an "improved" entity proposal against the existing entity, returning
 * only fields where the proposal is non-empty and differs from the current value.
 */
export function diffEntity(type: EntityKey, existing: any, proposed: any): EntityChange[] {
  if (!proposed || typeof proposed !== "object") return [];
  const changes: EntityChange[] = [];
  for (const { field, label } of DIFF_FIELDS[type]) {
    const oldValue = canonicalFieldValue(existing?.[field]);
    const newValue = canonicalFieldValue(proposed?.[field]);
    if (!newValue) continue;
    if (newValue === oldValue) continue;
    changes.push({ field, label, oldValue, newValue });
  }
  return changes;
}

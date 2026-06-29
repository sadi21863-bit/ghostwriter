/**
 * Zod schemas + decode/encode guards for GhostWriter's critical JSONB blobs.
 *
 * The Drizzle columns these guard are typed as `any[]` / `Record<string, any>`
 * (see src/db/schema.ts), so nothing validated their shape at read or write time
 * — a single malformed blob could silently corrupt AI context or the World Bible
 * UI. These functions are the one place that shape is enforced.
 *
 * Convention:
 *   decodeXYZ(raw)  — LENIENT. For reads of possibly-legacy/corrupt DB data.
 *                     Never throws. Drops invalid elements, keeps valid ones,
 *                     falls back to a sensible default ([] or {}), logs what it
 *                     dropped.
 *   encodeXYZ(value) — STRICT. For writes. Validates and normalizes (strips
 *                     unknown keys, applies defaults); throws ZodError on a
 *                     structurally invalid value so the caller can reject the
 *                     write (e.g. return 400) instead of persisting garbage.
 *
 * The TS interfaces these mirror live in src/types/index.ts; the `z.infer` types
 * exported here are the runtime-checked equivalents.
 *
 * NOTE: of the four "critical entities" (characters, plot threads, memories,
 * aiRules), plot threads have NO JSONB columns of their own (plain text/varchar
 * in the plot_threads table), so there is nothing to decode/encode there — the
 * Drizzle row type already fully describes them.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// projects.ai_rules  (jsonb any[])
// ---------------------------------------------------------------------------
export const ProjectAIRuleSchema = z.object({
  id: z.string(),
  text: z.string(),
  // An unknown source is coerced to "user" rather than dropping the whole rule.
  source: z.enum(["user", "genre"]).catch("user"),
});
export type ProjectAIRule = z.infer<typeof ProjectAIRuleSchema>;

// ---------------------------------------------------------------------------
// characters.knowledge_map  (jsonb Record<string, any>)
// ---------------------------------------------------------------------------
export const KnowledgeStateSchema = z.enum([
  "KNOWS", "BELIEVES", "SUSPECTS", "IGNORANT", "FALSELY_BELIEVES", "ACTIVELY_HIDING",
]);
export const KnowledgeEntrySchema = z.object({
  state: KnowledgeStateSchema,
  entityType: z.enum(["character", "location", "plotThread"]),
  entityName: z.string(),
  belief: z.string().optional(),
  notes: z.string().optional(),
});
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;
export type KnowledgeMap = Record<string, KnowledgeEntry>;

// ---------------------------------------------------------------------------
// characters.intelligence_profile  (jsonb Record<string, any>)
// ---------------------------------------------------------------------------
export const IntelligenceTypeSchema = z.enum([
  "logical", "linguistic", "spatial", "kinesthetic",
  "interpersonal", "intrapersonal", "practical",
]);
export const IntelligenceProfileSchema = z.object({
  dominant: z.array(IntelligenceTypeSchema),
  weak: z.array(IntelligenceTypeSchema),
});
export type IntelligenceProfile = z.infer<typeof IntelligenceProfileSchema>;

// ---------------------------------------------------------------------------
// characters.skills  (jsonb any[])
// ---------------------------------------------------------------------------
export const CharacterSkillSchema = z.object({
  name: z.string(),
  category: z.string().catch("physical"),
  level: z.number().catch(1),
  acquisitionPath: z.string().catch("deliberate_practice"),
  traumaLinked: z.boolean().catch(false),
  traumaTrigger: z.string().optional(),
  notes: z.string().optional(),
});
export type CharacterSkill = z.infer<typeof CharacterSkillSchema>;

// ---------------------------------------------------------------------------
// story_memories.structured_data  (jsonb, already shaped in schema.ts)
// ---------------------------------------------------------------------------
const KnowledgeShiftSchema = z.object({
  character: z.string(),
  learned: z.string(),
  from: z.string(),
  to: z.string(),
});
// Each field independently `.catch`es to undefined so one malformed field drops
// only that field, not the whole memory.
export const StoryMemoryStructuredDataSchema = z.object({
  chapterTitle: z.string().optional().catch(undefined),
  arcPosition: z.string().optional().catch(undefined),
  charactersPresent: z.array(z.string()).optional().catch(undefined),
  keyEvents: z.array(z.string()).optional().catch(undefined),
  objectsIntroduced: z.array(z.string()).optional().catch(undefined),
  knowledgeShifts: z.array(KnowledgeShiftSchema).optional().catch(undefined),
  decisionsAndConsequences: z.array(z.string()).optional().catch(undefined),
  emotionalStateEnd: z.record(z.string(), z.string()).optional().catch(undefined),
  openPromisesCreated: z.array(z.string()).optional().catch(undefined),
  openPromisesResolved: z.array(z.string()).optional().catch(undefined),
});
export type StoryMemoryStructuredData = z.infer<typeof StoryMemoryStructuredDataSchema>;

// ===========================================================================
// Helpers
// ===========================================================================
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out as T;
}

/** Decode an array column: keep elements that parse, drop (and log) the rest. */
function decodeArray<T>(raw: unknown, schema: z.ZodType<T>, label: string): T[] {
  if (!Array.isArray(raw)) {
    if (raw != null) console.warn(`[story] ${label}: expected an array, got ${typeof raw} — falling back to []`);
    return [];
  }
  const out: T[] = [];
  let dropped = 0;
  for (const el of raw) {
    const parsed = schema.safeParse(el);
    if (parsed.success) out.push(parsed.data);
    else dropped++;
  }
  if (dropped > 0) console.warn(`[story] ${label}: dropped ${dropped} malformed element(s)`);
  return out;
}

/** Decode a Record column: keep values that parse, drop (and log) the rest. */
function decodeRecord<T>(raw: unknown, schema: z.ZodType<T>, label: string): Record<string, T> {
  if (!isPlainObject(raw)) {
    if (raw != null) console.warn(`[story] ${label}: expected an object, got ${typeof raw} — falling back to {}`);
    return {};
  }
  const out: Record<string, T> = {};
  let dropped = 0;
  for (const [key, val] of Object.entries(raw)) {
    const parsed = schema.safeParse(val);
    if (parsed.success) out[key] = parsed.data;
    else dropped++;
  }
  if (dropped > 0) console.warn(`[story] ${label}: dropped ${dropped} malformed entr(ies)`);
  return out;
}

// ===========================================================================
// Public decode/encode API
// ===========================================================================

// ---- aiRules ----
export function decodeAIRules(raw: unknown): ProjectAIRule[] {
  return decodeArray(raw, ProjectAIRuleSchema, "aiRules");
}
export function encodeAIRules(value: unknown): ProjectAIRule[] {
  return z.array(ProjectAIRuleSchema).parse(value);
}

// ---- character knowledgeMap ----
export function decodeKnowledgeMap(raw: unknown): KnowledgeMap {
  return decodeRecord(raw, KnowledgeEntrySchema, "knowledgeMap");
}
export function encodeKnowledgeMap(value: unknown): KnowledgeMap {
  return z.record(z.string(), KnowledgeEntrySchema).parse(value);
}

// ---- character intelligenceProfile ----
export function decodeIntelligenceProfile(raw: unknown): IntelligenceProfile {
  if (!isPlainObject(raw)) {
    if (raw != null) console.warn(`[story] intelligenceProfile: expected an object — falling back to default`);
    return { dominant: [], weak: [] };
  }
  const keep = (arr: unknown): IntelligenceProfile["dominant"] =>
    Array.isArray(arr)
      ? arr.filter((t): t is IntelligenceProfile["dominant"][number] => IntelligenceTypeSchema.safeParse(t).success)
      : [];
  return { dominant: keep(raw.dominant), weak: keep(raw.weak) };
}
export function encodeIntelligenceProfile(value: unknown): IntelligenceProfile {
  return IntelligenceProfileSchema.parse(value);
}

// ---- character skills ----
export function decodeCharacterSkills(raw: unknown): CharacterSkill[] {
  return decodeArray(raw, CharacterSkillSchema, "skills");
}
export function encodeCharacterSkills(value: unknown): CharacterSkill[] {
  return z.array(CharacterSkillSchema).parse(value);
}

// ---- memory structuredData ----
export function decodeMemoryStructuredData(raw: unknown): StoryMemoryStructuredData {
  if (!isPlainObject(raw)) {
    if (raw != null) console.warn(`[story] structuredData: expected an object — falling back to {}`);
    return {};
  }
  const parsed = StoryMemoryStructuredDataSchema.safeParse(raw);
  if (!parsed.success) return {};
  return stripUndefined(parsed.data);
}
export function encodeMemoryStructuredData(value: unknown): StoryMemoryStructuredData {
  return stripUndefined(StoryMemoryStructuredDataSchema.parse(value));
}

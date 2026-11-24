/**
 * SQLite translation of `src/db/schema.ts` — the Phase-3 local-store baseline
 * (docs/migration/phase3-prep.md §4.2).
 *
 * Conventions (deliberate, one per mechanical class):
 *  - pgvector `embedding` columns are OMITTED entirely (§4.2/§5.3 decision:
 *    features degrade to off, `noEmbedText` stays the seam default). No
 *    TEXT-frozen vectors, no placeholder column.
 *  - jsonb / pg `text().array()` → `text(mode: "json")`: drizzle JSON-encodes on
 *    write and parses on read, so core keeps typed objects, never a TEXT
 *    column; the zod decoders stay in `src/lib/types/story.ts`.
 *  - uuid → `text` primary keys. Generation happens client-side via
 *    `$defaultFn(() => crypto.randomUUID())`, the drizzle-level equivalent of
 *    pg's `defaultRandom()`: ids are generated at insert, `.returning()` still
 *    surfaces them, and handlers never see the difference. EXCEPTION:
 *    `storyTransactions.id` is TEXT with NO default in pg (its handler supplies
 *    its own transaction id) — mirrored as a bare NOT NULL PK.
 *  - timestamp/timestamptz → `integer(mode: "timestamp_ms")` (the doc allows
 *    ISO-8601 TEXT or integer epoch; this baseline picks integer epoch-ms as its
 *    ONE convention — Date-in/Date-out parity with pg rows, zero adapter
 *    conversion). `defaultNow()` → `$defaultFn(() => new Date())` (the SQL
 *    `defaultNow()` variant is deprecated and hardcodes an epoch expression).
 *  - varchar(n) → text (SQLite ignores lengths). real/integer → same.
 *  - booleans → `integer(mode: "boolean")`.
 *
 * Deliberately NOT ported from `src/db/schema.ts`:
 *  - the ~30 `relations()` blocks. The ported adapters answer `db.query.*`
 *    without `with` joins; add relations when a handler that consumes them
 *    migrates (pg relations stay the source of truth meanwhile).
 *  - index builders (pg removed those for the drizzle-orm 0.45.2 `.on()` bug
 *    anyway). The one index the baseline REQUIRES — the missing
 *    `semantic_cache(cache_type, input_key)` unique — is created in the
 *    vendored DDL (`src/db/sqlite-ddl.ts`) instead of the TS schema, keeping
 *    this file free of the buggy index-builder path entirely.
 *
 * Regenerate DDL whenever this file changes (see sqlite-ddl.ts header):
 *   npx drizzle-kit generate --dialect sqlite --schema ./src/db/sqlite-schema.ts --out ./drizzle-sqlite-tmp
 */

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const epochMs = (name: string) => integer(name, { mode: "timestamp_ms" });
const notNullNow = <TName extends string>(name: TName) =>
  epochMs(name).notNull().$defaultFn(() => new Date());
const uuidPk = <TName extends string>(name: TName) =>
  text(name).notNull().primaryKey().$defaultFn(() => crypto.randomUUID());

export const users = sqliteTable("users", {
  id: uuidPk("id"),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: epochMs("email_verified"),
  image: text("image"),
  hashedPassword: text("hashed_password"),
  higgsfieldApiKey: text("higgsfield_api_key").default(""),
  higgsfieldApiSecret: text("higgsfield_api_secret").default(""),
  segmindApiKey: text("segmind_api_key").default(""),
  openaiApiKey: text("openai_api_key").default(""),
  imageProviderId: text("image_provider_id").default("segmind_soul"),
  ttsProviderId: text("tts_provider_id").default("openai"),
  trendIntelligenceKey: text("trend_intelligence_key").default(""),
  referralCode: text("referral_code"),
  monthlyGenerations: real("monthly_generations").default(0),
  monthlyGenerationsResetAt: epochMs("monthly_generations_reset_at"),
  trialEndAt: epochMs("trial_end_at"),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});
export const accounts = sqliteTable("accounts", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});
export const sessions = sqliteTable("sessions", {
  id: uuidPk("id"),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: epochMs("expires").notNull(),
});
export const projects = sqliteTable("projects", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Project"),
  // pg: jsonb("genres").$type().default([]) — zero-arg $type stays untyped (unknown).
  genres: text("genres", { mode: "json" }).default([]),
  format: text("format").notNull().default("Novel"),
  skillLevel: text("skill_level").notNull().default("beginner"),
  notes: text("notes").default(""),
  controllingIdea: text("controlling_idea").default(""),
  dismissedGuideIds: text("dismissed_guide_ids", { mode: "json" }).$type<string[]>().default([]),
  intentionalViolations: text("intentional_violations", { mode: "json" })
    .$type<Record<string, { confirmed: boolean; purpose: string; timestamp: string }>>()
    .default({}),
  aiRules: text("ai_rules", { mode: "json" }).$type<any[]>().default([]),
  isHiggsfieldProject: integer("is_higgsfield_project", { mode: "boolean" }).default(false),
  narratorVoice: text("narrator_voice").default(""),
  narrativeStructure: text("narrative_structure").default("linear"),
  qualityGradingEnabled: integer("quality_grading_enabled", { mode: "boolean" }).default(false),
  aiismsCheck: integer("aiisms_check", { mode: "boolean" }).default(false),
  storyType: text("story_type").default("linear"),
  universeId: text("universe_id"),
  timelineSort: integer("timeline_sort"),
  phase: text("phase"),
  seriesParentId: text("series_parent_id"),
  adaptedFromProjectId: text("adapted_from_project_id"),
  biggestChallenge: text("biggest_challenge").default(""),
  aiInitiative: text("ai_initiative").default("Collaborates"),
  densityLevel: text("density_level").default("standard"),
  contentRevision: integer("content_revision"),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});
export const characters = sqliteTable("characters", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").default(""),
  age: text("age").default(""),
  appearance: text("appearance").default(""),
  personality: text("personality").default(""),
  thinkingStyle: text("thinking_style").default(""),
  behavior: text("behavior").default(""),
  habits: text("habits").default(""),
  fears: text("fears").default(""),
  desires: text("desires").default(""),
  speechPattern: text("speech_pattern").default(""),
  backstory: text("backstory").default(""),
  arc: text("arc").default(""),
  portraitUrl: text("portrait_url").default(""),
  soulId: text("soul_id").default(""),
  // Set when generate-package auto-kicks off Soul ID training for a character
  // it just created (see src/lib/production/soul-id-bootstrap.ts) - a pending
  // job awaiting completion. Cleared once soulId is set (completed) or once
  // training is confirmed failed. Lets the soul-id GET route poll by
  // characterId alone, without a caller needing to already know the jobId.
  soulIdTrainingJobId: text("soul_id_training_job_id").default(""),
  visualProfile: text("visual_profile").default(""),
  voiceProfile: text("voice_profile").default(""),
  voiceId: text("voice_id").default(""),
  structuralFunction: text("structural_function").default(""),
  voiceRegister: text("voice_register").default(""),
  voiceCompression: text("voice_compression").default(""),
  verbalTic: text("verbal_tic").default(""),
  linkedLocationIds: text("linked_location_ids", { mode: "json" }).$type<string[]>().default([]),
  linkedPlotThreadIds: text("linked_plot_thread_ids", { mode: "json" }).$type<string[]>().default([]),
  alwaysInContext: integer("always_in_context", { mode: "boolean" }).default(true),
  sortOrder: integer("sort_order").default(0),
  antagonistToggle: integer("antagonist_toggle", { mode: "boolean" }).default(false),
  antagonistType: text("antagonist_type").default(""),
  selfJustificationPattern: text("self_justification_pattern").default(""),
  moralFoundationProfile: text("moral_foundation_profile").default(""),
  // NVC Card (Phase 1)
  kinesicsBaseline: text("kinesics_baseline").default(""),
  kinesicsMicro: text("kinesics_micro").default(""),
  kinesicsIdiosyncrasy: text("kinesics_idiosyncrasy").default(""),
  proxemicsCulture: text("proxemics_culture").default(""),
  proxemicsIntimateList: text("proxemics_intimate_list").default(""),
  proxemicsViolationResponse: text("proxemics_violation_response").default(""),
  paralanguageBaseline: text("paralanguage_baseline").default(""),
  paralanguageStressDegradation: text("paralanguage_stress_degradation").default(""),
  paralanguageSignatureSound: text("paralanguage_signature_sound").default(""),
  hapticsTouchLevel: text("haptics_touch_level").default(""),
  hapticsTraumaModifier: text("haptics_trauma_modifier").default(""),
  chronemicsTimeType: text("chronemics_time_type").default(""),
  chronemicsLateness: text("chronemics_lateness").default(""),
  oculesicsDefault: text("oculesics_default").default(""),
  oculesicsDeception: text("oculesics_deception").default(""),
  objecticsSignature: text("objectics_signature").default(""),
  appearanceSignature: text("appearance_signature").default(""),
  appearanceTrajectory: text("appearance_trajectory").default(""),
  // Language Profile (Phase 2)
  nativeLanguage: text("native_language").default(""),
  acquiredLanguages: text("acquired_languages").default(""),
  dominantLanguageContext: text("dominant_language_context").default(""),
  languageLossHistory: text("language_loss_history").default(""),
  accentProfile: text("accent_profile").default(""),
  reversionTrigger: text("reversion_trigger").default(""),
  registerDefault: text("register_default").default(""),
  registerRange: text("register_range").default(""),
  codeSwitchingTriggers: text("code_switching_triggers").default(""),
  idiolectFingerprint: text("idiolect_fingerprint").default(""),
  // Flaw-Strength-Compensation (Phase 3)
  rootWound: text("root_wound").default(""),
  hamartia: text("hamartia").default(""),
  significantFlaws: text("significant_flaws", { mode: "json" }).$type<string[]>().default([]),
  cognitiveBias: text("cognitive_bias").default(""),
  blindSpot: text("blind_spot").default(""),
  strengthBranch: text("strength_branch").default(""),
  compensationMode: text("compensation_mode").default(""),
  compensationBehavior: text("compensation_behavior").default(""),
  compensationTrigger: text("compensation_trigger").default(""),
  flawArcMode: text("flaw_arc_mode").default(""),
  disabilityProfile: text("disability_profile").default(""),
  // Skill Card (Phase 4)
  skills: text("skills", { mode: "json" }).$type<any[]>().default([]),
  // World Logic Matrix (Phase 8)
  knowledgeMap: text("knowledge_map", { mode: "json" }).$type<Record<string, any>>().default({}),
  intelligenceProfile: text("intelligence_profile", { mode: "json" })
    .$type<Record<string, any>>()
    .default({}),
  culturalWorldview: text("cultural_worldview").default(""),
  characterWant: text("character_want").default(""),
  characterNeed: text("character_need").default(""),
  contradiction: text("contradiction").default(""),
  narratorBlindSpot: text("narrator_blind_spot").default(""),
  firstImpressionNote: text("first_impression_note").default(""),
  contextVisibility: text("context_visibility").default("always"),
  // pg: vectorColumn("embedding") — OMITTED (pgvector has no SQLite equivalent;
  // §4.2 degrade: embedding features off, noEmbedText stays the seam default).
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});
export const locations = sqliteTable("locations", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  atmosphere: text("atmosphere").default(""),
  history: text("history").default(""),
  sensoryDetails: text("sensory_details").default(""),
  linkedCharacterIds: text("linked_character_ids", { mode: "json" }).$type<string[]>().default([]),
  alwaysInContext: integer("always_in_context", { mode: "boolean" }).default(true),
  sortOrder: integer("sort_order").default(0),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});
export const plotThreads = sqliteTable("plot_threads", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  status: text("status").default("Active"),
  stakes: text("stakes").default(""),
  connections: text("connections").default(""),
  alwaysInContext: integer("always_in_context", { mode: "boolean" }).default(true),
  sortOrder: integer("sort_order").default(0),
  lastMentionedChapterId: text("last_mentioned_chapter_id"),
  starvationWarning: integer("starvation_warning", { mode: "boolean" }).default(false),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});
export const chapters = sqliteTable("chapters", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Chapter 1"),
  content: text("content").default(""),
  summary: text("summary").default(""),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  chapterType: text("chapter_type").default("chapter"),
  sortOrder: integer("sort_order").default(0),
  wordCount: integer("word_count").default(0),
  branchId: text("branch_id").default("main"),
  branchLabel: text("branch_label").default(""),
  parentChapterId: text("parent_chapter_id"),
  alternateDrafts: text("alternate_drafts", { mode: "json" }).$type<any[]>().default([]),
  emotionalTone: text("emotional_tone").default(""),
  arcPosition: text("arc_position").default(""),
  scenes: text("scenes", { mode: "json" }).$type<any[]>().default([]),
  storylineId: text("storyline_id"),
  reviewStatus: text("review_status").notNull().default("draft"),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

// First-class Editor artifact: persisted review findings (the approve-gate chokepoint).
// chapters.reviewStatus (draft|in_review|approved) is the gate flag the Produce
// pipelines check before paid generation. See docs MASTER-PLAN §3/§7.
export const editorNotes = sqliteTable("editor_notes", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("issue"),
  severity: text("severity").notNull().default("medium"),
  category: text("category").notNull().default("general"),
  message: text("message").notNull(),
  suggestedFix: text("suggested_fix").default(""),
  status: text("status").notNull().default("open"),
  source: text("source").notNull().default("manual"),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

// World Bible expansion: non-character/location/thread worldbuilding — objects,
// weapons, organizations, factions, phenomena, entities, concepts. One kind-tagged
// table (like editor_notes), grouped into sections in the UI. `properties` is a
// zod-typed JSONB blob (see src/lib/types/story.ts decodeWorldEntityProperties).
export const worldEntities = sqliteTable("world_entities", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("object"),
  name: text("name").notNull(),
  summary: text("summary").default(""),
  description: text("description").default(""),
  properties: text("properties", { mode: "json" }).$type<Record<string, unknown>>().default({}),
  linkedCharacterIds: text("linked_character_ids", { mode: "json" }).$type<string[]>().default([]),
  linkedLocationIds: text("linked_location_ids", { mode: "json" }).$type<string[]>().default([]),
  linkedPlotThreadIds: text("linked_plot_thread_ids", { mode: "json" }).$type<string[]>().default([]),
  linkedEntityIds: text("linked_entity_ids", { mode: "json" }).$type<string[]>().default([]),
  alwaysInContext: integer("always_in_context", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});
export const referenceWorks = sqliteTable("reference_works", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // pg: jsonb("attributes").$type() — zero-arg $type stays untyped (unknown).
  attributes: text("attributes", { mode: "json" }).default({}),
  createdAt: notNullNow("created_at"),
});
export const generations = sqliteTable("generations", {
  id: uuidPk("id"),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  mode: text("mode").notNull(),
  prompt: text("prompt").notNull(),
  output: text("output").notNull(),
  model: text("model").default("claude-sonnet-5"),
  tokensUsed: integer("tokens_used"),
  createdAt: notNullNow("created_at"),
});

// Story Transactions (v4 §13.1 slice 1, Phase 5A) — model-output-driven canonical
// edits with full provenance, persisted by the `applyStoryTransaction` handler
// BEFORE its changes touch canon, so audit/revert is possible later. `id` is
// deliberately text (the only non-uuid PK in this file — buf note: this file's
// duplicate of that comment aside, the ONLY PK WITHOUT a $defaultFn here): the
// handler supplies its own transaction id (injectable, with a random fallback
// token), which is persisted verbatim and referenced by the change rows.
export const storyTransactions = sqliteTable("story_transactions", {
  id: text("id").notNull().primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  sourceGenerationId: text("source_generation_id"),
  createdAt: notNullNow("created_at"),
});
export const storyChanges = sqliteTable("story_changes", {
  id: uuidPk("id"),
  transactionId: text("transaction_id").notNull().references(() => storyTransactions.id, {
    onDelete: "cascade",
  }),
  // Denormalized from story_transactions so audit queries can scope a project
  // without joining through the transaction row.
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  entityKey: text("entity_key").notNull(),
  entityId: text("entity_id").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value").default("").notNull(),
  newValue: text("new_value").notNull(),
});

export const creatorBibles = sqliteTable("creator_bibles", {
  id: uuidPk("id"),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  channelName: text("channel_name").default(""),
  niche: text("niche").default(""),
  audienceAge: text("audience_age").default(""),
  audienceInterests: text("audience_interests").default(""),
  audiencePainPoints: text("audience_pain_points").default(""),
  channelVoice: text("channel_voice").default(""),
  contentPillars: text("content_pillars", { mode: "json" }).$type<string[]>().default([]),
  competitorNotes: text("competitor_notes").default(""),
  defaultCta: text("default_cta").default(""),
  cohostVoice: text("cohost_voice").default("none"),
  hookMemory: text("hook_memory", { mode: "json" }).$type<string[]>().default([]),
  tiktokHandle: text("tiktok_handle").default(""),
  tiktokNiche: text("tiktok_niche").default(""),
  soundStrategy: text("sound_strategy").default(""),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const storyMemories = sqliteTable("story_memories", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  fact: text("fact").notNull(),
  category: text("category").default("general"),
  autoExtracted: integer("auto_extracted", { mode: "boolean" }).default(true),
  chapterIndex: integer("chapter_index").default(0),
  structuredData: text("structured_data", { mode: "json" }).$type<{
    chapterTitle?: string;
    arcPosition?: string;
    charactersPresent?: string[];
    keyEvents?: string[];
    objectsIntroduced?: string[];
    knowledgeShifts?: { character: string; learned: string; from: string; to: string }[];
    decisionsAndConsequences?: string[];
    emotionalStateEnd?: Record<string, string>;
    openPromisesCreated?: string[];
    openPromisesResolved?: string[];
  }>(),
  createdAt: notNullNow("created_at"),
});

export const characterEvolutionLog = sqliteTable("character_evolution_log", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull().references(() => characters.id, {
    onDelete: "cascade",
  }),
  chapterIndex: integer("chapter_index").notNull(),
  // pg: text[].array() DEFAULT '{}' (a pg text-array literal) — SQLite stores a
  // JSON array blob; the empty-default becomes [].
  triggerMemoryIds: text("trigger_memory_ids", { mode: "json" }).$type<string[]>().default([]),
  previousState: text("previous_state", { mode: "json" }).notNull().default({}),
  updatedTraits: text("updated_traits", { mode: "json" }).notNull().default({}),
  evolutionSummary: text("evolution_summary").notNull().default(""),
  createdAt: notNullNow("created_at"),
});

export const comicPages = sqliteTable("comic_pages", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull().default(1),
  artStyle: text("art_style").notNull().default("manga"),
  createdAt: notNullNow("created_at"),
});

export const comicPanels = sqliteTable("comic_panels", {
  id: uuidPk("id"),
  pageId: text("page_id").notNull().references(() => comicPages.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  panelIndex: integer("panel_index").notNull(),
  imageUrl: text("image_url").notNull(),
  panelPrompt: text("panel_prompt").notNull(),
  referenceImageUrl: text("reference_image_url").default(""),
  // Which World Bible character this panel depicts (by name, matching the
  // scene-breakdown's `spec.characters[0]`) — lets regenerate re-resolve a
  // LIVE soulId/portraitUrl instead of relying on the (possibly stale, and
  // previously conflated-with-soulId) referenceImageUrl column above.
  characterName: text("character_name").default(""),
  artStylePreset: text("art_style_preset").default(""),
  dialogue: text("dialogue").default(""),
  caption: text("caption").default(""),
  speakerName: text("speaker_name").default(""),
  // Compositing output (FIX B1) — never overwrites imageUrl, so re-lettering
  // after a text edit never requires regenerating art.
  letteredImageUrl: text("lettered_image_url").default(""),
  bubbleType: text("bubble_type").default("speech"),
  // Phase B vision-critic score (docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md).
  // Written after generation, never blocks it — silent data collection for the
  // future Phase C review UI, not a gate.
  qualityScore: real("quality_score"),
  qualityWeakest: text("quality_weakest"),
  qualityNote: text("quality_note").default(""),
  // Phase C review gate (docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md).
  // Mirrors chapters.reviewStatus's draft/approved pattern; "needs_rework" reframes
  // the doc's "reject" — a flagged panel isn't deleted, it needs another pass.
  reviewStatus: text("review_status").notNull().default("draft"),
  // Phase C "keep N candidates" mode, 2026-07-06. Additive per the gap-analysis
  // doc's own note: the generation route still produces one URL per call, this
  // is just an array alongside imageUrl instead of a rewrite. imageUrl is always
  // the current primary/selected candidate; this array holds the others.
  candidateImageUrls: text("candidate_image_urls", { mode: "json" }).$type<string[]>().default([]),
  createdAt: notNullNow("created_at"),
});

export const productionShots = sqliteTable("production_shots", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  sceneNumber: integer("scene_number").notNull().default(1),
  shotNumber: integer("shot_number").notNull().default(1),
  shotType: text("shot_type").default("Medium shot"),
  cameraMovement: text("camera_movement").default("Static"),
  lightingMood: text("lighting_mood").default("Golden hour"),
  timeOfDay: text("time_of_day").default("Afternoon"),
  subject: text("subject").default(""),
  action: text("action").default(""),
  location: text("location").default(""),
  mood: text("mood").default(""),
  primaryCharacterId: text("primary_character_id").references(() => characters.id, {
    onDelete: "set null",
  }),
  soulPrompt: text("soul_prompt").default(""),
  videoPrompt: text("video_prompt").default(""),
  multiShotScript: text("multi_shot_script").default(""),
  dialogue: text("dialogue").default(""),
  speaker: text("speaker").default(""),
  previewImageUrl: text("preview_image_url").default(""),
  animatedVideoUrl: text("animated_video_url").default(""),
  finalVideoUrl: text("final_video_url").default(""),
  sceneFinalVideoUrl: text("scene_final_video_url").default(""),
  generationStatus: text("generation_status").default("idle"),
  generationError: text("generation_error").default(""),
  higgsfieldJobId: text("higgsfield_job_id").default(""),
  cameraPreset: text("camera_preset").default(""),
  viralPreset: text("viral_preset").default(""),
  characterEmotion: text("character_emotion").default(""),
  focalLength: text("focal_length").default(""),
  duration: integer("duration").default(5),
  aspectRatio: text("aspect_ratio").default("16:9"),
  generatedVideoUrl: text("generated_video_url").default(""),
  sortOrder: integer("sort_order").default(0),
  // Phase B vision-critic score, same as comicPanels above.
  qualityScore: real("quality_score"),
  qualityWeakest: text("quality_weakest"),
  qualityNote: text("quality_note").default(""),
  // Phase C review gate, same as comicPanels above.
  reviewStatus: text("review_status").notNull().default("draft"),
  // Phase C "keep N candidates" mode, same as comicPanels above — previewImageUrl
  // stays the primary/selected candidate, this array holds the others.
  candidatePreviewUrls: text("candidate_preview_urls", { mode: "json" })
    .$type<string[]>()
    .default([]),
  // Post-production slice 2b: per-shot trim before scene stitching. Null =
  // no trim (use the clip as generated). trimEndSec null = trim start only,
  // keep to the clip's natural end.
  trimStartSec: real("trim_start_sec"),
  trimEndSec: real("trim_end_sec"),
  // Post-production slice 2c: an uploaded background-music track for this
  // scene, mixed into sceneFinalVideoUrl by the add-music route. Redundant
  // per-shot-row, mirroring sceneFinalVideoUrl's own existing convention.
  sceneAudioTrackUrl: text("scene_audio_track_url").default(""),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const audioExports = sqliteTable("audio_exports", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").notNull(),
  // "narration" (default, existing Audio Novel behavior) or "podcast" (item 71:
  // two-host discussion mode, distinct script/voice pipeline).
  mode: text("mode").notNull().default("narration"),
  status: text("status").notNull().default("pending"),
  audioUrl: text("audio_url").default(""),
  durationSeconds: integer("duration_seconds").default(0),
  characterCount: integer("character_count").default(0),
  estimatedCost: text("estimated_cost").default(""),
  lipsyncVideoUrl: text("lipsync_video_url").default(""),
  lipsyncJobId: text("lipsync_job_id").default(""),
  lipsyncStatus: text("lipsync_status").default(""),
  createdAt: notNullNow("created_at"),
});

export const videoAnalysisJobs = sqliteTable("video_analysis_jobs", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  youtubeUrl: text("youtube_url").notNull(),
  status: text("status").default("pending"),
  result: text("result", { mode: "json" }).$type<Record<string, any>>(),
  errorMessage: text("error_message"),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const readerSessions = sqliteTable("reader_sessions", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: epochMs("expires_at").notNull(),
  createdAt: notNullNow("created_at"),
});

export const readerReactions = sqliteTable("reader_reactions", {
  id: uuidPk("id"),
  sessionId: text("session_id").notNull().references(() => readerSessions.id, {
    onDelete: "cascade",
  }),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  textOffset: integer("text_offset").notNull(),
  reactionType: text("reaction_type").notNull(),
  createdAt: notNullNow("created_at"),
});

// Showcase area: personal shareable link + cross-user discovery feed.
// visibility follows itch.io's model (researched live 2026-07-06): private
// (owner-only, default) / unlisted (works via slug link, not indexed) /
// public (indexed in the discovery feed). One showcase per project (unique
// projectId) — keeps the v1 data model simple. flagged/flagReason implement
// the researched "publish-then-flag" moderation approach — content goes
// live immediately, a report sets flagged, an admin acts after the fact.
export const showcases = sqliteTable("showcases", {
  id: uuidPk("id"),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull().default(""),
  blurb: text("blurb").default(""),
  visibility: text("visibility").notNull().default("private"),
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  flagReason: text("flag_reason").default(""),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const characterRelationships = sqliteTable("character_relationships", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characterAId: text("character_a_id").notNull().references(() => characters.id, {
    onDelete: "cascade",
  }),
  characterBId: text("character_b_id").notNull().references(() => characters.id, {
    onDelete: "cascade",
  }),
  trustLevel: integer("trust_level").default(50),
  relationshipType: text("relationship_type").default(""),
  fourHorsemen: text("four_horsemen", { mode: "json" })
    .$type<{
      criticism: number;
      contempt: number;
      defensiveness: number;
      stonewalling: number;
    }>()
    .default({ criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 }),
  notes: text("notes").default(""),
  powerDifferential: integer("power_differential").default(0),
  emotionalRegister: text("emotional_register").default(""),
  knowledgeAsymmetry: text("knowledge_asymmetry").default(""),
  dependencyStructure: text("dependency_structure").default("none"),
  attachmentStyleA: text("attachment_style_a").default(""),
  arcTrajectory: text("arc_trajectory").default(""),
  updatedAt: notNullNow("updated_at"),
});

export const workPackets = sqliteTable("work_packets", {
  id: uuidPk("id"),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  creator: text("creator").default(""),
  medium: text("medium").notNull(),
  genres: text("genres", { mode: "json" }).$type<string[]>().default([]),
  craftPrinciples: text("craft_principles", { mode: "json" }).$type<any[]>().default([]),
  structuralNotes: text("structural_notes").default(""),
  characterNotes: text("character_notes").default(""),
  dialogueNotes: text("dialogue_notes").default(""),
  thematicCore: text("thematic_core").default(""),
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  status: text("status").default("seeded"),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
});

export const workPatterns = sqliteTable("work_patterns", {
  id: uuidPk("id"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  medium: text("medium").default("cross-medium"),
  genres: text("genres", { mode: "json" }).$type<string[]>().default([]),
  supportingPacketIds: text("supporting_packet_ids", { mode: "json" }).$type<string[]>().default([]),
  generationDirective: text("generation_directive").notNull(),
  applicableTo: text("applicable_to", { mode: "json" }).$type<string[]>().default([]),
  isPublic: integer("is_public", { mode: "boolean" }).default(true),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
});

export const storyThreads = sqliteTable("story_threads", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  threadType: text("thread_type").default("subplot"),
  status: text("status").default("open"),
  openedAtChapterId: text("opened_at_chapter_id"),
  resolvedAtChapterId: text("resolved_at_chapter_id"),
  notes: text("notes").default(""),
  createdAt: notNullNow("created_at"),
});

export const storyPromises = sqliteTable("story_promises", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  threadId: text("thread_id").references(() => storyThreads.id, { onDelete: "set null" }),
  setup: text("setup").notNull(),
  setupChapterId: text("setup_chapter_id"),
  payoffIntent: text("payoff_intent").default(""),
  payoffChapterId: text("payoff_chapter_id"),
  status: text("status").default("open"),
  priority: text("priority").default("B"),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  createdAt: notNullNow("created_at"),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: uuidPk("id"),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  // "free" | "story_pro" | "creator_pro" | "all_access"
  tier: text("tier").notNull().default("free"),
  // "active" | "cancelled" | "past_due" | "trialing"
  status: text("status").notNull().default("active"),
  currentPeriodEnd: epochMs("current_period_end"),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const storyCheckpoints = sqliteTable("story_checkpoints", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  notes: text("notes").default(""),
  snapshot: text("snapshot", { mode: "json" })
    .$type<{
      totalWordCount: number;
      chapterCount: number;
      chapters: { id: string; title: string; wordCount: number; arcPosition: string }[];
      openThreadCount: number;
      openPromises: number;
      healthScore: number;
    }>()
    .notNull(),
  createdAt: notNullNow("created_at"),
});

// First-class Director artifact: a structured, persisted beat sheet (the `beats`
// JSONB is zod-guarded via decodeStoryBeats/encodeStoryBeats in src/lib/types/story.ts).
// `kind` is generic so outline/production-plan can join later without a new table.
export const storyPlans = sqliteTable("story_plans", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("beat_sheet"),
  title: text("title").notNull().default("Beat Sheet"),
  beats: text("beats", { mode: "json" }).$type<unknown[]>().notNull().default([]),
  status: text("status").notNull().default("draft"),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const seriesBibles = sqliteTable("series_bibles", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  premise: text("premise").default(""),
  tone: text("tone").default(""),
  worldRules: text("world_rules", { mode: "json" }).$type<string[]>().default([]),
  seriesCharacterArcs: text("series_character_arcs", { mode: "json" })
    .$type<{
      characterName: string;
      arcSummary: string;
      booksInvolved: string[];
    }[]>()
    .default([]),
  continuityNotes: text("continuity_notes").default(""),
  projectIds: text("project_ids", { mode: "json" }).$type<string[]>().default([]),
  timeline: text("timeline", { mode: "json" })
    .$type<{
      event: string;
      period: string;
      projectId?: string;
    }[]>()
    .default([]),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const referrals = sqliteTable("referrals", {
  id: uuidPk("id"),
  referrerId: text("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refereeId: text("referee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("pending"),
  rewardApplied: integer("reward_applied", { mode: "boolean" }).default(false),
  createdAt: notNullNow("created_at"),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: epochMs("expires_at").notNull(),
  usedAt: epochMs("used_at"),
  createdAt: notNullNow("created_at"),
});

export const emailVerificationTokens = sqliteTable("email_verification_tokens", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: epochMs("expires_at").notNull(),
  usedAt: epochMs("used_at"),
  createdAt: notNullNow("created_at"),
});

export const platformEvents = sqliteTable("platform_events", {
  id: uuidPk("id"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  event: text("event").notNull(),
  properties: text("properties", { mode: "json" })
    .$type<Record<string, string | number | boolean>>()
    .default({}),
  createdAt: notNullNow("created_at"),
});

// Sprint 22: Series + Universe tables
export const universes = sqliteTable("universes", {
  id: uuidPk("id"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  premise: text("premise").default(""),
  sharedRules: text("shared_rules", { mode: "json" }).$type<string[]>().default([]),
  tone: text("tone").default(""),
  createdAt: notNullNow("created_at"),
  updatedAt: notNullNow("updated_at"),
});

export const universeCharacters = sqliteTable("universe_characters", {
  id: uuidPk("id"),
  universeId: text("universe_id").notNull().references(() => universes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseProfile: text("base_profile", { mode: "json" }).$type<Record<string, any>>(),
  isAlive: integer("is_alive", { mode: "boolean" }).default(true),
  createdAt: notNullNow("created_at"),
});

export const projectCharacterStates = sqliteTable("project_character_states", {
  id: uuidPk("id"),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  universeCharId: text("universe_char_id")
    .notNull()
    .references(() => universeCharacters.id, { onDelete: "cascade" }),
  knowledgeOverride: text("knowledge_override", { mode: "json" }).$type<Record<string, any>>(),
  emotionalState: text("emotional_state"),
  stateNotes: text("state_notes"),
  isDeceased: integer("is_deceased", { mode: "boolean" }).default(false),
  createdAt: notNullNow("created_at"),
});

export const universeEvents = sqliteTable("universe_events", {
  id: uuidPk("id"),
  universeId: text("universe_id").notNull().references(() => universes.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  timelineSort: integer("timeline_sort").notNull(),
  isCanon: integer("is_canon", { mode: "boolean" }).default(true),
  createdAt: notNullNow("created_at"),
});

export const semanticCache = sqliteTable("semantic_cache", {
  id: uuidPk("id"),
  cacheType: text("cache_type").notNull(),
  inputKey: text("input_key").notNull(),
  // pg: vectorColumn("embedding") — OMITTED (see characters).
  cachedOutput: text("cached_output", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  hitCount: integer("hit_count").default(0),
  createdAt: notNullNow("created_at"),
  lastHitAt: epochMs("last_hit_at"),
});

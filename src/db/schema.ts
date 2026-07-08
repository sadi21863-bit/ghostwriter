import { pgTable, text, timestamp, integer, real, jsonb, varchar, uuid, boolean, customType } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// pgvector column type — requires: CREATE EXTENSION IF NOT EXISTS vector; on Neon first
const vectorColumn = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector(1536)'; },
  toDriver(value: number[]): string { return JSON.stringify(value); },
  fromDriver(value: string): number[] {
    try { return JSON.parse(value); } catch { return []; }
  },
});

export const users = pgTable("users", { id: uuid("id").defaultRandom().primaryKey(), name: text("name"), email: text("email").notNull().unique(), emailVerified: timestamp("email_verified", { mode: "date" }), image: text("image"), hashedPassword: text("hashed_password"), higgsfieldApiKey: text("higgsfield_api_key").default(""), higgsfieldApiSecret: text("higgsfield_api_secret").default(""), segmindApiKey: text("segmind_api_key").default(""), openaiApiKey: text("openai_api_key").default(""), imageProviderId: text("image_provider_id").default("segmind_soul"), ttsProviderId: text("tts_provider_id").default("openai"), trendIntelligenceKey: text("trend_intelligence_key").default(""), referralCode: varchar("referral_code", { length: 12 }), monthlyGenerations: real("monthly_generations").default(0), monthlyGenerationsResetAt: timestamp("monthly_generations_reset_at"), trialEndAt: timestamp("trial_end_at"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const accounts = pgTable("accounts", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), type: text("type").notNull(), provider: text("provider").notNull(), providerAccountId: text("provider_account_id").notNull(), refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: integer("expires_at"), token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state") });
export const sessions = pgTable("sessions", { id: uuid("id").defaultRandom().primaryKey(), sessionToken: text("session_token").notNull().unique(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), expires: timestamp("expires", { mode: "date" }).notNull() });
export const projects = pgTable("projects", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), name: text("name").notNull().default("Untitled Project"), format: varchar("format", { length: 50 }).notNull().default("Novel"), genres: jsonb("genres").$type().default([]), skillLevel: varchar("skill_level", { length: 20 }).notNull().default("beginner"), notes: text("notes").default(""), controllingIdea: text("controlling_idea").default(""), dismissedGuideIds: jsonb("dismissed_guide_ids").$type<string[]>().default([]), intentionalViolations: jsonb("intentional_violations").$type<Record<string, { confirmed: boolean; purpose: string; timestamp: string }>>().default({}), aiRules: jsonb("ai_rules").$type<any[]>().default([]), isHiggsfieldProject: boolean("is_higgsfield_project").default(false), narratorVoice: text("narrator_voice").default(""), narrativeStructure: varchar("narrative_structure", { length: 30 }).default("linear"), qualityGradingEnabled: boolean("quality_grading_enabled").default(false), aiismsCheck: boolean("aiisms_check").default(false), storyType: varchar("story_type", { length: 20 }).default("linear"), universeId: uuid("universe_id"), timelineSort: integer("timeline_sort"), phase: text("phase"), seriesParentId: uuid("series_parent_id"), adaptedFromProjectId: uuid("adapted_from_project_id"), biggestChallenge: text("biggest_challenge").default(""), aiInitiative: varchar("ai_initiative", { length: 20 }).default("Collaborates"), densityLevel: varchar("density_level", { length: 10 }).default("standard"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
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
  visualProfile: text("visual_profile").default(""),
  voiceProfile: text("voice_profile").default(""),
  voiceId: text("voice_id").default(""),
  structuralFunction: text("structural_function").default(""),
  voiceRegister: text("voice_register").default(""),
  voiceCompression: text("voice_compression").default(""),
  verbalTic: text("verbal_tic").default(""),
  linkedLocationIds: jsonb("linked_location_ids").$type<string[]>().default([]),
  linkedPlotThreadIds: jsonb("linked_plot_thread_ids").$type<string[]>().default([]),
  alwaysInContext: boolean("always_in_context").default(true),
  sortOrder: integer("sort_order").default(0),
  antagonistToggle: boolean("antagonist_toggle").default(false),
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
  significantFlaws: jsonb("significant_flaws").$type<string[]>().default([]),
  cognitiveBias: text("cognitive_bias").default(""),
  blindSpot: text("blind_spot").default(""),
  strengthBranch: text("strength_branch").default(""),
  compensationMode: text("compensation_mode").default(""),
  compensationBehavior: text("compensation_behavior").default(""),
  compensationTrigger: text("compensation_trigger").default(""),
  flawArcMode: text("flaw_arc_mode").default(""),
  disabilityProfile: text("disability_profile").default(""),
  // Skill Card (Phase 4)
  skills: jsonb("skills").$type<any[]>().default([]),
  // World Logic Matrix (Phase 8)
  knowledgeMap:        jsonb("knowledge_map").$type<Record<string, any>>().default({}),
  intelligenceProfile: jsonb("intelligence_profile").$type<Record<string, any>>().default({}),
  culturalWorldview:   text("cultural_worldview").default(""),
  characterWant:       text("character_want").default(""),
  characterNeed:       text("character_need").default(""),
  contradiction:       text("contradiction").default(""),
  narratorBlindSpot:   text("narrator_blind_spot").default(""),
  firstImpressionNote: text("first_impression_note").default(""),
  contextVisibility: varchar("context_visibility", { length: 20 }).default("always"),
  embedding: vectorColumn("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const locations = pgTable("locations", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), name: text("name").notNull(), description: text("description").default(""), atmosphere: text("atmosphere").default(""), history: text("history").default(""), sensoryDetails: text("sensory_details").default(""), linkedCharacterIds: jsonb("linked_character_ids").$type<string[]>().default([]), alwaysInContext: boolean("always_in_context").default(true), sortOrder: integer("sort_order").default(0), embedding: vectorColumn("embedding"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const plotThreads = pgTable("plot_threads", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), name: text("name").notNull(), description: text("description").default(""), status: varchar("status", { length: 20 }).default("Active"), stakes: text("stakes").default(""), connections: text("connections").default(""), alwaysInContext: boolean("always_in_context").default(true), sortOrder: integer("sort_order").default(0), lastMentionedChapterId: uuid("last_mentioned_chapter_id"), starvationWarning: boolean("starvation_warning").default(false), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const chapters = pgTable("chapters", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), title: text("title").notNull().default("Chapter 1"), content: text("content").default(""), summary: text("summary").default(""), tags: jsonb("tags").$type<string[]>().default([]), chapterType: varchar("chapter_type", { length: 30 }).default("chapter"), sortOrder: integer("sort_order").default(0), wordCount: integer("word_count").default(0), branchId: text("branch_id").default("main"), branchLabel: text("branch_label").default(""), parentChapterId: uuid("parent_chapter_id"), alternateDrafts: jsonb("alternate_drafts").$type<any[]>().default([]), emotionalTone: varchar("emotional_tone", { length: 50 }).default(""), arcPosition: varchar("arc_position", { length: 40 }).default(""), scenes: jsonb("scenes").$type<any[]>().default([]), storylineId: text("storyline_id"), reviewStatus: varchar("review_status", { length: 12 }).notNull().default("draft"), embedding: vectorColumn("embedding"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });

// First-class Editor artifact: persisted review findings (the approve-gate chokepoint).
// chapters.reviewStatus (draft|in_review|approved) is the gate flag the Produce
// pipelines check before paid generation. See docs MASTER-PLAN §3/§7.
export const editorNotes = pgTable("editor_notes", {
  id:           uuid("id").defaultRandom().primaryKey(),
  projectId:    uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId:    uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  type:         varchar("type", { length: 12 }).notNull().default("issue"),
  severity:     varchar("severity", { length: 8 }).notNull().default("medium"),
  category:     varchar("category", { length: 24 }).notNull().default("general"),
  message:      text("message").notNull(),
  suggestedFix: text("suggested_fix").default(""),
  status:       varchar("status", { length: 10 }).notNull().default("open"),
  source:       varchar("source", { length: 16 }).notNull().default("manual"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

// World Bible expansion: non-character/location/thread worldbuilding — objects,
// weapons, organizations, factions, phenomena, entities, concepts. One kind-tagged
// table (like editor_notes), grouped into sections in the UI. `properties` is a
// zod-typed JSONB blob (see src/lib/types/story.ts decodeWorldEntityProperties).
export const worldEntities = pgTable("world_entities", {
  id:                  uuid("id").defaultRandom().primaryKey(),
  projectId:           uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind:                varchar("kind", { length: 16 }).notNull().default("object"),
  name:                text("name").notNull(),
  summary:             text("summary").default(""),
  description:         text("description").default(""),
  properties:          jsonb("properties").$type<Record<string, unknown>>().default({}),
  linkedCharacterIds:  jsonb("linked_character_ids").$type<string[]>().default([]),
  linkedLocationIds:   jsonb("linked_location_ids").$type<string[]>().default([]),
  linkedPlotThreadIds: jsonb("linked_plot_thread_ids").$type<string[]>().default([]),
  linkedEntityIds:     jsonb("linked_entity_ids").$type<string[]>().default([]),
  alwaysInContext:     boolean("always_in_context").default(false),
  sortOrder:           integer("sort_order").default(0),
  embedding:           vectorColumn("embedding"),
  createdAt:           timestamp("created_at").defaultNow(),
  updatedAt:           timestamp("updated_at").defaultNow(),
});
export const referenceWorks = pgTable("reference_works", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), title: text("title").notNull(), attributes: jsonb("attributes").$type().default({}), createdAt: timestamp("created_at").defaultNow().notNull() });
export const generations = pgTable("generations", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }), chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }), mode: varchar("mode", { length: 50 }).notNull(), prompt: text("prompt").notNull(), output: text("output").notNull(), model: varchar("model", { length: 100 }).default("claude-sonnet-5"), tokensUsed: integer("tokens_used"), createdAt: timestamp("created_at").defaultNow().notNull() });

export const creatorBibles = pgTable("creator_bibles", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  channelName:        text("channel_name").default(""),
  niche:              text("niche").default(""),
  audienceAge:        text("audience_age").default(""),
  audienceInterests:  text("audience_interests").default(""),
  audiencePainPoints: text("audience_pain_points").default(""),
  channelVoice:       text("channel_voice").default(""),
  contentPillars:     jsonb("content_pillars").$type<string[]>().default([]),
  competitorNotes:    text("competitor_notes").default(""),
  defaultCta:         text("default_cta").default(""),
  cohostVoice:        varchar("cohost_voice", { length: 50 }).default("none"),
  hookMemory:         jsonb("hook_memory").$type<string[]>().default([]),
  tiktokHandle:       text("tiktok_handle").default(""),
  tiktokNiche:        text("tiktok_niche").default(""),
  soundStrategy:      text("sound_strategy").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storyMemories = pgTable("story_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  fact: text("fact").notNull(),
  category: varchar("category", { length: 30 }).default("general"),
  autoExtracted: boolean("auto_extracted").default(true),
  chapterIndex: integer("chapter_index").default(0),
  structuredData: jsonb("structured_data").$type<{
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const characterEvolutionLog = pgTable("character_evolution_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  chapterIndex: integer("chapter_index").notNull(),
  triggerMemoryIds: text("trigger_memory_ids").array().notNull().default(sql`'{}'`),
  previousState: jsonb("previous_state").notNull().default(sql`'{}'`),
  updatedTraits: jsonb("updated_traits").notNull().default(sql`'{}'`),
  evolutionSummary: text("evolution_summary").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comicPages = pgTable("comic_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull().default(1),
  artStyle: text("art_style").notNull().default("manga"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comicPanels = pgTable("comic_panels", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id").notNull().references(() => comicPages.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
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
  bubbleType: varchar("bubble_type", { length: 20 }).default("speech"),
  // Phase B vision-critic score (docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md).
  // Written after generation, never blocks it — silent data collection for the
  // future Phase C review UI, not a gate.
  qualityScore: real("quality_score"),
  qualityWeakest: varchar("quality_weakest", { length: 30 }),
  qualityNote: text("quality_note").default(""),
  // Phase C review gate (docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md).
  // Mirrors chapters.reviewStatus's draft/approved pattern; "needs_rework" reframes
  // the doc's "reject" — a flagged panel isn't deleted, it needs another pass.
  reviewStatus: varchar("review_status", { length: 12 }).notNull().default("draft"),
  // Phase C "keep N candidates" mode, 2026-07-06. Additive per the gap-analysis
  // doc's own note: the generation route still produces one URL per call, this
  // is just an array alongside imageUrl instead of a rewrite. imageUrl is always
  // the current primary/selected candidate; this array holds the others.
  candidateImageUrls: jsonb("candidate_image_urls").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productionShots = pgTable("production_shots", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  sceneNumber:        integer("scene_number").notNull().default(1),
  shotNumber:         integer("shot_number").notNull().default(1),
  shotType:           text("shot_type").default("Medium shot"),
  cameraMovement:     text("camera_movement").default("Static"),
  lightingMood:       text("lighting_mood").default("Golden hour"),
  timeOfDay:          text("time_of_day").default("Afternoon"),
  subject:            text("subject").default(""),
  action:             text("action").default(""),
  location:           text("location").default(""),
  mood:               text("mood").default(""),
  primaryCharacterId: uuid("primary_character_id").references(() => characters.id, { onDelete: "set null" }),
  soulPrompt:         text("soul_prompt").default(""),
  videoPrompt:        text("video_prompt").default(""),
  multiShotScript:    text("multi_shot_script").default(""),
  dialogue:           text("dialogue").default(""),
  speaker:            text("speaker").default(""),
  previewImageUrl:    text("preview_image_url").default(""),
  animatedVideoUrl:   text("animated_video_url").default(""),
  finalVideoUrl:      text("final_video_url").default(""),
  sceneFinalVideoUrl: text("scene_final_video_url").default(""),
  generationStatus:   varchar("generation_status", { length: 30 }).default("idle"),
  generationError:    text("generation_error").default(""),
  higgsfieldJobId:    text("higgsfield_job_id").default(""),
  cameraPreset:       text("camera_preset").default(""),
  viralPreset:        text("viral_preset").default(""),
  characterEmotion:   text("character_emotion").default(""),
  focalLength:        text("focal_length").default(""),
  duration:           integer("duration").default(5),
  aspectRatio:        text("aspect_ratio").default("16:9"),
  generatedVideoUrl:  text("generated_video_url").default(""),
  sortOrder:          integer("sort_order").default(0),
  // Phase B vision-critic score, same as comicPanels above.
  qualityScore:       real("quality_score"),
  qualityWeakest:     varchar("quality_weakest", { length: 30 }),
  qualityNote:        text("quality_note").default(""),
  // Phase C review gate, same as comicPanels above.
  reviewStatus:       varchar("review_status", { length: 12 }).notNull().default("draft"),
  // Phase C "keep N candidates" mode, same as comicPanels above — previewImageUrl
  // stays the primary/selected candidate, this array holds the others.
  candidatePreviewUrls: jsonb("candidate_preview_urls").$type<string[]>().default([]),
  // Post-production slice 2b: per-shot trim before scene stitching. Null =
  // no trim (use the clip as generated). trimEndSec null = trim start only,
  // keep to the clip's natural end.
  trimStartSec: real("trim_start_sec"),
  trimEndSec:   real("trim_end_sec"),
  // Post-production slice 2c: an uploaded background-music track for this
  // scene, mixed into sceneFinalVideoUrl by the add-music route. Redundant
  // per-shot-row, mirroring sceneFinalVideoUrl's own existing convention.
  sceneAudioTrackUrl: text("scene_audio_track_url").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const audioExports = pgTable("audio_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").notNull(),
  status: text("status").notNull().default("pending"),
  audioUrl: text("audio_url").default(""),
  durationSeconds: integer("duration_seconds").default(0),
  characterCount: integer("character_count").default(0),
  estimatedCost: text("estimated_cost").default(""),
  lipsyncVideoUrl: text("lipsync_video_url").default(""),
  lipsyncJobId:    text("lipsync_job_id").default(""),
  lipsyncStatus:   text("lipsync_status").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const videoAnalysisJobs = pgTable("video_analysis_jobs", {
  id:           uuid("id").defaultRandom().primaryKey(),
  userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  youtubeUrl:   text("youtube_url").notNull(),
  status:       varchar("status", { length: 20 }).default("pending"),
  result:       jsonb("result").$type<Record<string, any>>(),
  errorMessage: text("error_message"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const readerSessions = pgTable("reader_sessions", {
  id:        uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const readerReactions = pgTable("reader_reactions", {
  id:           uuid("id").defaultRandom().primaryKey(),
  sessionId:    uuid("session_id").notNull().references(() => readerSessions.id, { onDelete: "cascade" }),
  chapterId:    uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  textOffset:   integer("text_offset").notNull(),
  reactionType: text("reaction_type").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// Showcase area: personal shareable link + cross-user discovery feed.
// visibility follows itch.io's model (researched live 2026-07-06): private
// (owner-only, default) / unlisted (works via slug link, not indexed) /
// public (indexed in the discovery feed). One showcase per project (unique
// projectId) — keeps the v1 data model simple. flagged/flagReason implement
// the researched "publish-then-flag" moderation approach — content goes
// live immediately, a report sets flagged, an admin acts after the fact.
export const showcases = pgTable("showcases", {
  id:         uuid("id").defaultRandom().primaryKey(),
  projectId:  uuid("project_id").notNull().unique().references(() => projects.id, { onDelete: "cascade" }),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug:       text("slug").notNull().unique(),
  title:      text("title").notNull().default(""),
  blurb:      text("blurb").default(""),
  visibility: varchar("visibility", { length: 10 }).notNull().default("private"),
  flagged:      boolean("flagged").notNull().default(false),
  flagReason:   text("flag_reason").default(""),
  embedding:  vectorColumn("embedding"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export const characterRelationships = pgTable("character_relationships", {
  id:               uuid("id").defaultRandom().primaryKey(),
  projectId:        uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characterAId:     uuid("character_a_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  characterBId:     uuid("character_b_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  trustLevel:       integer("trust_level").default(50),
  relationshipType: text("relationship_type").default(""),
  fourHorsemen:     jsonb("four_horsemen").$type<{
    criticism: number; contempt: number; defensiveness: number; stonewalling: number;
  }>().default({ criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 }),
  notes:            text("notes").default(""),
  powerDifferential:   integer("power_differential").default(0),
  emotionalRegister:   varchar("emotional_register", { length: 50 }).default(""),
  knowledgeAsymmetry:  text("knowledge_asymmetry").default(""),
  dependencyStructure: varchar("dependency_structure", { length: 50 }).default("none"),
  attachmentStyleA:    varchar("attachment_style_a", { length: 30 }).default(""),
  arcTrajectory:       varchar("arc_trajectory", { length: 30 }).default(""),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export const workPackets = pgTable("work_packets", {
  id:               uuid("id").defaultRandom().primaryKey(),
  userId:           uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title:            text("title").notNull(),
  creator:          text("creator").default(""),
  medium:           varchar("medium", { length: 30 }).notNull(),
  genres:           jsonb("genres").$type<string[]>().default([]),
  craftPrinciples:  jsonb("craft_principles").$type<any[]>().default([]),
  structuralNotes:  text("structural_notes").default(""),
  characterNotes:   text("character_notes").default(""),
  dialogueNotes:    text("dialogue_notes").default(""),
  thematicCore:     text("thematic_core").default(""),
  isPublic:         boolean("is_public").default(false),
  status:           varchar("status", { length: 20 }).default("seeded"),
  embedding:        vectorColumn("embedding"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const workPatterns = pgTable("work_patterns", {
  id:                   uuid("id").defaultRandom().primaryKey(),
  name:                 text("name").notNull(),
  description:          text("description").notNull(),
  medium:               varchar("medium", { length: 30 }).default("cross-medium"),
  genres:               jsonb("genres").$type<string[]>().default([]),
  supportingPacketIds:  jsonb("supporting_packet_ids").$type<string[]>().default([]),
  generationDirective:  text("generation_directive").notNull(),
  applicableTo:         jsonb("applicable_to").$type<string[]>().default([]),
  isPublic:             boolean("is_public").default(true),
  embedding:            vectorColumn("embedding"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export const storyThreads = pgTable("story_threads", {
  id:                  uuid("id").defaultRandom().primaryKey(),
  projectId:           uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:                text("name").notNull(),
  threadType:          varchar("thread_type", { length: 30 }).default("subplot"),
  status:              varchar("status", { length: 20 }).default("open"),
  openedAtChapterId:   uuid("opened_at_chapter_id"),
  resolvedAtChapterId: uuid("resolved_at_chapter_id"),
  notes:               text("notes").default(""),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
});

export const storyPromises = pgTable("story_promises", {
  id:               uuid("id").defaultRandom().primaryKey(),
  projectId:        uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  threadId:         uuid("thread_id").references(() => storyThreads.id, { onDelete: "set null" }),
  setup:            text("setup").notNull(),
  setupChapterId:   uuid("setup_chapter_id"),
  payoffIntent:     text("payoff_intent").default(""),
  payoffChapterId:  uuid("payoff_chapter_id"),
  status:           varchar("status", { length: 20 }).default("open"),
  priority:         varchar("priority", { length: 5 }).default("B"),
  embedding:        vectorColumn("embedding"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  // "free" | "story_pro" | "creator_pro" | "all_access"
  tier: text("tier").notNull().default("free"),
  // "active" | "cancelled" | "past_due" | "trialing"
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storyCheckpoints = pgTable("story_checkpoints", {
  id:        uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  notes:     text("notes").default(""),
  snapshot:  jsonb("snapshot").$type<{
    totalWordCount:  number;
    chapterCount:    number;
    chapters:        { id: string; title: string; wordCount: number; arcPosition: string }[];
    openThreadCount: number;
    openPromises:    number;
    healthScore:     number;
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// First-class Director artifact: a structured, persisted beat sheet (the `beats`
// JSONB is zod-guarded via decodeStoryBeats/encodeStoryBeats in src/lib/types/story.ts).
// `kind` is generic so outline/production-plan can join later without a new table.
export const storyPlans = pgTable("story_plans", {
  id:        uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind:      varchar("kind", { length: 20 }).notNull().default("beat_sheet"),
  title:     text("title").notNull().default("Beat Sheet"),
  beats:     jsonb("beats").$type<unknown[]>().notNull().default(sql`'[]'`),
  status:    varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seriesBibles = pgTable("series_bibles", {
  id:                  uuid("id").defaultRandom().primaryKey(),
  userId:              uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:                text("name").notNull(),
  premise:             text("premise").default(""),
  tone:                text("tone").default(""),
  worldRules:          jsonb("world_rules").$type<string[]>().default([]),
  seriesCharacterArcs: jsonb("series_character_arcs").$type<{
    characterName: string; arcSummary: string; booksInvolved: string[];
  }[]>().default([]),
  continuityNotes:     text("continuity_notes").default(""),
  projectIds:          jsonb("project_ids").$type<string[]>().default([]),
  timeline:            jsonb("timeline").$type<{
    event: string; period: string; projectId?: string;
  }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id:            uuid("id").defaultRandom().primaryKey(),
  referrerId:    uuid("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refereeId:     uuid("referee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status:        varchar("status", { length: 20 }).default("pending"),
  rewardApplied: boolean("reward_applied").default(false),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id:        uuid("id").defaultRandom().primaryKey(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt:    timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformEvents = pgTable("platform_events", {
  id:         uuid("id").defaultRandom().primaryKey(),
  userId:     uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  event:      varchar("event", { length: 60 }).notNull(),
  properties: jsonb("properties").$type<Record<string, string | number | boolean>>().default({}),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

// Sprint 22: Series + Universe tables
export const universes = pgTable("universes", {
  id:          uuid("id").defaultRandom().primaryKey(),
  userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  premise:     text("premise").default(""),
  sharedRules: jsonb("shared_rules").$type<string[]>().default([]),
  tone:        text("tone").default(""),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const universeCharacters = pgTable("universe_characters", {
  id:          uuid("id").defaultRandom().primaryKey(),
  universeId:  uuid("universe_id").notNull().references(() => universes.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  baseProfile: jsonb("base_profile").$type<Record<string, any>>(),
  isAlive:     boolean("is_alive").default(true),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const projectCharacterStates = pgTable("project_character_states", {
  id:                uuid("id").defaultRandom().primaryKey(),
  projectId:         uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  universeCharId:    uuid("universe_char_id").notNull().references(() => universeCharacters.id, { onDelete: "cascade" }),
  knowledgeOverride: jsonb("knowledge_override").$type<Record<string, any>>(),
  emotionalState:    text("emotional_state"),
  stateNotes:        text("state_notes"),
  isDeceased:        boolean("is_deceased").default(false),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
});

export const universeEvents = pgTable("universe_events", {
  id:           uuid("id").defaultRandom().primaryKey(),
  universeId:   uuid("universe_id").notNull().references(() => universes.id, { onDelete: "cascade" }),
  projectId:    uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  name:         text("name").notNull(),
  description:  text("description").default(""),
  timelineSort: integer("timeline_sort").notNull(),
  isCanon:      boolean("is_canon").default(true),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, { fields: [referrals.referrerId], references: [users.id] }),
  referee:  one(users, { fields: [referrals.refereeId], references: [users.id] }),
}));
export const usersRelations = relations(users, ({ many, one }) => ({ projects: many(projects), videoAnalysisJobs: many(videoAnalysisJobs), subscription: one(subscriptions, { fields: [users.id], references: [subscriptions.userId] }), workPackets: many(workPackets), seriesBibles: many(seriesBibles), platformEvents: many(platformEvents), referrals: many(referrals) }));
export const workPacketsRelations = relations(workPackets, ({ one }) => ({ user: one(users, { fields: [workPackets.userId], references: [users.id] }) }));
export const workPatternsRelations = relations(workPatterns, ({ }) => ({}));
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({ user: one(users, { fields: [subscriptions.userId], references: [users.id] }) }));
export const semanticCache = pgTable("semantic_cache", {
  id:           uuid("id").defaultRandom().primaryKey(),
  cacheType:    varchar("cache_type", { length: 40 }).notNull(),
  inputKey:     text("input_key").notNull(),
  embedding:    vectorColumn("embedding"),
  cachedOutput: jsonb("cached_output").$type<Record<string, unknown>>().notNull(),
  hitCount:     integer("hit_count").default(0),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  lastHitAt:    timestamp("last_hit_at"),
});

// Note: standalone index() builders removed — drizzle-orm 0.45.2 bug (JSON.parse(undefined) in .on())
// Indexes still exist in the production DB from the previous schema push.

export const videoAnalysisJobsRelations = relations(videoAnalysisJobs, ({ one }) => ({ user: one(users, { fields: [videoAnalysisJobs.userId], references: [users.id] }) }));
export const storyCheckpointsRelations = relations(storyCheckpoints, ({ one }) => ({
  project: one(projects, { fields: [storyCheckpoints.projectId], references: [projects.id] }),
}));
export const seriesBiblesRelations = relations(seriesBibles, ({ one }) => ({
  user: one(users, { fields: [seriesBibles.userId], references: [users.id] }),
}));
export const platformEventsRelations = relations(platformEvents, ({ one }) => ({
  user: one(users, { fields: [platformEvents.userId], references: [users.id] }),
}));
export const projectsRelations = relations(projects, ({ one, many }) => ({ user: one(users, { fields: [projects.userId], references: [users.id] }), characters: many(characters), locations: many(locations), plotThreads: many(plotThreads), chapters: many(chapters), referenceWorks: many(referenceWorks), generations: many(generations), creatorBible: one(creatorBibles, { fields: [projects.id], references: [creatorBibles.projectId] }), storyMemories: many(storyMemories), comicPages: many(comicPages), productionShots: many(productionShots), characterEvolutionLogs: many(characterEvolutionLog), audioExports: many(audioExports), characterRelationships: many(characterRelationships), storyThreads: many(storyThreads), storyPromises: many(storyPromises), storyCheckpoints: many(storyCheckpoints), storyPlans: many(storyPlans), editorNotes: many(editorNotes), worldEntities: many(worldEntities) }));
export const storyThreadsRelations = relations(storyThreads, ({ one, many }) => ({ project: one(projects, { fields: [storyThreads.projectId], references: [projects.id] }), promises: many(storyPromises) }));
export const storyPromisesRelations = relations(storyPromises, ({ one }) => ({ project: one(projects, { fields: [storyPromises.projectId], references: [projects.id] }), thread: one(storyThreads, { fields: [storyPromises.threadId], references: [storyThreads.id] }) }));
export const audioExportsRelations = relations(audioExports, ({ one }) => ({ project: one(projects, { fields: [audioExports.projectId], references: [projects.id] }) }));
export const charactersRelations = relations(characters, ({ one, many }) => ({ project: one(projects, { fields: [characters.projectId], references: [projects.id] }), evolutionLogs: many(characterEvolutionLog) }));
export const characterEvolutionLogRelations = relations(characterEvolutionLog, ({ one }) => ({ project: one(projects, { fields: [characterEvolutionLog.projectId], references: [projects.id] }), character: one(characters, { fields: [characterEvolutionLog.characterId], references: [characters.id] }) }));
export const locationsRelations = relations(locations, ({ one }) => ({ project: one(projects, { fields: [locations.projectId], references: [projects.id] }) }));
export const worldEntitiesRelations = relations(worldEntities, ({ one }) => ({ project: one(projects, { fields: [worldEntities.projectId], references: [projects.id] }) }));
export const plotThreadsRelations = relations(plotThreads, ({ one }) => ({ project: one(projects, { fields: [plotThreads.projectId], references: [projects.id] }) }));
export const chaptersRelations = relations(chapters, ({ one, many }) => ({ project: one(projects, { fields: [chapters.projectId], references: [projects.id] }), comicPages: many(comicPages) }));
export const referenceWorksRelations = relations(referenceWorks, ({ one }) => ({ project: one(projects, { fields: [referenceWorks.projectId], references: [projects.id] }) }));
export const generationsRelations = relations(generations, ({ one }) => ({ project: one(projects, { fields: [generations.projectId], references: [projects.id] }), chapter: one(chapters, { fields: [generations.chapterId], references: [chapters.id] }) }));
export const creatorBiblesRelations = relations(creatorBibles, ({ one }) => ({ project: one(projects, { fields: [creatorBibles.projectId], references: [projects.id] }) }));
export const storyMemoriesRelations = relations(storyMemories, ({ one }) => ({ project: one(projects, { fields: [storyMemories.projectId], references: [projects.id] }) }));
export const comicPagesRelations = relations(comicPages, ({ one, many }) => ({ project: one(projects, { fields: [comicPages.projectId], references: [projects.id] }), chapter: one(chapters, { fields: [comicPages.chapterId], references: [chapters.id] }), panels: many(comicPanels) }));
export const comicPanelsRelations = relations(comicPanels, ({ one }) => ({ page: one(comicPages, { fields: [comicPanels.pageId], references: [comicPages.id] }), project: one(projects, { fields: [comicPanels.projectId], references: [projects.id] }) }));
export const productionShotsRelations = relations(productionShots, ({ one }) => ({ project: one(projects, { fields: [productionShots.projectId], references: [projects.id] }), chapter: one(chapters, { fields: [productionShots.chapterId], references: [chapters.id] }), primaryCharacter: one(characters, { fields: [productionShots.primaryCharacterId], references: [characters.id] }) }));
export const characterRelationshipsRelations = relations(characterRelationships, ({ one }) => ({ project: one(projects, { fields: [characterRelationships.projectId], references: [projects.id] }), characterA: one(characters, { fields: [characterRelationships.characterAId], references: [characters.id] }), characterB: one(characters, { fields: [characterRelationships.characterBId], references: [characters.id] }) }));
export const readerSessionsRelations = relations(readerSessions, ({ one, many }) => ({ project: one(projects, { fields: [readerSessions.projectId], references: [projects.id] }), reactions: many(readerReactions) }));
export const readerReactionsRelations = relations(readerReactions, ({ one }) => ({ session: one(readerSessions, { fields: [readerReactions.sessionId], references: [readerSessions.id] }), chapter: one(chapters, { fields: [readerReactions.chapterId], references: [chapters.id] }) }));
export const showcasesRelations = relations(showcases, ({ one }) => ({ project: one(projects, { fields: [showcases.projectId], references: [projects.id] }), user: one(users, { fields: [showcases.userId], references: [users.id] }) }));

// Indexes omitted — drizzle-orm 0.45.2 bug causes JSON.parse(undefined) during .on() at module eval time.
// All indexes were pushed to the production DB earlier and still exist there.

export const universesRelations = relations(universes, ({ one, many }) => ({
  user: one(users, { fields: [universes.userId], references: [users.id] }),
  characters: many(universeCharacters),
  events: many(universeEvents),
}));
export const universeCharactersRelations = relations(universeCharacters, ({ one, many }) => ({
  universe: one(universes, { fields: [universeCharacters.universeId], references: [universes.id] }),
  states: many(projectCharacterStates),
}));
export const projectCharacterStatesRelations = relations(projectCharacterStates, ({ one }) => ({
  project: one(projects, { fields: [projectCharacterStates.projectId], references: [projects.id] }),
  universeChar: one(universeCharacters, { fields: [projectCharacterStates.universeCharId], references: [universeCharacters.id] }),
}));
export const universeEventsRelations = relations(universeEvents, ({ one }) => ({
  universe: one(universes, { fields: [universeEvents.universeId], references: [universes.id] }),
  project: one(projects, { fields: [universeEvents.projectId], references: [projects.id] }),
}));
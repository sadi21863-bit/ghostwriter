import { pgTable, text, timestamp, integer, jsonb, varchar, uuid, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable("users", { id: uuid("id").defaultRandom().primaryKey(), name: text("name"), email: text("email").notNull().unique(), emailVerified: timestamp("email_verified", { mode: "date" }), image: text("image"), hashedPassword: text("hashed_password"), higgsfieldApiKey: text("higgsfield_api_key").default(""), openaiApiKey: text("openai_api_key").default(""), imageProviderId: text("image_provider_id").default("segmind_soul"), trendIntelligenceKey: text("trend_intelligence_key").default(""), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const accounts = pgTable("accounts", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), type: text("type").notNull(), provider: text("provider").notNull(), providerAccountId: text("provider_account_id").notNull(), refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: integer("expires_at"), token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state") });
export const sessions = pgTable("sessions", { id: uuid("id").defaultRandom().primaryKey(), sessionToken: text("session_token").notNull().unique(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), expires: timestamp("expires", { mode: "date" }).notNull() });
export const projects = pgTable("projects", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), name: text("name").notNull().default("Untitled Project"), format: varchar("format", { length: 50 }).notNull().default("Novel"), genres: jsonb("genres").$type().default([]), skillLevel: varchar("skill_level", { length: 20 }).notNull().default("beginner"), notes: text("notes").default(""), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const characters = pgTable("characters", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), name: text("name").notNull(), role: text("role").default(""), age: text("age").default(""), appearance: text("appearance").default(""), personality: text("personality").default(""), thinkingStyle: text("thinking_style").default(""), behavior: text("behavior").default(""), habits: text("habits").default(""), fears: text("fears").default(""), desires: text("desires").default(""), speechPattern: text("speech_pattern").default(""), backstory: text("backstory").default(""), arc: text("arc").default(""), portraitUrl: text("portrait_url").default(""), linkedLocationIds: jsonb("linked_location_ids").$type<string[]>().default([]), linkedPlotThreadIds: jsonb("linked_plot_thread_ids").$type<string[]>().default([]), alwaysInContext: boolean("always_in_context").default(true), sortOrder: integer("sort_order").default(0), createdAt: timestamp("created_at").defaultNow().notNull() });
export const locations = pgTable("locations", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), name: text("name").notNull(), description: text("description").default(""), atmosphere: text("atmosphere").default(""), history: text("history").default(""), sensoryDetails: text("sensory_details").default(""), linkedCharacterIds: jsonb("linked_character_ids").$type<string[]>().default([]), alwaysInContext: boolean("always_in_context").default(true), sortOrder: integer("sort_order").default(0), createdAt: timestamp("created_at").defaultNow().notNull() });
export const plotThreads = pgTable("plot_threads", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), name: text("name").notNull(), description: text("description").default(""), status: varchar("status", { length: 20 }).default("Active"), stakes: text("stakes").default(""), connections: text("connections").default(""), alwaysInContext: boolean("always_in_context").default(true), sortOrder: integer("sort_order").default(0), createdAt: timestamp("created_at").defaultNow().notNull() });
export const chapters = pgTable("chapters", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), title: text("title").notNull().default("Chapter 1"), content: text("content").default(""), summary: text("summary").default(""), tags: jsonb("tags").$type<string[]>().default([]), chapterType: varchar("chapter_type", { length: 30 }).default("chapter"), sortOrder: integer("sort_order").default(0), wordCount: integer("word_count").default(0), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull() });
export const referenceWorks = pgTable("reference_works", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), title: text("title").notNull(), attributes: jsonb("attributes").$type().default({}), createdAt: timestamp("created_at").defaultNow().notNull() });
export const generations = pgTable("generations", { id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }), mode: varchar("mode", { length: 20 }).notNull(), prompt: text("prompt").notNull(), output: text("output").notNull(), model: varchar("model", { length: 100 }).default("claude-sonnet-4-20250514"), tokensUsed: integer("tokens_used"), createdAt: timestamp("created_at").defaultNow().notNull() });

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
  artStylePreset: text("art_style_preset").default(""),
  dialogue: text("dialogue").default(""),
  caption: text("caption").default(""),
  speakerName: text("speaker_name").default(""),
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
  dialogue:           text("dialogue").default(""),
  speaker:            text("speaker").default(""),
  previewImageUrl:    text("preview_image_url").default(""),
  animatedVideoUrl:   text("animated_video_url").default(""),
  finalVideoUrl:      text("final_video_url").default(""),
  generationStatus:   varchar("generation_status", { length: 30 }).default("idle"),
  higgsfieldJobId:    text("higgsfield_job_id").default(""),
  sortOrder:          integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().default(""),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // "free" | "story_pro" | "creator_pro" | "all_access"
  tier: text("tier").notNull().default("free"),
  // "active" | "cancelled" | "past_due" | "trialing"
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({ projects: many(projects), videoAnalysisJobs: many(videoAnalysisJobs), subscription: one(subscriptions, { fields: [users.id], references: [subscriptions.userId] }) }));
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({ user: one(users, { fields: [subscriptions.userId], references: [users.id] }) }));
export const videoAnalysisJobsRelations = relations(videoAnalysisJobs, ({ one }) => ({ user: one(users, { fields: [videoAnalysisJobs.userId], references: [users.id] }) }));
export const projectsRelations = relations(projects, ({ one, many }) => ({ user: one(users, { fields: [projects.userId], references: [users.id] }), characters: many(characters), locations: many(locations), plotThreads: many(plotThreads), chapters: many(chapters), referenceWorks: many(referenceWorks), generations: many(generations), creatorBible: one(creatorBibles, { fields: [projects.id], references: [creatorBibles.projectId] }), storyMemories: many(storyMemories), comicPages: many(comicPages), productionShots: many(productionShots), characterEvolutionLogs: many(characterEvolutionLog) }));
export const charactersRelations = relations(characters, ({ one, many }) => ({ project: one(projects, { fields: [characters.projectId], references: [projects.id] }), evolutionLogs: many(characterEvolutionLog) }));
export const characterEvolutionLogRelations = relations(characterEvolutionLog, ({ one }) => ({ project: one(projects, { fields: [characterEvolutionLog.projectId], references: [projects.id] }), character: one(characters, { fields: [characterEvolutionLog.characterId], references: [characters.id] }) }));
export const locationsRelations = relations(locations, ({ one }) => ({ project: one(projects, { fields: [locations.projectId], references: [projects.id] }) }));
export const plotThreadsRelations = relations(plotThreads, ({ one }) => ({ project: one(projects, { fields: [plotThreads.projectId], references: [projects.id] }) }));
export const chaptersRelations = relations(chapters, ({ one, many }) => ({ project: one(projects, { fields: [chapters.projectId], references: [projects.id] }), comicPages: many(comicPages) }));
export const referenceWorksRelations = relations(referenceWorks, ({ one }) => ({ project: one(projects, { fields: [referenceWorks.projectId], references: [projects.id] }) }));
export const generationsRelations = relations(generations, ({ one }) => ({ project: one(projects, { fields: [generations.projectId], references: [projects.id] }), chapter: one(chapters, { fields: [generations.chapterId], references: [chapters.id] }) }));
export const creatorBiblesRelations = relations(creatorBibles, ({ one }) => ({ project: one(projects, { fields: [creatorBibles.projectId], references: [projects.id] }) }));
export const storyMemoriesRelations = relations(storyMemories, ({ one }) => ({ project: one(projects, { fields: [storyMemories.projectId], references: [projects.id] }) }));
export const comicPagesRelations = relations(comicPages, ({ one, many }) => ({ project: one(projects, { fields: [comicPages.projectId], references: [projects.id] }), chapter: one(chapters, { fields: [comicPages.chapterId], references: [chapters.id] }), panels: many(comicPanels) }));
export const comicPanelsRelations = relations(comicPanels, ({ one }) => ({ page: one(comicPages, { fields: [comicPanels.pageId], references: [comicPages.id] }), project: one(projects, { fields: [comicPanels.projectId], references: [projects.id] }) }));
export const productionShotsRelations = relations(productionShots, ({ one }) => ({ project: one(projects, { fields: [productionShots.projectId], references: [projects.id] }), chapter: one(chapters, { fields: [productionShots.chapterId], references: [chapters.id] }), primaryCharacter: one(characters, { fields: [productionShots.primaryCharacterId], references: [characters.id] }) }));
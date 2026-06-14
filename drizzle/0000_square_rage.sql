CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"audio_url" text DEFAULT '',
	"duration_seconds" integer DEFAULT 0,
	"character_count" integer DEFAULT 0,
	"estimated_cost" text DEFAULT '',
	"lipsync_video_url" text DEFAULT '',
	"lipsync_job_id" text DEFAULT '',
	"lipsync_status" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text DEFAULT 'Chapter 1' NOT NULL,
	"content" text DEFAULT '',
	"summary" text DEFAULT '',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"chapter_type" varchar(30) DEFAULT 'chapter',
	"sort_order" integer DEFAULT 0,
	"word_count" integer DEFAULT 0,
	"branch_id" text DEFAULT 'main',
	"branch_label" text DEFAULT '',
	"parent_chapter_id" uuid,
	"alternate_drafts" jsonb DEFAULT '[]'::jsonb,
	"emotional_tone" varchar(50) DEFAULT '',
	"arc_position" varchar(40) DEFAULT '',
	"scenes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_evolution_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"chapter_index" integer NOT NULL,
	"trigger_memory_ids" text[] DEFAULT '{}' NOT NULL,
	"previous_state" jsonb DEFAULT '{}' NOT NULL,
	"updated_traits" jsonb DEFAULT '{}' NOT NULL,
	"evolution_summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"character_a_id" uuid NOT NULL,
	"character_b_id" uuid NOT NULL,
	"trust_level" integer DEFAULT 50,
	"relationship_type" text DEFAULT '',
	"four_horsemen" jsonb DEFAULT '{"criticism":0,"contempt":0,"defensiveness":0,"stonewalling":0}'::jsonb,
	"notes" text DEFAULT '',
	"power_differential" integer DEFAULT 0,
	"emotional_register" varchar(50) DEFAULT '',
	"knowledge_asymmetry" text DEFAULT '',
	"dependency_structure" varchar(50) DEFAULT 'none',
	"attachment_style_a" varchar(30) DEFAULT '',
	"arc_trajectory" varchar(30) DEFAULT '',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '',
	"age" text DEFAULT '',
	"appearance" text DEFAULT '',
	"personality" text DEFAULT '',
	"thinking_style" text DEFAULT '',
	"behavior" text DEFAULT '',
	"habits" text DEFAULT '',
	"fears" text DEFAULT '',
	"desires" text DEFAULT '',
	"speech_pattern" text DEFAULT '',
	"backstory" text DEFAULT '',
	"arc" text DEFAULT '',
	"portrait_url" text DEFAULT '',
	"soul_id" text DEFAULT '',
	"visual_profile" text DEFAULT '',
	"voice_profile" text DEFAULT '',
	"voice_id" text DEFAULT '',
	"structural_function" text DEFAULT '',
	"voice_register" text DEFAULT '',
	"voice_compression" text DEFAULT '',
	"verbal_tic" text DEFAULT '',
	"linked_location_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_plot_thread_ids" jsonb DEFAULT '[]'::jsonb,
	"always_in_context" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"antagonist_toggle" boolean DEFAULT false,
	"antagonist_type" text DEFAULT '',
	"self_justification_pattern" text DEFAULT '',
	"moral_foundation_profile" text DEFAULT '',
	"kinesics_baseline" text DEFAULT '',
	"kinesics_micro" text DEFAULT '',
	"kinesics_idiosyncrasy" text DEFAULT '',
	"proxemics_culture" text DEFAULT '',
	"proxemics_intimate_list" text DEFAULT '',
	"proxemics_violation_response" text DEFAULT '',
	"paralanguage_baseline" text DEFAULT '',
	"paralanguage_stress_degradation" text DEFAULT '',
	"paralanguage_signature_sound" text DEFAULT '',
	"haptics_touch_level" text DEFAULT '',
	"haptics_trauma_modifier" text DEFAULT '',
	"chronemics_time_type" text DEFAULT '',
	"chronemics_lateness" text DEFAULT '',
	"oculesics_default" text DEFAULT '',
	"oculesics_deception" text DEFAULT '',
	"objectics_signature" text DEFAULT '',
	"appearance_signature" text DEFAULT '',
	"appearance_trajectory" text DEFAULT '',
	"native_language" text DEFAULT '',
	"acquired_languages" text DEFAULT '',
	"dominant_language_context" text DEFAULT '',
	"language_loss_history" text DEFAULT '',
	"accent_profile" text DEFAULT '',
	"reversion_trigger" text DEFAULT '',
	"register_default" text DEFAULT '',
	"register_range" text DEFAULT '',
	"code_switching_triggers" text DEFAULT '',
	"idiolect_fingerprint" text DEFAULT '',
	"root_wound" text DEFAULT '',
	"hamartia" text DEFAULT '',
	"significant_flaws" jsonb DEFAULT '[]'::jsonb,
	"cognitive_bias" text DEFAULT '',
	"blind_spot" text DEFAULT '',
	"strength_branch" text DEFAULT '',
	"compensation_mode" text DEFAULT '',
	"compensation_behavior" text DEFAULT '',
	"compensation_trigger" text DEFAULT '',
	"flaw_arc_mode" text DEFAULT '',
	"disability_profile" text DEFAULT '',
	"skills" jsonb DEFAULT '[]'::jsonb,
	"knowledge_map" jsonb DEFAULT '{}'::jsonb,
	"intelligence_profile" jsonb DEFAULT '{}'::jsonb,
	"cultural_worldview" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comic_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"page_number" integer DEFAULT 1 NOT NULL,
	"art_style" text DEFAULT 'manga' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comic_panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"panel_index" integer NOT NULL,
	"image_url" text NOT NULL,
	"panel_prompt" text NOT NULL,
	"reference_image_url" text DEFAULT '',
	"art_style_preset" text DEFAULT '',
	"dialogue" text DEFAULT '',
	"caption" text DEFAULT '',
	"speaker_name" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creator_bibles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"channel_name" text DEFAULT '',
	"niche" text DEFAULT '',
	"audience_age" text DEFAULT '',
	"audience_interests" text DEFAULT '',
	"audience_pain_points" text DEFAULT '',
	"channel_voice" text DEFAULT '',
	"content_pillars" jsonb DEFAULT '[]'::jsonb,
	"competitor_notes" text DEFAULT '',
	"default_cta" text DEFAULT '',
	"cohost_voice" varchar(50) DEFAULT 'none',
	"hook_memory" jsonb DEFAULT '[]'::jsonb,
	"tiktok_handle" text DEFAULT '',
	"tiktok_niche" text DEFAULT '',
	"sound_strategy" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_bibles_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_id" uuid,
	"mode" varchar(20) NOT NULL,
	"prompt" text NOT NULL,
	"output" text NOT NULL,
	"model" varchar(100) DEFAULT 'claude-sonnet-4-20250514',
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"atmosphere" text DEFAULT '',
	"history" text DEFAULT '',
	"sensory_details" text DEFAULT '',
	"linked_character_ids" jsonb DEFAULT '[]'::jsonb,
	"always_in_context" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plot_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"status" varchar(20) DEFAULT 'Active',
	"stakes" text DEFAULT '',
	"connections" text DEFAULT '',
	"always_in_context" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"last_mentioned_chapter_id" uuid,
	"starvation_warning" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_id" uuid,
	"scene_number" integer DEFAULT 1 NOT NULL,
	"shot_number" integer DEFAULT 1 NOT NULL,
	"shot_type" text DEFAULT 'Medium shot',
	"camera_movement" text DEFAULT 'Static',
	"lighting_mood" text DEFAULT 'Golden hour',
	"time_of_day" text DEFAULT 'Afternoon',
	"subject" text DEFAULT '',
	"action" text DEFAULT '',
	"location" text DEFAULT '',
	"mood" text DEFAULT '',
	"primary_character_id" uuid,
	"soul_prompt" text DEFAULT '',
	"video_prompt" text DEFAULT '',
	"dialogue" text DEFAULT '',
	"speaker" text DEFAULT '',
	"preview_image_url" text DEFAULT '',
	"animated_video_url" text DEFAULT '',
	"final_video_url" text DEFAULT '',
	"generation_status" varchar(30) DEFAULT 'idle',
	"higgsfield_job_id" text DEFAULT '',
	"camera_preset" text DEFAULT '',
	"viral_preset" text DEFAULT '',
	"character_emotion" text DEFAULT '',
	"focal_length" text DEFAULT '',
	"duration" integer DEFAULT 5,
	"aspect_ratio" text DEFAULT '16:9',
	"generated_video_url" text DEFAULT '',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'Untitled Project' NOT NULL,
	"format" varchar(50) DEFAULT 'Novel' NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb,
	"skill_level" varchar(20) DEFAULT 'beginner' NOT NULL,
	"notes" text DEFAULT '',
	"controlling_idea" text DEFAULT '',
	"intentional_violations" jsonb DEFAULT '{}'::jsonb,
	"ai_rules" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reader_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"text_offset" integer NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reader_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reader_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_id" uuid,
	"fact" text NOT NULL,
	"category" varchar(30) DEFAULT 'general',
	"auto_extracted" boolean DEFAULT true,
	"chapter_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_promises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"thread_id" uuid,
	"setup" text NOT NULL,
	"setup_chapter_id" uuid,
	"payoff_intent" text DEFAULT '',
	"payoff_chapter_id" uuid,
	"status" varchar(20) DEFAULT 'open',
	"priority" varchar(5) DEFAULT 'B',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"thread_type" varchar(30) DEFAULT 'subplot',
	"status" varchar(20) DEFAULT 'open',
	"opened_at_chapter_id" uuid,
	"resolved_at_chapter_id" uuid,
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text DEFAULT '' NOT NULL,
	"stripe_subscription_id" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"hashed_password" text,
	"higgsfield_api_key" text DEFAULT '',
	"higgsfield_api_secret" text DEFAULT '',
	"openai_api_key" text DEFAULT '',
	"image_provider_id" text DEFAULT 'segmind_soul',
	"trend_intelligence_key" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"youtube_url" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"result" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"creator" text DEFAULT '',
	"medium" varchar(30) NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb,
	"craft_principles" jsonb DEFAULT '[]'::jsonb,
	"structural_notes" text DEFAULT '',
	"character_notes" text DEFAULT '',
	"dialogue_notes" text DEFAULT '',
	"thematic_core" text DEFAULT '',
	"is_public" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'seeded',
	"embedding" "vector(1536)",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"medium" varchar(30) DEFAULT 'cross-medium',
	"genres" jsonb DEFAULT '[]'::jsonb,
	"supporting_packet_ids" jsonb DEFAULT '[]'::jsonb,
	"generation_directive" text NOT NULL,
	"applicable_to" jsonb DEFAULT '[]'::jsonb,
	"is_public" boolean DEFAULT true,
	"embedding" "vector(1536)",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audio_exports" ADD CONSTRAINT "audio_exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapters" ADD CONSTRAINT "chapters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_evolution_log" ADD CONSTRAINT "character_evolution_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_evolution_log" ADD CONSTRAINT "character_evolution_log_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_character_a_id_characters_id_fk" FOREIGN KEY ("character_a_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_character_b_id_characters_id_fk" FOREIGN KEY ("character_b_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comic_pages" ADD CONSTRAINT "comic_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comic_pages" ADD CONSTRAINT "comic_pages_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comic_panels" ADD CONSTRAINT "comic_panels_page_id_comic_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."comic_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comic_panels" ADD CONSTRAINT "comic_panels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creator_bibles" ADD CONSTRAINT "creator_bibles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generations" ADD CONSTRAINT "generations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generations" ADD CONSTRAINT "generations_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_shots" ADD CONSTRAINT "production_shots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_shots" ADD CONSTRAINT "production_shots_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_shots" ADD CONSTRAINT "production_shots_primary_character_id_characters_id_fk" FOREIGN KEY ("primary_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reader_reactions" ADD CONSTRAINT "reader_reactions_session_id_reader_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."reader_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reader_reactions" ADD CONSTRAINT "reader_reactions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reader_sessions" ADD CONSTRAINT "reader_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference_works" ADD CONSTRAINT "reference_works_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_memories" ADD CONSTRAINT "story_memories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_memories" ADD CONSTRAINT "story_memories_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_promises" ADD CONSTRAINT "story_promises_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_promises" ADD CONSTRAINT "story_promises_thread_id_story_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."story_threads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story_threads" ADD CONSTRAINT "story_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_analysis_jobs" ADD CONSTRAINT "video_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_packets" ADD CONSTRAINT "work_packets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

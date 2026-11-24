// VENDORED SQLite DDL for app db (statement-per-chunk, split on "--> statement-breakpoint").
// Generated from src/db/sqlite-schema.ts via:
//   npx drizzle-kit generate --dialect sqlite --schema ./src/db/sqlite-schema.ts --out ./drizzle-sqlite-tmp
// then backtick-quoted identifiers converted to double quotes and the semantic_cache unique
// index appended. DO NOT hand-edit routine tables: regenerate, convert quotes, re-vendor.
// Conventions are documented in src/db/sqlite-schema.ts (epoch-ms timestamps, text uuid PKs
// with client-side defaultFn, jsonb -> text(mode:"json"), embedding columns omitted).
export const SQLITE_DDL = `
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "audio_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"mode" text DEFAULT 'narration' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"audio_url" text DEFAULT '',
	"duration_seconds" integer DEFAULT 0,
	"character_count" integer DEFAULT 0,
	"estimated_cost" text DEFAULT '',
	"lipsync_video_url" text DEFAULT '',
	"lipsync_job_id" text DEFAULT '',
	"lipsync_status" text DEFAULT '',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text DEFAULT 'Chapter 1' NOT NULL,
	"content" text DEFAULT '',
	"summary" text DEFAULT '',
	"tags" text DEFAULT '[]',
	"chapter_type" text DEFAULT 'chapter',
	"sort_order" integer DEFAULT 0,
	"word_count" integer DEFAULT 0,
	"branch_id" text DEFAULT 'main',
	"branch_label" text DEFAULT '',
	"parent_chapter_id" text,
	"alternate_drafts" text DEFAULT '[]',
	"emotional_tone" text DEFAULT '',
	"arc_position" text DEFAULT '',
	"scenes" text DEFAULT '[]',
	"storyline_id" text,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "character_evolution_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"character_id" text NOT NULL,
	"chapter_index" integer NOT NULL,
	"trigger_memory_ids" text DEFAULT '[]',
	"previous_state" text DEFAULT '{}' NOT NULL,
	"updated_traits" text DEFAULT '{}' NOT NULL,
	"evolution_summary" text DEFAULT '' NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "character_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"character_a_id" text NOT NULL,
	"character_b_id" text NOT NULL,
	"trust_level" integer DEFAULT 50,
	"relationship_type" text DEFAULT '',
	"four_horsemen" text DEFAULT '{"criticism":0,"contempt":0,"defensiveness":0,"stonewalling":0}',
	"notes" text DEFAULT '',
	"power_differential" integer DEFAULT 0,
	"emotional_register" text DEFAULT '',
	"knowledge_asymmetry" text DEFAULT '',
	"dependency_structure" text DEFAULT 'none',
	"attachment_style_a" text DEFAULT '',
	"arc_trajectory" text DEFAULT '',
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("character_a_id") REFERENCES "characters"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("character_b_id") REFERENCES "characters"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
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
	"soul_id_training_job_id" text DEFAULT '',
	"visual_profile" text DEFAULT '',
	"voice_profile" text DEFAULT '',
	"voice_id" text DEFAULT '',
	"structural_function" text DEFAULT '',
	"voice_register" text DEFAULT '',
	"voice_compression" text DEFAULT '',
	"verbal_tic" text DEFAULT '',
	"linked_location_ids" text DEFAULT '[]',
	"linked_plot_thread_ids" text DEFAULT '[]',
	"always_in_context" integer DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"antagonist_toggle" integer DEFAULT false,
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
	"significant_flaws" text DEFAULT '[]',
	"cognitive_bias" text DEFAULT '',
	"blind_spot" text DEFAULT '',
	"strength_branch" text DEFAULT '',
	"compensation_mode" text DEFAULT '',
	"compensation_behavior" text DEFAULT '',
	"compensation_trigger" text DEFAULT '',
	"flaw_arc_mode" text DEFAULT '',
	"disability_profile" text DEFAULT '',
	"skills" text DEFAULT '[]',
	"knowledge_map" text DEFAULT '{}',
	"intelligence_profile" text DEFAULT '{}',
	"cultural_worldview" text DEFAULT '',
	"character_want" text DEFAULT '',
	"character_need" text DEFAULT '',
	"contradiction" text DEFAULT '',
	"narrator_blind_spot" text DEFAULT '',
	"first_impression_note" text DEFAULT '',
	"context_visibility" text DEFAULT 'always',
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "comic_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"page_number" integer DEFAULT 1 NOT NULL,
	"art_style" text DEFAULT 'manga' NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "comic_panels" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"project_id" text NOT NULL,
	"panel_index" integer NOT NULL,
	"image_url" text NOT NULL,
	"panel_prompt" text NOT NULL,
	"reference_image_url" text DEFAULT '',
	"character_name" text DEFAULT '',
	"art_style_preset" text DEFAULT '',
	"dialogue" text DEFAULT '',
	"caption" text DEFAULT '',
	"speaker_name" text DEFAULT '',
	"lettered_image_url" text DEFAULT '',
	"bubble_type" text DEFAULT 'speech',
	"quality_score" real,
	"quality_weakest" text,
	"quality_note" text DEFAULT '',
	"review_status" text DEFAULT 'draft' NOT NULL,
	"candidate_image_urls" text DEFAULT '[]',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("page_id") REFERENCES "comic_pages"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "creator_bibles" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"channel_name" text DEFAULT '',
	"niche" text DEFAULT '',
	"audience_age" text DEFAULT '',
	"audience_interests" text DEFAULT '',
	"audience_pain_points" text DEFAULT '',
	"channel_voice" text DEFAULT '',
	"content_pillars" text DEFAULT '[]',
	"competitor_notes" text DEFAULT '',
	"default_cta" text DEFAULT '',
	"cohost_voice" text DEFAULT 'none',
	"hook_memory" text DEFAULT '[]',
	"tiktok_handle" text DEFAULT '',
	"tiktok_niche" text DEFAULT '',
	"sound_strategy" text DEFAULT '',
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "creator_bibles_project_id_unique" ON "creator_bibles" ("project_id");--> statement-breakpoint
CREATE TABLE "editor_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"chapter_id" text,
	"type" text DEFAULT 'issue' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"message" text NOT NULL,
	"suggested_fix" text DEFAULT '',
	"status" text DEFAULT 'open' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_tokens_token_unique" ON "email_verification_tokens" ("token");--> statement-breakpoint
CREATE TABLE "generations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"chapter_id" text,
	"mode" text NOT NULL,
	"prompt" text NOT NULL,
	"output" text NOT NULL,
	"model" text DEFAULT 'claude-sonnet-5',
	"tokens_used" integer,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"atmosphere" text DEFAULT '',
	"history" text DEFAULT '',
	"sensory_details" text DEFAULT '',
	"linked_character_ids" text DEFAULT '[]',
	"always_in_context" integer DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_unique" ON "password_reset_tokens" ("token");--> statement-breakpoint
CREATE TABLE "platform_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"event" text NOT NULL,
	"properties" text DEFAULT '{}',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "plot_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"status" text DEFAULT 'Active',
	"stakes" text DEFAULT '',
	"connections" text DEFAULT '',
	"always_in_context" integer DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"last_mentioned_chapter_id" text,
	"starvation_warning" integer DEFAULT false,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "production_shots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"chapter_id" text,
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
	"primary_character_id" text,
	"soul_prompt" text DEFAULT '',
	"video_prompt" text DEFAULT '',
	"multi_shot_script" text DEFAULT '',
	"dialogue" text DEFAULT '',
	"speaker" text DEFAULT '',
	"preview_image_url" text DEFAULT '',
	"animated_video_url" text DEFAULT '',
	"final_video_url" text DEFAULT '',
	"scene_final_video_url" text DEFAULT '',
	"generation_status" text DEFAULT 'idle',
	"generation_error" text DEFAULT '',
	"higgsfield_job_id" text DEFAULT '',
	"camera_preset" text DEFAULT '',
	"viral_preset" text DEFAULT '',
	"character_emotion" text DEFAULT '',
	"focal_length" text DEFAULT '',
	"duration" integer DEFAULT 5,
	"aspect_ratio" text DEFAULT '16:9',
	"generated_video_url" text DEFAULT '',
	"sort_order" integer DEFAULT 0,
	"quality_score" real,
	"quality_weakest" text,
	"quality_note" text DEFAULT '',
	"review_status" text DEFAULT 'draft' NOT NULL,
	"candidate_preview_urls" text DEFAULT '[]',
	"trim_start_sec" real,
	"trim_end_sec" real,
	"scene_audio_track_url" text DEFAULT '',
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE set null,
	FOREIGN KEY ("primary_character_id") REFERENCES "characters"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "project_character_states" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"universe_char_id" text NOT NULL,
	"knowledge_override" text,
	"emotional_state" text,
	"state_notes" text,
	"is_deceased" integer DEFAULT false,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("universe_char_id") REFERENCES "universe_characters"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Untitled Project' NOT NULL,
	"genres" text DEFAULT '[]',
	"format" text DEFAULT 'Novel' NOT NULL,
	"skill_level" text DEFAULT 'beginner' NOT NULL,
	"notes" text DEFAULT '',
	"controlling_idea" text DEFAULT '',
	"dismissed_guide_ids" text DEFAULT '[]',
	"intentional_violations" text DEFAULT '{}',
	"ai_rules" text DEFAULT '[]',
	"is_higgsfield_project" integer DEFAULT false,
	"narrator_voice" text DEFAULT '',
	"narrative_structure" text DEFAULT 'linear',
	"quality_grading_enabled" integer DEFAULT false,
	"aiisms_check" integer DEFAULT false,
	"story_type" text DEFAULT 'linear',
	"universe_id" text,
	"timeline_sort" integer,
	"phase" text,
	"series_parent_id" text,
	"adapted_from_project_id" text,
	"biggest_challenge" text DEFAULT '',
	"ai_initiative" text DEFAULT 'Collaborates',
	"density_level" text DEFAULT 'standard',
	"content_revision" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "reader_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"text_offset" integer NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("session_id") REFERENCES "reader_sessions"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "reader_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reader_sessions_token_unique" ON "reader_sessions" ("token");--> statement-breakpoint
CREATE TABLE "reference_works" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"attributes" text DEFAULT '{}',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referee_id" text NOT NULL,
	"status" text DEFAULT 'pending',
	"reward_applied" integer DEFAULT false,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("referee_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "semantic_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"cache_type" text NOT NULL,
	"input_key" text NOT NULL,
	"cached_output" text NOT NULL,
	"hit_count" integer DEFAULT 0,
	"created_at" integer NOT NULL,
	"last_hit_at" integer
);
--> statement-breakpoint
CREATE TABLE "series_bibles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"premise" text DEFAULT '',
	"tone" text DEFAULT '',
	"world_rules" text DEFAULT '[]',
	"series_character_arcs" text DEFAULT '[]',
	"continuity_notes" text DEFAULT '',
	"project_ids" text DEFAULT '[]',
	"timeline" text DEFAULT '[]',
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_session_token_unique" ON "sessions" ("session_token");--> statement-breakpoint
CREATE TABLE "showcases" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"blurb" text DEFAULT '',
	"visibility" text DEFAULT 'private' NOT NULL,
	"flagged" integer DEFAULT false NOT NULL,
	"flag_reason" text DEFAULT '',
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "showcases_project_id_unique" ON "showcases" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "showcases_slug_unique" ON "showcases" ("slug");--> statement-breakpoint
CREATE TABLE "story_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"project_id" text NOT NULL,
	"seq" integer NOT NULL,
	"entity_key" text NOT NULL,
	"entity_id" text NOT NULL,
	"field" text NOT NULL,
	"old_value" text DEFAULT '' NOT NULL,
	"new_value" text NOT NULL,
	FOREIGN KEY ("transaction_id") REFERENCES "story_transactions"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "story_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '',
	"snapshot" text NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "story_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"chapter_id" text,
	"fact" text NOT NULL,
	"category" text DEFAULT 'general',
	"auto_extracted" integer DEFAULT true,
	"chapter_index" integer DEFAULT 0,
	"structured_data" text,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "story_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text DEFAULT 'beat_sheet' NOT NULL,
	"title" text DEFAULT 'Beat Sheet' NOT NULL,
	"beats" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "story_promises" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"thread_id" text,
	"setup" text NOT NULL,
	"setup_chapter_id" text,
	"payoff_intent" text DEFAULT '',
	"payoff_chapter_id" text,
	"status" text DEFAULT 'open',
	"priority" text DEFAULT 'B',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("thread_id") REFERENCES "story_threads"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "story_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"thread_type" text DEFAULT 'subplot',
	"status" text DEFAULT 'open',
	"opened_at_chapter_id" text,
	"resolved_at_chapter_id" text,
	"notes" text DEFAULT '',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "story_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" text NOT NULL,
	"source_generation_id" text,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"razorpay_subscription_id" text,
	"razorpay_payment_id" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_end" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_unique" ON "subscriptions" ("user_id");--> statement-breakpoint
CREATE TABLE "universe_characters" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"name" text NOT NULL,
	"base_profile" text,
	"is_alive" integer DEFAULT true,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("universe_id") REFERENCES "universes"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "universe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"universe_id" text NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"timeline_sort" integer NOT NULL,
	"is_canon" integer DEFAULT true,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("universe_id") REFERENCES "universes"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"premise" text DEFAULT '',
	"shared_rules" text DEFAULT '[]',
	"tone" text DEFAULT '',
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" integer,
	"image" text,
	"hashed_password" text,
	"higgsfield_api_key" text DEFAULT '',
	"higgsfield_api_secret" text DEFAULT '',
	"segmind_api_key" text DEFAULT '',
	"openai_api_key" text DEFAULT '',
	"image_provider_id" text DEFAULT 'segmind_soul',
	"tts_provider_id" text DEFAULT 'openai',
	"trend_intelligence_key" text DEFAULT '',
	"referral_code" text,
	"monthly_generations" real DEFAULT 0,
	"monthly_generations_reset_at" integer,
	"trial_end_at" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");--> statement-breakpoint
CREATE TABLE "video_analysis_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"youtube_url" text NOT NULL,
	"status" text DEFAULT 'pending',
	"result" text,
	"error_message" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "work_packets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"creator" text DEFAULT '',
	"medium" text NOT NULL,
	"genres" text DEFAULT '[]',
	"craft_principles" text DEFAULT '[]',
	"structural_notes" text DEFAULT '',
	"character_notes" text DEFAULT '',
	"dialogue_notes" text DEFAULT '',
	"thematic_core" text DEFAULT '',
	"is_public" integer DEFAULT false,
	"status" text DEFAULT 'seeded',
	"created_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "work_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"medium" text DEFAULT 'cross-medium',
	"genres" text DEFAULT '[]',
	"supporting_packet_ids" text DEFAULT '[]',
	"generation_directive" text NOT NULL,
	"applicable_to" text DEFAULT '[]',
	"is_public" integer DEFAULT true,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text DEFAULT 'object' NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '',
	"description" text DEFAULT '',
	"properties" text DEFAULT '{}',
	"linked_character_ids" text DEFAULT '[]',
	"linked_location_ids" text DEFAULT '[]',
	"linked_plot_thread_ids" text DEFAULT '[]',
	"linked_entity_ids" text DEFAULT '[]',
	"always_in_context" integer DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- NOTE: NOT declared in src/db/sqlite-schema.ts because drizzle-orm@0.45.2 SQLite index
-- builders throw JSON.parse(undefined) when the .on() method is used. This composite unique key is a pg-parity
-- requirement; it is appended here so vendorage stays the single source of DDL truth.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_semantic_cache_type_key" ON "semantic_cache" ("cache_type", "input_key");`;

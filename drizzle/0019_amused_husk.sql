CREATE TABLE "showcases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"blurb" text DEFAULT '',
	"visibility" varchar(10) DEFAULT 'private' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text DEFAULT '',
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "showcases_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "showcases_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "audio_exports" ADD COLUMN "mode" text DEFAULT 'narration' NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "soul_id_training_job_id" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "comic_panels" ADD COLUMN "character_name" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "comic_panels" ADD COLUMN "quality_score" real;--> statement-breakpoint
ALTER TABLE "comic_panels" ADD COLUMN "quality_weakest" varchar(30);--> statement-breakpoint
ALTER TABLE "comic_panels" ADD COLUMN "quality_note" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "comic_panels" ADD COLUMN "review_status" varchar(12) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "comic_panels" ADD COLUMN "candidate_image_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "generation_error" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "quality_score" real;--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "quality_weakest" varchar(30);--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "quality_note" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "review_status" varchar(12) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "candidate_preview_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "trim_start_sec" real;--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "trim_end_sec" real;--> statement-breakpoint
ALTER TABLE "production_shots" ADD COLUMN "scene_audio_track_url" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "content_revision" integer;--> statement-breakpoint
ALTER TABLE "story_promises" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tts_provider_id" text DEFAULT 'openai';--> statement-breakpoint
ALTER TABLE "world_entities" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "showcases" ADD CONSTRAINT "showcases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcases" ADD CONSTRAINT "showcases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "editor_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_id" uuid,
	"type" varchar(12) DEFAULT 'issue' NOT NULL,
	"severity" varchar(8) DEFAULT 'medium' NOT NULL,
	"category" varchar(24) DEFAULT 'general' NOT NULL,
	"message" text NOT NULL,
	"suggested_fix" text DEFAULT '',
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"source" varchar(16) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "review_status" varchar(12) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "editor_notes" ADD CONSTRAINT "editor_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_notes" ADD CONSTRAINT "editor_notes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "story_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" varchar(20) DEFAULT 'beat_sheet' NOT NULL,
	"title" text DEFAULT 'Beat Sheet' NOT NULL,
	"beats" jsonb DEFAULT '[]' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_plans" ADD CONSTRAINT "story_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
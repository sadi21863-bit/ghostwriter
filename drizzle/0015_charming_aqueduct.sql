CREATE TABLE "world_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" varchar(16) DEFAULT 'object' NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '',
	"description" text DEFAULT '',
	"properties" jsonb DEFAULT '{}'::jsonb,
	"linked_character_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_location_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_plot_thread_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_entity_ids" jsonb DEFAULT '[]'::jsonb,
	"always_in_context" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "world_entities" ADD CONSTRAINT "world_entities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
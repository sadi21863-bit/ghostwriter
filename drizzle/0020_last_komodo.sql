CREATE TABLE "story_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"entity_key" varchar(20) NOT NULL,
	"entity_id" text NOT NULL,
	"field" varchar(40) NOT NULL,
	"old_value" text DEFAULT '' NOT NULL,
	"new_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"source" varchar(20) NOT NULL,
	"source_generation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_changes" ADD CONSTRAINT "story_changes_transaction_id_story_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."story_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_changes" ADD CONSTRAINT "story_changes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_transactions" ADD CONSTRAINT "story_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
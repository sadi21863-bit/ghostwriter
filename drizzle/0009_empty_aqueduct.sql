ALTER TABLE "projects" ADD COLUMN "adapted_from_project_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ai_initiative" varchar(20) DEFAULT 'Collaborates';
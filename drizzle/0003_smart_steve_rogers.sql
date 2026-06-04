CREATE TABLE IF NOT EXISTS "semantic_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_type" varchar(40) NOT NULL,
	"input_key" text NOT NULL,
	"embedding" vector(1536),
	"cached_output" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_hit_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "story_memories" ADD COLUMN "structured_data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_generations" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_generations_reset_at" timestamp;
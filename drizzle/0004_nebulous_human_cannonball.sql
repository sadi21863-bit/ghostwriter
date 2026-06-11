CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "project_character_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"universe_char_id" uuid NOT NULL,
	"knowledge_override" jsonb,
	"emotional_state" text,
	"state_notes" text,
	"is_deceased" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universe_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_profile" jsonb,
	"is_alive" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universe_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"timeline_sort" integer NOT NULL,
	"is_canon" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"premise" text DEFAULT '',
	"shared_rules" jsonb DEFAULT '[]'::jsonb,
	"tone" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ALTER COLUMN "model" SET DEFAULT 'claude-sonnet-4-6';--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "storyline_id" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "context_visibility" varchar(20) DEFAULT 'always';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plot_threads" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "aiisms_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "story_type" varchar(20) DEFAULT 'linear';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "universe_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "timeline_sort" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "series_parent_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "razorpay_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_end_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_character_states" ADD CONSTRAINT "project_character_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_character_states" ADD CONSTRAINT "project_character_states_universe_char_id_universe_characters_id_fk" FOREIGN KEY ("universe_char_id") REFERENCES "public"."universe_characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_characters" ADD CONSTRAINT "universe_characters_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_events" ADD CONSTRAINT "universe_events_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_events" ADD CONSTRAINT "universe_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ALTER COLUMN "monthly_generations" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "biggest_challenge" text DEFAULT '';
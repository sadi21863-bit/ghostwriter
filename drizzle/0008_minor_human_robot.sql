ALTER TABLE "generations" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ALTER COLUMN "mode" SET DATA TYPE varchar(50);
ALTER TABLE "skills" ADD COLUMN "visibility" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "moderated_by" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
CREATE INDEX "skills_visibility_created_idx" ON "skills" USING btree ("visibility","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_visibility_allowed" CHECK ("skills"."visibility" in ('published', 'hidden'));--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_moderation_reason_length" CHECK ("skills"."moderation_reason" is null or char_length(btrim("skills"."moderation_reason")) between 1 and 200);
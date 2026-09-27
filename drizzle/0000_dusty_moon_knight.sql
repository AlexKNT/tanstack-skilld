CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"install_url" text,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_lowercase_url_safe" CHECK ("skills"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "skills_slug_length" CHECK (char_length("skills"."slug") between 1 and 60),
	CONSTRAINT "skills_name_not_blank" CHECK (char_length(btrim("skills"."name")) between 1 and 80),
	CONSTRAINT "skills_summary_not_blank" CHECK (char_length(btrim("skills"."summary")) between 1 and 200),
	CONSTRAINT "skills_description_not_blank" CHECK (char_length(btrim("skills"."description")) >= 1),
	CONSTRAINT "skills_timestamps_ordered" CHECK ("skills"."updated_at" >= "skills"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_unique" ON "skills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "skills_created_at_idx" ON "skills" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
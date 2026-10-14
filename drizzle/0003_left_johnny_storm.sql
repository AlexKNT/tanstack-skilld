ALTER TABLE "skills" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "search_document" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "name" || ' ' || "summary" || ' ' || "description")) STORED;--> statement-breakpoint
CREATE INDEX "skills_tags_idx" ON "skills" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "skills_search_idx" ON "skills" USING gin ("search_document");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "skills_tags_valid"(tags text[]) RETURNS boolean AS $$
	SELECT NOT EXISTS (
		SELECT 1
		FROM unnest(tags) AS tag
		WHERE tag !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
			OR char_length(tag) > 24
	);
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_tags_check" CHECK (cardinality("skills"."tags") <= 5 and skills_tags_valid("skills"."tags"));
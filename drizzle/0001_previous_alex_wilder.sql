CREATE INDEX "skills_author_updated_idx" ON "skills" USING btree ("author_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "skills_set_updated_at"() RETURNS trigger AS $$
BEGIN
	NEW."updated_at" = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "skills_set_updated_at"
	BEFORE UPDATE ON "skills"
	FOR EACH ROW
	EXECUTE FUNCTION "skills_set_updated_at"();
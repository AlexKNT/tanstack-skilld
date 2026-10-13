CREATE TABLE "skill_upvotes" (
	"skill_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_upvotes_skill_id_user_id_pk" PRIMARY KEY("skill_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "skill_upvotes" ADD CONSTRAINT "skill_upvotes_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_upvotes_user_skill_idx" ON "skill_upvotes" USING btree ("user_id","skill_id");
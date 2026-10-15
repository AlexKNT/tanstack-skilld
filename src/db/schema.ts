import { sql } from "drizzle-orm";
import {
	check,
	customType,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

/**
 * The store's own stored search document, which the ORM has no built in type
 * for. The application never writes it: it is a generated column, so the store
 * keeps it in step with the row it describes.
 */
const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector";
	},
});

/**
 * The two states a skill's visibility can hold, declared once so the column,
 * the check constraint, and the feature layer cannot drift apart.
 */
export const SKILL_VISIBILITY_VALUES = ["published", "hidden"] as const;

/** One skill's visibility: `published` reaches the catalogue, `hidden` does not. */
export type SkillVisibility = (typeof SKILL_VISIBILITY_VALUES)[number];

/**
 * The published skills.
 *
 * The publisher is held as a Clerk user id and nothing else, so Clerk stays the
 * one place a person's name and photo live. Rules that belong to the store
 * rather than to a form (slug uniqueness, the length ceilings on `name` and
 * `summary`, the ordering of the timestamps) are declared here so a future
 * import obeys them too.
 *
 * The tag list is normalized by `src/features/skills/tags.ts` before it is
 * written, and the check below is the second line of defence: a future import
 * that never ran a form still cannot store a tag the rule would refuse.
 *
 * `skills_tags_valid` is a small immutable function created by the migration
 * (a check constraint cannot walk a list on its own), so the generated SQL is
 * hand edited once to create it before the constraint that calls it.
 *
 * `visibility` sits on the row the catalogue already reads, so hiding a skill
 * costs the public reads a predicate rather than a second table. The three
 * moderation columns describe the last real hide or restore, and nothing here
 * writes them except the moderation write itself.
 */
export const skills = pgTable(
	"skills",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		summary: text("summary").notNull(),
		description: text("description").notNull(),
		installUrl: text("install_url"),
		authorId: text("author_id"),
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
		visibility: text("visibility", { enum: SKILL_VISIBILITY_VALUES })
			.notNull()
			.default("published"),
		moderatedAt: timestamp("moderated_at", { withTimezone: true }),
		moderatedBy: text("moderated_by"),
		moderationReason: text("moderation_reason"),
		searchDocument: tsvector("search_document").generatedAlwaysAs(
			sql`to_tsvector('english', "name" || ' ' || "summary" || ' ' || "description")`,
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("skills_slug_unique").on(table.slug),
		index("skills_created_at_idx").on(table.createdAt.desc(), table.id.desc()),
		index("skills_author_updated_idx").on(
			table.authorId,
			table.updatedAt.desc(),
			table.id.desc(),
		),
		index("skills_tags_idx").using("gin", table.tags),
		index("skills_search_idx").using("gin", table.searchDocument),
		index("skills_visibility_created_idx").on(
			table.visibility,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"skills_visibility_allowed",
			sql`${table.visibility} in ('published', 'hidden')`,
		),
		check(
			"skills_moderation_reason_length",
			sql`${table.moderationReason} is null or char_length(btrim(${table.moderationReason})) between 1 and 200`,
		),
		check(
			"skills_tags_check",
			sql`cardinality(${table.tags}) <= 5 and skills_tags_valid(${table.tags})`,
		),
		check(
			"skills_slug_lowercase_url_safe",
			sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
		),
		check(
			"skills_slug_length",
			sql`char_length(${table.slug}) between 1 and 60`,
		),
		check(
			"skills_name_not_blank",
			sql`char_length(btrim(${table.name})) between 1 and 80`,
		),
		check(
			"skills_summary_not_blank",
			sql`char_length(btrim(${table.summary})) between 1 and 200`,
		),
		check(
			"skills_description_not_blank",
			sql`char_length(btrim(${table.description})) >= 1`,
		),
		check(
			"skills_timestamps_ordered",
			sql`${table.updatedAt} >= ${table.createdAt}`,
		),
	],
);

/** A skill as it is stored, inferred from the schema above. */
export type Skill = typeof skills.$inferSelect;

/** A skill as it is inserted, inferred from the schema above. */
export type NewSkill = typeof skills.$inferInsert;

/**
 * The upvotes cast on a skill.
 *
 * One row is one person's vote, so the count shown anywhere is a count of these
 * rows and no second copy of the number exists to drift. The pair
 * (`skill_id`, `user_id`) is the primary key, which is what refuses a second
 * vote for the same skill from the database rather than from the interface. The
 * voter is held as a Clerk user id, the same way a skill's author is, so there
 * is no local users table to reference. A skill's votes leave with the skill.
 */
export const skillUpvotes = pgTable(
	"skill_upvotes",
	{
		skillId: uuid("skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.skillId, table.userId] }),
		index("skill_upvotes_user_skill_idx").on(table.userId, table.skillId),
	],
);

/** One stored vote, inferred from the schema above. */
export type SkillUpvote = typeof skillUpvotes.$inferSelect;

/** A vote as it is inserted, inferred from the schema above. */
export type NewSkillUpvote = typeof skillUpvotes.$inferInsert;

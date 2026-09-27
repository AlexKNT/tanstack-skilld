import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

/**
 * The published skills.
 *
 * The publisher is held as a Clerk user id and nothing else, so Clerk stays the
 * one place a person's name and photo live. Rules that belong to the store
 * rather than to a form (slug uniqueness, the length ceilings on `name` and
 * `summary`, the ordering of the timestamps) are declared here so a future
 * import obeys them too.
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

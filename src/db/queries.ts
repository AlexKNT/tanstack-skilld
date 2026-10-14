import {
	and,
	asc,
	desc,
	eq,
	getTableColumns,
	type SQL,
	sql,
} from "drizzle-orm";

import { getDatabase } from "./client.server";
import { fail, ok, type Result } from "./result";
import type { Skill } from "./schema";
import { skills, skillUpvotes } from "./schema";

/**
 * One row as the catalogue reads it. The snake case columns are renamed here
 * once, so no caller has to know the store's naming. The two vote columns ride
 * along with the skill, so a card needs no second request to place its button,
 * and the tags ride along the same way.
 */
export type SkillListRow = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	authorId: string | undefined;
	installUrl: string | undefined;
	tags: string[];
	createdAt: Date;
	upvoteCount: number;
	viewerHasUpvoted: boolean;
};

/**
 * What narrows a page of skills, both parts optional.
 *
 * `searchQuery` is the store query text the feature's own pure module built from
 * the typed term (`src/features/skills/search.ts`); it is bound as a value here
 * rather than pasted into a statement, and it is never built in this layer. The
 * tag is already the stored form.
 */
export type SkillRowFilter = {
	searchQuery?: string;
	tag?: string;
};

/**
 * One tag in use, with how many skills carry it.
 */
export type SkillTagCount = {
	tag: string;
	count: number;
};

/**
 * One row as the detail page reads it: every stored column, plus the two vote
 * columns the read carries.
 */
export type SkillDetailRow = Skill & {
	upvoteCount: number;
	viewerHasUpvoted: boolean;
};

/**
 * A nullable column comes back from the driver as `null`. This is the one
 * boundary that turns that into `undefined`, so the rest of the app uses one
 * empty value rather than checking for two.
 */
function toListRow(row: {
	id: string;
	slug: string;
	name: string;
	summary: string;
	authorId: string | null;
	installUrl: string | null;
	tags: string[];
	createdAt: Date;
	upvoteCount: number;
	viewerHasUpvoted: boolean;
}): SkillListRow {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		summary: row.summary,
		authorId: row.authorId ?? undefined,
		installUrl: row.installUrl ?? undefined,
		tags: row.tags,
		createdAt: row.createdAt,
		upvoteCount: row.upvoteCount,
		viewerHasUpvoted: row.viewerHasUpvoted,
	};
}

/** Walks an error and its causes, since a wrapped error hides the original. */
function errorChain(error: unknown): unknown[] {
	const chain: unknown[] = [];
	let current: unknown = error;

	for (let depth = 0; current != null && depth < 5; depth += 1) {
		chain.push(current);
		current = (current as { cause?: unknown }).cause;
	}

	return chain;
}

/**
 * Reports whether a write failed with one of the given store rules.
 *
 * Drizzle wraps the driver's error, so the Postgres SQLSTATE and the constraint
 * name sit on the wrapped cause rather than on the error handed to the caller.
 * Both are checked, the code first, then the constraint for a driver that
 * reports one without the other.
 */
function hasStoreViolation(
	error: unknown,
	code: string,
	constraint: string,
): boolean {
	return errorChain(error).some((link) => {
		if (typeof link !== "object" || link === null) {
			return false;
		}

		const { code: linkCode, constraint: linkConstraint } = link as {
			code?: unknown;
			constraint?: unknown;
		};

		return (
			linkCode === code ||
			(typeof linkConstraint === "string" && linkConstraint === constraint)
		);
	});
}

/**
 * Reports whether a write failed because the slug is already taken.
 *
 * SQLSTATE `23505` is unique_violation, and the only unique rule a skill insert
 * can break is the one on `slug`, because the id is generated.
 */
function isUniqueViolation(error: unknown): boolean {
	return hasStoreViolation(error, "23505", "skills_slug_unique");
}

/**
 * Reports whether a vote failed because the skill it names is not stored.
 *
 * SQLSTATE `23503` is foreign_key_violation, and a vote's only foreign key is
 * the one that points at `skills`, so an insert that trips it is a vote for a
 * skill that is not there.
 */
function isSkillForeignKeyViolation(error: unknown): boolean {
	return hasStoreViolation(
		error,
		"23503",
		"skill_upvotes_skill_id_skills_id_fk",
	);
}

/** The message every read and write uses for a skill that is not stored. */
const SKILL_MISSING = "That skill does not exist or has been removed.";

/**
 * The two vote columns every skill read carries: how many votes the skill holds
 * and whether the viewer cast one of them.
 *
 * The count comes from a grouped subquery joined on the skill, so it is one row
 * per skill and can never multiply a page's rows or break the `limit + 1` rule
 * that decides `hasMore`. The viewer's own state is an existence check against
 * the pair, which is what the `skill_upvotes_user_skill_idx` index serves. A
 * signed out viewer owns no vote, so the answer is a plain false rather than a
 * query.
 */
function upvoteRead(viewerId: string | undefined) {
	const counts = getDatabase()
		.select({
			skillId: skillUpvotes.skillId,
			count: sql<number>`count(*)::int`.as("count"),
		})
		.from(skillUpvotes)
		.groupBy(skillUpvotes.skillId)
		.as("vote_counts");

	return {
		counts,
		columns: {
			upvoteCount: sql<number>`coalesce(${counts.count}, 0)::int`,
			viewerHasUpvoted:
				viewerId === undefined
					? sql<boolean>`false`
					: sql<boolean>`exists (
						select 1 from ${skillUpvotes}
						where ${skillUpvotes.skillId} = ${skills.id}
							and ${skillUpvotes.userId} = ${viewerId}
					)`,
		},
	};
}

/**
 * The conditions a filter adds to a page read, one per present part.
 *
 * A term is matched against the store's own search document through the query
 * text built for it, and a tag through the stored list, so both arrive as bound
 * values and neither can reshape the statement. Nothing here builds a query
 * from raw input: the text comes from the feature's pure search module.
 */
function filterConditions(filter: SkillRowFilter | undefined): SQL[] {
	if (filter === undefined) {
		return [];
	}

	const conditions: SQL[] = [];

	if (filter.searchQuery !== undefined) {
		conditions.push(
			sql`${skills.searchDocument} @@ to_tsquery('english', ${filter.searchQuery})`,
		);
	}

	if (filter.tag !== undefined) {
		conditions.push(sql`${skills.tags} @> array[${filter.tag}]::text[]`);
	}

	return conditions;
}

/**
 * Reads a page of skills, newest first, with each skill's tag list, its vote
 * count, and whether the given viewer has voted for it.
 *
 * The order is by creation time and then by id, so two skills saved in the same
 * millisecond still come back in a stable order. The order, the bound and the
 * "one extra row" rule are the same whether or not a filter is present.
 * Anything unexpected is turned into a returned failure here, so no caller has
 * to catch a driver error.
 */
export async function listSkillRows(
	limit: number,
	offset: number,
	viewerId?: string,
	filter?: SkillRowFilter,
): Promise<Result<SkillListRow[], "SKILLS_QUERY_FAILED">> {
	try {
		const votes = upvoteRead(viewerId);
		const conditions = filterConditions(filter);

		const rows = await getDatabase()
			.select({
				id: skills.id,
				slug: skills.slug,
				name: skills.name,
				summary: skills.summary,
				authorId: skills.authorId,
				installUrl: skills.installUrl,
				tags: skills.tags,
				createdAt: skills.createdAt,
				...votes.columns,
			})
			.from(skills)
			.leftJoin(votes.counts, eq(votes.counts.skillId, skills.id))
			.where(conditions.length === 0 ? undefined : and(...conditions))
			.orderBy(desc(skills.createdAt), desc(skills.id))
			.limit(limit)
			.offset(offset);

		return ok(rows.map(toListRow));
	} catch (error) {
		console.error("[skills] listSkills query failed", error);
		return fail("SKILLS_QUERY_FAILED", "The catalogue could not be loaded.");
	}
}

/**
 * Reads every tag in use with the number of skills carrying it, most used
 * first and ties broken by the tag itself so the order is stable across reads.
 *
 * This is the one read of the feature that is not bounded by a page: it
 * aggregates the whole tag column, so it is bounded by the number of distinct
 * tags rather than by the number of skills. That is acceptable at this size and
 * is written down rather than implied (spec 0008).
 */
export async function listSkillTagRows(): Promise<
	Result<SkillTagCount[], "SKILLS_QUERY_FAILED">
> {
	try {
		const rows = await getDatabase()
			.select({
				tag: sql<string>`tag`.as("tag"),
				count: sql<number>`count(*)::int`.as("count"),
			})
			.from(sql`${skills}, unnest(${skills.tags}) as tag`)
			.groupBy(sql`tag`)
			.orderBy(sql`count(*) desc, tag asc`);

		return ok(rows);
	} catch (error) {
		console.error("[skills] listSkillTags query failed", error);
		return fail("SKILLS_QUERY_FAILED", "The tags could not be loaded.");
	}
}

/**
 * Inserts a skill under one candidate slug.
 *
 * Returns the created row, or `undefined` when the slug is already taken, which
 * is the caller's signal to try the next candidate. The check is deliberately
 * not a read before the write: two writers asking at the same moment both get
 * their answer from the database's unique rule rather than from a race.
 */
export async function insertSkillWithSlug(
	slug: string,
	values: {
		name: string;
		summary: string;
		description: string;
		installUrl?: string;
		authorId?: string;
		tags?: string[];
		createdAt?: Date;
	},
): Promise<Result<Skill | undefined, "SKILLS_WRITE_FAILED">> {
	try {
		const [row] = await getDatabase()
			.insert(skills)
			.values({
				slug,
				name: values.name,
				summary: values.summary,
				description: values.description,
				installUrl: values.installUrl ?? null,
				authorId: values.authorId ?? null,
				tags: values.tags ?? [],
				createdAt: values.createdAt,
				updatedAt: values.createdAt,
			})
			.returning();

		return ok(row);
	} catch (error) {
		if (isUniqueViolation(error)) {
			return ok(undefined);
		}

		console.error("[skills] insert failed", error);
		return fail("SKILLS_WRITE_FAILED", "The skill could not be saved.");
	}
}

/**
 * Looks a skill up by its slug, with its vote count and whether the given
 * viewer has voted for it.
 *
 * Used by the detail page and by the seed, which only reads the stored columns.
 */
export async function findSkillBySlug(
	slug: string,
	viewerId?: string,
): Promise<Result<SkillDetailRow | undefined, "SKILLS_QUERY_FAILED">> {
	try {
		const votes = upvoteRead(viewerId);

		const [row] = await getDatabase()
			.select({ ...getTableColumns(skills), ...votes.columns })
			.from(skills)
			.leftJoin(votes.counts, eq(votes.counts.skillId, skills.id))
			.where(eq(skills.slug, slug))
			.limit(1);

		return ok(row);
	} catch (error) {
		console.error("[skills] slug lookup failed", error);
		return fail("SKILLS_QUERY_FAILED", "The skill could not be loaded.");
	}
}

/** Confirms the store answers, used by the seed before it writes anything. */
export async function checkSkillsTableReachable(): Promise<boolean> {
	try {
		await getDatabase().select({ one: sql`1` }).from(skills).limit(1);
		return true;
	} catch (error) {
		console.error("[skills] the skills table is not reachable", error);
		return false;
	}
}

/**
 * Records one person's vote on one skill.
 *
 * Idempotent: a vote that is already stored is left alone rather than added
 * twice, so a repeated or retried call moves the count once. The row carries no
 * state of its own beyond its creation time, which is the voter's own record.
 * Reports whether a new row landed, and answers `SKILL_NOT_FOUND` when the
 * skill is not stored, which the store's own foreign key refuses.
 */
export async function insertUpvoteRow(
	skillId: string,
	userId: string,
): Promise<Result<boolean, "SKILL_NOT_FOUND" | "SKILLS_WRITE_FAILED">> {
	try {
		const rows = await getDatabase()
			.insert(skillUpvotes)
			.values({ skillId, userId })
			.onConflictDoNothing()
			.returning({ skillId: skillUpvotes.skillId });

		return ok(rows.length > 0);
	} catch (error) {
		if (isSkillForeignKeyViolation(error)) {
			return fail("SKILL_NOT_FOUND", SKILL_MISSING);
		}

		console.error("[skills] upvote insert failed", error);
		return fail("SKILLS_WRITE_FAILED", "Your upvote could not be saved.");
	}
}

/**
 * Removes one person's vote, tolerating a vote that is not there.
 *
 * Idempotent in the same way as the insert, so repeating a withdrawal leaves
 * the store as it was and the count unmoved. Reports whether a row was removed.
 */
export async function deleteUpvoteRow(
	skillId: string,
	userId: string,
): Promise<Result<boolean, "SKILLS_WRITE_FAILED">> {
	try {
		const rows = await getDatabase()
			.delete(skillUpvotes)
			.where(
				and(eq(skillUpvotes.skillId, skillId), eq(skillUpvotes.userId, userId)),
			)
			.returning({ skillId: skillUpvotes.skillId });

		return ok(rows.length > 0);
	} catch (error) {
		console.error("[skills] upvote delete failed", error);
		return fail("SKILLS_WRITE_FAILED", "Your upvote could not be removed.");
	}
}

/**
 * Counts the votes one skill holds, straight from the stored rows, so the
 * number can never disagree with them. A skill with no votes answers zero.
 */
export async function countUpvoteRows(
	skillId: string,
): Promise<Result<number, "SKILLS_QUERY_FAILED">> {
	try {
		const [row] = await getDatabase()
			.select({ count: sql<number>`count(*)::int` })
			.from(skillUpvotes)
			.where(eq(skillUpvotes.skillId, skillId));

		return ok(row?.count ?? 0);
	} catch (error) {
		console.error("[skills] upvote count failed", error);
		return fail("SKILLS_QUERY_FAILED", "The upvote count could not be read.");
	}
}

/**
 * Reports whether a skill is stored.
 *
 * Read before a vote is withdrawn, which has no foreign key of its own to lean
 * on: a delete that matches nothing would otherwise look like a success. The
 * only way this read goes stale is the skill being deleted in between, and a
 * deleted skill takes its votes with it, so the answer stays honest.
 */
export async function skillRowExists(
	skillId: string,
): Promise<Result<boolean, "SKILLS_QUERY_FAILED">> {
	try {
		const [row] = await getDatabase()
			.select({ id: skills.id })
			.from(skills)
			.where(eq(skills.id, skillId))
			.limit(1);

		return ok(row !== undefined);
	} catch (error) {
		console.error("[skills] skill existence check failed", error);
		return fail("SKILLS_QUERY_FAILED", "The skill could not be loaded.");
	}
}
/** Reads every skill's slug, so the seed knows which ones already exist. */
export async function listSkillSlugs(): Promise<string[]> {
	const rows = await getDatabase()
		.select({ slug: skills.slug })
		.from(skills)
		.orderBy(asc(skills.slug));

	return rows.map((row) => row.slug);
}

/** One row as the signed in area's list reads it. */
export type ManagedSkillRow = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	updatedAt: Date;
};

/**
 * Reads one page of an author's own skills, most recently updated first.
 *
 * The author id comes from the session, never from the caller, so the filter
 * cannot be widened to another person's rows. The order matches the
 * `skills_author_updated_idx` index, which is what keeps it cheap.
 */
export async function listSkillRowsByAuthor(
	authorId: string,
	limit: number,
	offset: number,
): Promise<Result<ManagedSkillRow[], "SKILLS_QUERY_FAILED">> {
	try {
		const rows = await getDatabase()
			.select({
				id: skills.id,
				slug: skills.slug,
				name: skills.name,
				summary: skills.summary,
				updatedAt: skills.updatedAt,
			})
			.from(skills)
			.where(eq(skills.authorId, authorId))
			.orderBy(desc(skills.updatedAt), desc(skills.id))
			.limit(limit)
			.offset(offset);

		return ok(rows);
	} catch (error) {
		console.error("[skills] listSkillRowsByAuthor query failed", error);
		return fail("SKILLS_QUERY_FAILED", "Your skills could not be loaded.");
	}
}

/**
 * Counts an author's skills.
 *
 * A real `count(*)` rather than the length of a loaded page, so the overview
 * reports the total even when the list is paged.
 */
export async function countSkillRowsByAuthor(
	authorId: string,
): Promise<Result<number, "SKILLS_QUERY_FAILED">> {
	try {
		const [row] = await getDatabase()
			.select({ count: sql<number>`count(*)::int` })
			.from(skills)
			.where(eq(skills.authorId, authorId));

		return ok(row?.count ?? 0);
	} catch (error) {
		console.error("[skills] countSkillRowsByAuthor query failed", error);
		return fail("SKILLS_QUERY_FAILED", "Your skill count could not be loaded.");
	}
}

/**
 * Looks a skill up by slug only when it belongs to the given author.
 *
 * Returns `undefined` for a missing row and for someone else's row alike, so
 * the caller answers both the same way and never confirms that another
 * author's skill exists.
 */
export async function findSkillRowForAuthor(
	slug: string,
	authorId: string,
): Promise<Result<Skill | undefined, "SKILLS_QUERY_FAILED">> {
	try {
		const [row] = await getDatabase()
			.select()
			.from(skills)
			.where(and(eq(skills.slug, slug), eq(skills.authorId, authorId)))
			.limit(1);

		return ok(row);
	} catch (error) {
		console.error("[skills] author lookup failed", error);
		return fail("SKILLS_QUERY_FAILED", "The skill could not be loaded.");
	}
}

/**
 * Updates the editable fields of an author's skill.
 *
 * The ownership check is part of the `where` clause, so the write is atomic:
 * a mismatch updates nothing and the caller gets `undefined`. The tag list is
 * replaced wholesale, the way the form collects it. `updated_at` is
 * deliberately not set here, the database trigger owns it.
 */
export async function updateSkillRow(
	slug: string,
	authorId: string,
	values: {
		name: string;
		summary: string;
		description: string;
		installUrl?: string;
		tags: string[];
	},
): Promise<Result<Skill | undefined, "SKILLS_WRITE_FAILED">> {
	try {
		const [row] = await getDatabase()
			.update(skills)
			.set({
				name: values.name,
				summary: values.summary,
				description: values.description,
				installUrl: values.installUrl ?? null,
				tags: values.tags,
			})
			.where(and(eq(skills.slug, slug), eq(skills.authorId, authorId)))
			.returning();

		return ok(row);
	} catch (error) {
		console.error("[skills] update failed", error);
		return fail("SKILLS_WRITE_FAILED", "The skill could not be saved.");
	}
}

/**
 * Deletes an author's skill for good.
 *
 * Returns whether a row was removed, so a mismatch (or a missing skill) is
 * reported as not found rather than as a success.
 */
export async function deleteSkillRow(
	slug: string,
	authorId: string,
): Promise<Result<boolean, "SKILLS_WRITE_FAILED">> {
	try {
		const rows = await getDatabase()
			.delete(skills)
			.where(and(eq(skills.slug, slug), eq(skills.authorId, authorId)))
			.returning({ id: skills.id });

		return ok(rows.length > 0);
	} catch (error) {
		console.error("[skills] delete failed", error);
		return fail("SKILLS_WRITE_FAILED", "The skill could not be deleted.");
	}
}

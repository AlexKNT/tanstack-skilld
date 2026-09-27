import { asc, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "./client.server";
import { fail, ok, type Result } from "./result";
import type { Skill } from "./schema";
import { skills } from "./schema";

/**
 * One row as the catalogue reads it. The snake case columns are renamed here
 * once, so no caller has to know the store's naming.
 */
export type SkillListRow = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	authorId: string | undefined;
	installUrl: string | undefined;
	createdAt: Date;
};

/**
 * A nullable column comes back from the driver as `null`. This is the one
 * boundary that turns that into `undefined`, so the rest of the app uses one
 * empty value rather than checking for two.
 */
function toListRow(row: Skill): SkillListRow {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		summary: row.summary,
		authorId: row.authorId ?? undefined,
		installUrl: row.installUrl ?? undefined,
		createdAt: row.createdAt,
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
 * Reports whether a write failed because the slug is already taken.
 *
 * Drizzle wraps the driver's error, so the Postgres SQLSTATE sits on the
 * wrapped cause rather than on the error handed to the caller. Both are
 * checked. SQLSTATE `23505` is unique_violation, and the only unique rule a
 * skill insert can break is the one on `slug`, because the id is generated.
 */
function isUniqueViolation(error: unknown): boolean {
	return errorChain(error).some((link) => {
		if (typeof link !== "object" || link === null) {
			return false;
		}

		const { code, constraint } = link as {
			code?: unknown;
			constraint?: unknown;
		};

		return (
			code === "23505" ||
			(typeof constraint === "string" && constraint === "skills_slug_unique")
		);
	});
}

/**
 * Reads a page of skills, newest first.
 *
 * The order is by creation time and then by id, so two skills saved in the same
 * millisecond still come back in a stable order. Anything unexpected is turned
 * into a returned failure here, so no caller has to catch a driver error.
 */
export async function listSkillRows(
	limit: number,
	offset: number,
): Promise<Result<SkillListRow[], "SKILLS_QUERY_FAILED">> {
	try {
		const rows = await getDatabase()
			.select()
			.from(skills)
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
 * Looks a skill up by its slug, used by the seed to decide whether a sample row
 * is already there.
 */
export async function findSkillBySlug(
	slug: string,
): Promise<Result<Skill | undefined, "SKILLS_QUERY_FAILED">> {
	try {
		const [row] = await getDatabase()
			.select()
			.from(skills)
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

/** Reads every skill's slug, so the seed knows which ones already exist. */
export async function listSkillSlugs(): Promise<string[]> {
	const rows = await getDatabase()
		.select({ slug: skills.slug })
		.from(skills)
		.orderBy(asc(skills.slug));

	return rows.map((row) => row.slug);
}

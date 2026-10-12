import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import {
	deleteSkillRow,
	findSkillBySlug,
	findSkillRowForAuthor,
	insertSkillWithSlug,
	listSkillRows,
	listSkillRowsByAuthor,
	type SkillListRow,
	updateSkillRow,
} from "#/db/queries";
import { fail, ok, type Result } from "#/db/result";
import {
	type CreateSkillInput,
	type SkillFailureCode,
	type SkillReadFailureCode,
	type SkillSlugInput,
	type UpdateSkillInput,
	type ValidatedSkillInput,
	validateCreateSkillInput,
	validateListSkillsInput,
	validateSkillDetailInput,
	validateUpdateSkillInput,
} from "./schema";
import { slugify, slugWithSuffix } from "./slug";

/** How many clashing slugs to try before giving up on a derived name. */
const MAX_SLUG_ATTEMPTS = 25;

/**
 * The skill shape the catalogue reads: the columns a card needs, with the
 * nullable ones expressed as `undefined` rather than `null`.
 */
export type SkillListItem = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	authorId: string | undefined;
	installUrl: string | undefined;
	createdAt: Date;
};

/**
 * Reads the catalogue, newest first.
 *
 * Public: the catalogue is the front page and anyone may read it. Deliberately
 * returns a failure rather than throwing, so the page renders an error state
 * instead of falling over.
 */
export const listSkills = createServerFn({ method: "GET" })
	.inputValidator((input: { limit?: number; offset?: number } | undefined) =>
		validateListSkillsInput(input ?? {}),
	)
	.handler(
		async ({
			data,
		}): Promise<
			Result<SkillListItem[], "VALIDATION_FAILED" | "SKILLS_QUERY_FAILED">
		> => {
			if (!data.ok) {
				return data;
			}

			return listSkillRows(data.value.limit, data.value.offset);
		},
	);

/** A skill's publisher, read from Clerk and shown beside the skill. */
export type SkillAuthor = {
	id: string;
	name: string;
	imageUrl: string | undefined;
};

/** One skill as the catalogue's cards read it. */
export type SkillCard = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	installUrl: string | undefined;
	createdAt: Date;
	author: SkillAuthor | undefined;
};

/** One page of cards, and whether a further page follows. */
export type SkillCardPage = {
	items: SkillCard[];
	hasMore: boolean;
};

/** One skill as the detail page reads it: a card plus its markdown body. */
export type SkillDetail = SkillCard & {
	description: string;
	updatedAt: Date;
};

/**
 * Reads one page of cards for the catalogue, newest first.
 *
 * Asks the store for one row more than the page holds, so `hasMore` is decided
 * from a real row rather than from the page size: an exact multiple of the page
 * size correctly reports that nothing follows.
 *
 * Public, and deliberately returns a failure rather than throwing, so the page
 * renders an error state instead of falling over.
 */
export const listSkillCards = createServerFn({ method: "GET" })
	.inputValidator((input: { limit?: number; offset?: number } | undefined) =>
		validateListSkillsInput(input ?? {}),
	)
	.handler(
		async ({ data }): Promise<Result<SkillCardPage, SkillReadFailureCode>> => {
			if (!data.ok) {
				return data;
			}

			const { limit, offset } = data.value;
			const rows = await listSkillRows(limit + 1, offset);
			if (!rows.ok) {
				return rows;
			}

			const hasMore = rows.value.length > limit;
			const pageRows = hasMore ? rows.value.slice(0, limit) : rows.value;
			const authors = await loadAuthors(pageRows.map((row) => row.authorId));

			return ok({
				items: pageRows.map((row) => toCard(row, authors)),
				hasMore,
			});
		},
	);

/**
 * Reads one skill by its slug, for the detail page.
 *
 * Public. A slug that is not stored returns `SKILL_NOT_FOUND` rather than an
 * empty success, so the page can answer with a real 404.
 */
export const getSkillDetail = createServerFn({ method: "GET" })
	.inputValidator((input: SkillSlugInput) => validateSkillDetailInput(input))
	.handler(
		async ({ data }): Promise<Result<SkillDetail, SkillReadFailureCode>> => {
			if (!data.ok) {
				return data;
			}

			const found = await findSkillBySlug(data.value.slug);
			if (!found.ok) {
				return found;
			}

			const row = found.value;
			if (row === undefined) {
				return fail(
					"SKILL_NOT_FOUND",
					"That skill does not exist or has been removed.",
				);
			}

			const authorId = row.authorId ?? undefined;
			const authors = await loadAuthors([authorId]);

			return ok({
				id: row.id,
				slug: row.slug,
				name: row.name,
				summary: row.summary,
				description: row.description,
				installUrl: row.installUrl ?? undefined,
				updatedAt: row.updatedAt,
				createdAt: row.createdAt,
				author: authorId === undefined ? undefined : authors.get(authorId),
			});
		},
	);

/** Folds a stored row and its resolved publisher into a card. */
function toCard(
	row: SkillListRow,
	authors: Map<string, SkillAuthor>,
): SkillCard {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		summary: row.summary,
		installUrl: row.installUrl,
		createdAt: row.createdAt,
		author: row.authorId === undefined ? undefined : authors.get(row.authorId),
	};
}

/**
 * Reads the publishers for a page of skills in one batched Clerk call.
 *
 * Best effort by design: duplicate ids are asked for once, only the three
 * fields a card needs are read, and any failure (a slow Clerk, an unknown id)
 * is logged and answered with an empty map so the skills still render.
 */
async function loadAuthors(
	authorIds: ReadonlyArray<string | undefined>,
): Promise<Map<string, SkillAuthor>> {
	const uniqueIds = [
		...new Set(authorIds.filter((id): id is string => id !== undefined)),
	];

	if (uniqueIds.length === 0) {
		return new Map();
	}

	try {
		const { data } = await clerkClient().users.getUserList({
			limit: uniqueIds.length,
			userId: uniqueIds,
		});

		const authors = new Map<string, SkillAuthor>();
		for (const user of data) {
			const fullName = [user.firstName, user.lastName]
				.filter((part) => part !== null && part !== "")
				.join(" ")
				.trim();

			authors.set(user.id, {
				id: user.id,
				name: fullName === "" ? (user.username ?? "Skild member") : fullName,
				imageUrl: user.imageUrl === "" ? undefined : user.imageUrl,
			});
		}

		return authors;
	} catch (error) {
		console.error("[skills] publisher lookup failed", error);
		return new Map();
	}
}

/** The created skill a caller gets back, including the slug the server chose. */
export type CreatedSkill = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	description: string;
	installUrl: string | undefined;
	authorId: string | undefined;
	createdAt: Date;
};

/**
 * Saves one skill, with the slug derived on the server so two clients cannot
 * disagree about a URL.
 *
 * Requires a signed in session, and takes the author id from that session
 * rather than from the payload, so nobody can publish under another person's
 * name. A clashing slug is retried with a numeric suffix rather than refused.
 */
export const createSkill = createServerFn({ method: "POST" })
	.inputValidator((input: CreateSkillInput) => input)
	.handler(
		async ({ data }): Promise<Result<CreatedSkill, SkillFailureCode>> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return {
					ok: false,
					code: "UNAUTHENTICATED",
					message: "Sign in to publish a skill.",
				};
			}

			const validated = validateCreateSkillInput(data);
			if (!validated.ok) {
				return validated;
			}

			return saveSkill(validated.value, userId);
		},
	);

/** Writes a validated skill, working through slug candidates on a clash. */
async function saveSkill(
	values: ValidatedSkillInput,
	authorId: string,
): Promise<Result<CreatedSkill, SkillFailureCode>> {
	const baseSlug = slugify(values.name);

	for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
		const candidate = slugWithSuffix(baseSlug, attempt);

		const inserted = await insertSkillWithSlug(candidate, {
			name: values.name,
			summary: values.summary,
			description: values.description,
			installUrl: values.installUrl,
			authorId,
		});

		if (!inserted.ok) {
			return inserted;
		}

		if (inserted.value !== undefined) {
			const row = inserted.value;
			return {
				ok: true,
				value: {
					id: row.id,
					slug: row.slug,
					name: row.name,
					summary: row.summary,
					description: row.description,
					installUrl: row.installUrl ?? undefined,
					authorId: row.authorId ?? undefined,
					createdAt: row.createdAt,
				},
			};
		}
	}

	return {
		ok: false,
		code: "SKILLS_WRITE_FAILED",
		message: "That name is already taken by a lot of skills. Try another name.",
	};
}

/**
 * The failure codes the signed in area's reads and writes can return.
 *
 * `SKILL_NOT_FOUND` covers both a missing skill and someone else's skill, so the
 * caller never learns that another author's skill exists.
 */
export type SkillManageFailureCode =
	| "UNAUTHENTICATED"
	| "VALIDATION_FAILED"
	| "SKILL_NOT_FOUND"
	| "SKILLS_QUERY_FAILED"
	| "SKILLS_WRITE_FAILED";

/** One management card: enough to link to the edit page and the public page. */
export type ManagedSkillCard = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	updatedAt: Date;
};

/** One page of management cards, and whether a further page follows. */
export type ManagedSkillPage = {
	items: ManagedSkillCard[];
	hasMore: boolean;
};

/** One skill as the edit form reads it, ready to prefill the four fields. */
export type MySkill = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	description: string;
	installUrl: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

/** Folds a stored row into the shape the edit form works with. */
function toMySkill(row: {
	id: string;
	slug: string;
	name: string;
	summary: string;
	description: string;
	installUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}): MySkill {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		summary: row.summary,
		description: row.description,
		installUrl: row.installUrl ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

const NOT_FOUND: Result<never, "SKILL_NOT_FOUND"> = fail(
	"SKILL_NOT_FOUND",
	"That skill does not exist or has been removed.",
);

const UNAUTHENTICATED_SKILLS = "Sign in to see your skills.";

/**
 * Reads one page of the signed in user's own skills, most recently updated
 * first. The author filter is the session user id, never an input.
 */
export const listMySkillCards = createServerFn({ method: "GET" })
	.inputValidator((input: { limit?: number; offset?: number } | undefined) =>
		validateListSkillsInput(input ?? {}),
	)
	.handler(
		async ({
			data,
		}): Promise<
			Result<
				ManagedSkillPage,
				"UNAUTHENTICATED" | "VALIDATION_FAILED" | "SKILLS_QUERY_FAILED"
			>
		> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return fail("UNAUTHENTICATED", UNAUTHENTICATED_SKILLS);
			}

			if (!data.ok) {
				return data;
			}

			const { limit, offset } = data.value;
			const rows = await listSkillRowsByAuthor(userId, limit + 1, offset);
			if (!rows.ok) {
				return rows;
			}

			const hasMore = rows.value.length > limit;
			const pageRows = hasMore ? rows.value.slice(0, limit) : rows.value;

			return ok({ items: pageRows, hasMore });
		},
	);

/**
 * Reads one of the signed in user's own skills for editing.
 *
 * A skill that belongs to someone else answers exactly as a missing one does.
 */
export const getMySkill = createServerFn({ method: "GET" })
	.inputValidator((input: SkillSlugInput) => validateSkillDetailInput(input))
	.handler(
		async ({ data }): Promise<Result<MySkill, SkillManageFailureCode>> => {
			if (!data.ok) {
				return data;
			}

			const { isAuthenticated, userId } = await auth();
			if (!isAuthenticated || !userId) {
				return fail("UNAUTHENTICATED", "Sign in to edit a skill.");
			}

			return loadOwnedSkill(data.value.slug, userId);
		},
	);

/** Resolves a slug for an author, or reports it as not found. */
async function loadOwnedSkill(
	slug: string,
	userId: string,
): Promise<Result<MySkill, SkillManageFailureCode>> {
	const found = await findSkillRowForAuthor(slug, userId);
	if (!found.ok) {
		return found;
	}

	if (found.value === undefined) {
		return NOT_FOUND;
	}

	return ok(toMySkill(found.value));
}

/**
 * Saves an edit to one of the caller's own skills.
 *
 * Requires a signed in session, validates the same four fields publishing does,
 * and settles ownership in the database write itself. The slug is never read
 * from the payload as a new value: it addresses the row and is left unchanged.
 */
export const updateSkill = createServerFn({ method: "POST" })
	.inputValidator((input: UpdateSkillInput) => input)
	.handler(
		async ({ data }): Promise<Result<MySkill, SkillManageFailureCode>> => {
			const { isAuthenticated, userId } = await auth();
			if (!isAuthenticated || !userId) {
				return fail("UNAUTHENTICATED", "Sign in to save your changes.");
			}

			const validated = validateUpdateSkillInput(data);
			if (!validated.ok) {
				return validated;
			}

			const updated = await updateSkillRow(validated.value.slug, userId, {
				name: validated.value.name,
				summary: validated.value.summary,
				description: validated.value.description,
				installUrl: validated.value.installUrl,
			});

			if (!updated.ok) {
				return updated;
			}

			if (updated.value === undefined) {
				return NOT_FOUND;
			}

			return ok(toMySkill(updated.value));
		},
	);

/** Deletes one of the caller's own skills for good. */
export const deleteSkill = createServerFn({ method: "POST" })
	.inputValidator((input: SkillSlugInput) => validateSkillDetailInput(input))
	.handler(
		async ({ data }): Promise<Result<undefined, SkillManageFailureCode>> => {
			if (!data.ok) {
				return data;
			}

			const { isAuthenticated, userId } = await auth();
			if (!isAuthenticated || !userId) {
				return fail("UNAUTHENTICATED", "Sign in to delete a skill.");
			}

			const deleted = await deleteSkillRow(data.value.slug, userId);
			if (!deleted.ok) {
				return deleted;
			}

			if (!deleted.value) {
				return NOT_FOUND;
			}

			return ok(undefined);
		},
	);

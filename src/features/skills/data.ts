import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import {
	countUpvoteRows,
	deleteSkillRow,
	deleteUpvoteRow,
	findSkillBySlug,
	findSkillRowForAuthor,
	insertSkillWithSlug,
	insertUpvoteRow,
	listSkillRows,
	listSkillRowsByAuthor,
	listSkillTagRows,
	type SkillListRow,
	skillRowExists,
	updateSkillRow,
} from "#/db/queries";
import { fail, ok, type Result } from "#/db/result";
import type { SkillVisibility } from "#/db/schema";
import { loadAuthors, type SkillAuthor } from "./authors.server";
import {
	type CreateSkillInput,
	type SetUpvoteInput,
	type SkillFailureCode,
	type SkillReadFailureCode,
	type SkillSlugInput,
	type UpdateSkillInput,
	type UpvoteFailureCode,
	type ValidatedSkillInput,
	validateCreateSkillInput,
	validateListSkillsInput,
	validateSetUpvoteInput,
	validateSkillDetailInput,
	validateUpdateSkillInput,
} from "./schema";
import { buildSearchQuery } from "./search";
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
	tags: string[];
	createdAt: Date;
	upvoteCount: number;
	viewerHasUpvoted: boolean;
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

			const viewerId = await currentViewerId();
			return listSkillRows(data.value.limit, data.value.offset, viewerId);
		},
	);

/** A skill's publisher, read from Clerk and shown beside the skill. */
export type { SkillAuthor } from "./authors.server";

/** One skill as the catalogue's cards read it. */
export type SkillCard = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	installUrl: string | undefined;
	tags: string[];
	createdAt: Date;
	author: SkillAuthor | undefined;
	upvoteCount: number;
	viewerHasUpvoted: boolean;
};

/** What narrows the catalogue: a typed term, a chosen tag, or both. */
export type CatalogueFilter = {
	term?: string;
	tag?: string;
};

/** One tag in use, with the number of skills carrying it. */
export type SkillTag = {
	tag: string;
	count: number;
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
 * size correctly reports that nothing follows. The viewer is read from the
 * session here, never from the browser, and each card carries the skill's count
 * and the viewer's own vote.
 *
 * Both filter inputs are optional and both are validated before they reach the
 * store: the typed term is reduced to a bound query by the feature's own pure
 * module, so no typing can reshape a statement, and the tag is compared in its
 * stored form. With neither input the read returns exactly what it always has.
 *
 * Public, and deliberately returns a failure rather than throwing, so the page
 * renders an error state instead of falling over.
 */
export const listSkillCards = createServerFn({ method: "GET" })
	.inputValidator(
		(
			input:
				| { limit?: number; offset?: number; term?: string; tag?: string }
				| undefined,
		) => validateListSkillsInput(input ?? {}),
	)
	.handler(
		async ({ data }): Promise<Result<SkillCardPage, SkillReadFailureCode>> => {
			if (!data.ok) {
				return data;
			}

			const { limit, offset, term, tag } = data.value;
			const viewerId = await currentViewerId();
			const searchQuery =
				term === undefined ? undefined : buildSearchQuery(term);
			const rows = await listSkillRows(limit + 1, offset, viewerId, {
				searchQuery,
				tag,
			});
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
 * Reads the tags actually in use, each with the number of skills carrying it,
 * most used first.
 *
 * Public, like the catalogue beside it. The row behind the catalogue's chips is
 * the only source of a tag a visitor may pick, so a chip can never lead to an
 * empty result.
 */
export const listSkillTags = createServerFn({ method: "GET" }).handler(
	async (): Promise<Result<{ items: SkillTag[] }, "SKILLS_QUERY_FAILED">> => {
		const rows = await listSkillTagRows();
		if (!rows.ok) {
			return rows;
		}

		return ok({ items: rows.value });
	},
);

/**
 * Reads one skill by its slug, for the detail page.
 *
 * Public. A slug that is not stored returns `SKILL_NOT_FOUND` rather than an
 * empty success, so the page can answer with a real 404. The viewer's own vote
 * is read from the session, the same way the catalogue reads it.
 */
export const getSkillDetail = createServerFn({ method: "GET" })
	.inputValidator((input: SkillSlugInput) => validateSkillDetailInput(input))
	.handler(
		async ({ data }): Promise<Result<SkillDetail, SkillReadFailureCode>> => {
			if (!data.ok) {
				return data;
			}

			const viewerId = await currentViewerId();
			const found = await findSkillBySlug(data.value.slug, viewerId);
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
				tags: row.tags,
				updatedAt: row.updatedAt,
				createdAt: row.createdAt,
				author: authorId === undefined ? undefined : authors.get(authorId),
				upvoteCount: row.upvoteCount,
				viewerHasUpvoted: row.viewerHasUpvoted,
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
		tags: row.tags,
		createdAt: row.createdAt,
		author: row.authorId === undefined ? undefined : authors.get(row.authorId),
		upvoteCount: row.upvoteCount,
		viewerHasUpvoted: row.viewerHasUpvoted,
	};
}

/**
 * Reads the signed in user's id, or nothing when there is no session.
 *
 * A failed session read answers "signed out" rather than failing: the count is
 * public, so a Clerk problem should leave the page rendering with its counts
 * instead of taking it down. The voter is always this value read on the server,
 * never a value supplied by the browser.
 */
async function currentViewerId(): Promise<string | undefined> {
	try {
		const { isAuthenticated, userId } = await auth();

		return isAuthenticated && userId ? userId : undefined;
	} catch (error) {
		console.error("[skills] session read failed", error);
		return undefined;
	}
}

/**
 * Reads the viewer's id for the root route, which puts it in the cache key of
 * every read that answers per viewer, so one person's vote state can never be
 * served as another's. Answers `undefined` when signed out.
 */
export const readViewerId = createServerFn({ method: "GET" }).handler(
	async (): Promise<string | undefined> => currentViewerId(),
);

/** The state one skill's votes are in for one viewer. */
export type UpvoteState = {
	upvoted: boolean;
	upvoteCount: number;
};

/**
 * Moves one skill's vote for the signed in viewer to the state asked for.
 *
 * Takes the state to reach rather than the state held, so both directions are
 * safe to repeat or retry: asking for a vote that is already stored leaves one
 * row, and asking for no vote when there is none leaves nothing. Requires a
 * session, and the voter is that session's user id, never the payload's. The
 * answer carries the state the store now holds and the count read from it, so
 * the caller can settle its button and its number without asking again.
 */
export const setUpvote = createServerFn({ method: "POST" })
	.inputValidator((input: SetUpvoteInput) => input)
	.handler(
		async ({ data }): Promise<Result<UpvoteState, UpvoteFailureCode>> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return fail("UNAUTHENTICATED", "Sign in to upvote a skill.");
			}

			const validated = validateSetUpvoteInput(data);
			if (!validated.ok) {
				return validated;
			}

			const { skillId, upvoted } = validated.value;

			if (upvoted) {
				const inserted = await insertUpvoteRow(skillId, userId);
				if (!inserted.ok) {
					return inserted;
				}
			} else {
				// A withdrawal has no foreign key to lean on, so the skill is
				// checked first rather than reporting a delete that matched nothing.
				const exists = await skillRowExists(skillId);
				if (!exists.ok) {
					return exists;
				}

				if (!exists.value) {
					return fail(
						"SKILL_NOT_FOUND",
						"That skill does not exist or has been removed.",
					);
				}

				const removed = await deleteUpvoteRow(skillId, userId);
				if (!removed.ok) {
					return removed;
				}
			}

			const count = await countUpvoteRows(skillId);
			if (!count.ok) {
				return count;
			}

			return ok({ upvoted, upvoteCount: count.value });
		},
	);

/** The created skill a caller gets back, including the slug the server chose. */
export type CreatedSkill = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	description: string;
	installUrl: string | undefined;
	authorId: string | undefined;
	tags: string[];
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
			tags: values.tags,
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
					tags: row.tags,
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
	visibility: SkillVisibility;
	/** Who performed the last hide or restore, or nothing when none was performed. */
	moderatedBy: string | undefined;
	moderatedAt: Date | undefined;
	/** The reason the current hide was made for, cleared by a restore. */
	reason: string | undefined;
};

/** One page of management cards, and whether a further page follows. */
export type ManagedSkillPage = {
	items: ManagedSkillCard[];
	hasMore: boolean;
};

/** One skill as the edit form reads it, ready to prefill the collected fields. */
export type MySkill = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	description: string;
	installUrl: string | undefined;
	tags: string[];
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
	tags: string[];
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
		tags: row.tags,
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
				tags: validated.value.tags,
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

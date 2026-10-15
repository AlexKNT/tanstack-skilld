import { auth } from "@clerk/tanstack-react-start/server";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import {
	listSkillRowsForModeration,
	type ModerationSkillRow,
	type SkillVisibilityChange,
	updateSkillVisibilityRow,
} from "#/db/queries";
import { fail, ok, type Result } from "#/db/result";
import type { SkillVisibility } from "#/db/schema";
import {
	loadAuthors,
	type SkillAuthor,
} from "#/features/skills/authors.server";
import { readIsAdmin } from "./role";
import {
	type ListSkillsForModerationInput,
	type ModerationFailureCode,
	type ModerationReadFailureCode,
	type SetSkillVisibilityInput,
	validateListSkillsForModerationInput,
	validateSetSkillVisibilityInput,
} from "./schema";

/** What one hide or restore left behind, as the interface reads it. */
export type VisibilityChange = SkillVisibilityChange;

/** The name shown for an actor Clerk no longer knows, so a row never fails. */
export const UNRESOLVED_ACTOR_NAME = "A former member";

/** One row of the admin list, with everyone's name resolved. */
export type ModerationItem = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	publisher: SkillAuthor | undefined;
	visibility: SkillVisibility;
	/** Who performed the last hide or restore, and what it was made for. */
	moderator: string | undefined;
	moderatedAt: Date | undefined;
	reason: string | undefined;
	createdAt: Date;
};

/** One page of the admin list, and whether a further page follows. */
export type ModerationPage = {
	items: ModerationItem[];
	hasMore: boolean;
};

/** The call one surface makes, with the parts the interface already knows. */
export type SetSkillVisibilityCall = {
	slug: string;
	visibility: SkillVisibility;
	reason?: string;
};

/**
 * Moves one skill to the visibility asked for.
 *
 * The actor is the session user id read on the server, so no payload can name
 * one, and whether the caller may act at all is decided inside the store's own
 * statement: the author of the row, or an admin, and nobody else. The role comes
 * from Clerk's public metadata, read for this request.
 *
 * Takes the state to reach rather than a direction, so a repeated or retried
 * call lands on one honest state, and a call that changes nothing reports that
 * rather than writing a fresh actor, time, and reason.
 */
export const setSkillVisibility = createServerFn({ method: "POST" })
	.inputValidator((input: SetSkillVisibilityInput) => input)
	.handler(
		async ({
			data,
		}): Promise<Result<VisibilityChange, ModerationFailureCode>> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return fail(
					"UNAUTHENTICATED",
					"Sign in to change a skill's visibility.",
				);
			}

			const validated = validateSetSkillVisibilityInput(data);

			if (!validated.ok) {
				return validated;
			}

			const { slug, visibility, reason } = validated.value;
			const isAdmin = await readIsAdmin(userId);

			return updateSkillVisibilityRow({
				slug,
				actorId: userId,
				visibility,
				reason,
				isAdmin,
			});
		},
	);

/**
 * The guard the admin route runs after the sign in guard.
 *
 * Reads the signed in person's role on the server and answers the app's not
 * found surface when it is not there, so the area's existence is not confirmed
 * to anyone else. Deliberately not a redirect: a signed in person who is not an
 * admin should not be told that an admin area exists.
 */
export const ensureAdmin = createServerFn({ method: "GET" }).handler(
	async (): Promise<undefined> => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId || !(await readIsAdmin(userId))) {
			throw notFound();
		}

		return undefined;
	},
);

/** Reads every skill whatever its visibility, for an admin. */
export const listSkillsForModeration = createServerFn({ method: "GET" })
	.inputValidator((input: ListSkillsForModerationInput | undefined) =>
		validateListSkillsForModerationInput(input ?? {}),
	)
	.handler(
		async ({
			data,
		}): Promise<Result<ModerationPage, ModerationReadFailureCode>> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return fail("UNAUTHENTICATED", "Sign in to review skills.");
			}

			// The role is read before anything is looked at, so a caller without
			// it learns nothing about what is stored, not even the page size.
			if (!(await readIsAdmin(userId))) {
				return fail("NOT_ALLOWED", "This page is for admins.");
			}

			if (!data.ok) {
				return data;
			}

			const { limit, offset, visibility } = data.value;
			const rows = await listSkillRowsForModeration(
				limit + 1,
				offset,
				visibility,
			);

			if (!rows.ok) {
				return rows;
			}

			const hasMore = rows.value.length > limit;
			const pageRows = hasMore ? rows.value.slice(0, limit) : rows.value;

			return ok({ items: await toModerationItems(pageRows), hasMore });
		},
	);

/**
 * Resolves the publishers and the moderators of a page in one batched Clerk
 * read. An id Clerk does not answer for is shown under one neutral label rather
 * than failing the row, because a departed moderator is not a broken skill.
 */
async function toModerationItems(
	rows: ModerationSkillRow[],
): Promise<ModerationItem[]> {
	const authors = await loadAuthors([
		...rows.map((row) => row.authorId),
		...rows.map((row) => row.moderatedBy),
	]);

	return rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		name: row.name,
		summary: row.summary,
		publisher:
			row.authorId === undefined ? undefined : authors.get(row.authorId),
		visibility: row.visibility,
		moderator:
			row.moderatedBy === undefined
				? undefined
				: (authors.get(row.moderatedBy)?.name ?? UNRESOLVED_ACTOR_NAME),
		moderatedAt: row.moderatedAt,
		reason: row.reason,
		createdAt: row.createdAt,
	}));
}

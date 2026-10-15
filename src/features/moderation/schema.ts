import { fail, ok, type Result } from "#/db/result";
import { SKILL_VISIBILITY_VALUES, type SkillVisibility } from "#/db/schema";
import {
	validateListSkillsInput,
	validateSkillDetailInput,
} from "#/features/skills/schema";

/** The most characters a hide's reason may hold, matching the store's rule. */
export const MAX_MODERATION_REASON_LENGTH = 200;

/**
 * The failure codes a moderation write can return, decided in spec 0009.
 *
 * `NOT_ALLOWED` is the one an author meets when they try to undo a hide an
 * admin made; `SKILL_NOT_FOUND` covers a missing skill and someone else's skill
 * alike, so a stranger is never told that a slug exists.
 */
export type ModerationFailureCode =
	| "UNAUTHENTICATED"
	| "VALIDATION_FAILED"
	| "NOT_ALLOWED"
	| "SKILL_NOT_FOUND"
	| "SKILLS_WRITE_FAILED";

/** The payload accepted by the `setSkillVisibility` server function. */
export type SetSkillVisibilityInput = {
	slug?: unknown;
	visibility?: unknown;
	reason?: unknown;
};

/** The call once every part is known good. */
export type ValidatedVisibilityInput = {
	slug: string;
	visibility: SkillVisibility;
	reason?: string;
};

/** What a caller is told when the state asked for is not one of the two stored. */
const VISIBILITY_MESSAGE = `Choose ${SKILL_VISIBILITY_VALUES.join(" or ")}.`;

/** What a caller is told when a reason breaks the store's rule. */
const REASON_MESSAGE = `A reason can be up to ${MAX_MODERATION_REASON_LENGTH} characters.`;

/** The two stored states, as a list a check can walk. */
function isVisibility(value: string): value is SkillVisibility {
	return SKILL_VISIBILITY_VALUES.some((allowed) => allowed === value);
}

/**
 * The reason a hide works with: trimmed, measured after trimming, or nothing at
 * all when the field was left empty, which both surfaces offer as optional.
 */
function asReason(
	value: unknown,
): Result<string | undefined, "VALIDATION_FAILED"> {
	if (value === undefined) {
		return ok(undefined);
	}

	if (typeof value !== "string") {
		return fail("VALIDATION_FAILED", REASON_MESSAGE, "reason");
	}

	const trimmed = value.trim();

	if (trimmed === "") {
		return ok(undefined);
	}

	if (trimmed.length > MAX_MODERATION_REASON_LENGTH) {
		return fail("VALIDATION_FAILED", REASON_MESSAGE, "reason");
	}

	return ok(trimmed);
}

/**
 * Validates a visibility write: the slug it addresses, the state to reach, and
 * the optional reason. Nothing here reads who is calling; that is the session's
 * job, and the authority rule lives in the store's own statement.
 */
export function validateSetSkillVisibilityInput(
	input: SetSkillVisibilityInput,
): Result<ValidatedVisibilityInput, "VALIDATION_FAILED"> {
	const slug = validateSkillDetailInput({ slug: input.slug });

	if (!slug.ok) {
		return slug;
	}

	const { visibility } = input;

	if (typeof visibility !== "string" || !isVisibility(visibility)) {
		return fail("VALIDATION_FAILED", VISIBILITY_MESSAGE, "visibility");
	}

	const reason = asReason(input.reason);

	if (!reason.ok) {
		return reason;
	}

	return ok({ slug: slug.value.slug, visibility, reason: reason.value });
}

/** The failure codes the admin list read can return, decided in spec 0009. */
export type ModerationReadFailureCode =
	| "UNAUTHENTICATED"
	| "NOT_ALLOWED"
	| "VALIDATION_FAILED"
	| "SKILLS_QUERY_FAILED";

/** The payload accepted by the `listSkillsForModeration` server function. */
export type ListSkillsForModerationInput = {
	limit?: unknown;
	offset?: unknown;
	visibility?: unknown;
};

/** The admin list read once every part is known good. */
export type ValidatedModerationListInput = {
	limit: number;
	offset: number;
	visibility?: SkillVisibility;
};

/**
 * The visibility an admin list was asked for, or nothing at all.
 *
 * A value that is not one of the two stored states is dropped rather than
 * refused, because the value comes straight from the address: an unreadable one
 * leaves the page showing every skill rather than failing it. Nothing that is
 * not a stored state ever reaches the store.
 */
function asVisibilityFilter(
	value: unknown,
): Result<SkillVisibility | undefined, "VALIDATION_FAILED"> {
	if (typeof value === "string" && isVisibility(value)) {
		return ok(value);
	}

	return ok(undefined);
}

/**
 * Applies the catalogue's page defaults to an admin list read, refuses a page
 * the caller could not have meant, and drops a visibility the store does not
 * hold.
 */
export function validateListSkillsForModerationInput(
	input: ListSkillsForModerationInput,
): Result<ValidatedModerationListInput, "VALIDATION_FAILED"> {
	const page = validateListSkillsInput({
		limit: input.limit,
		offset: input.offset,
	});

	if (!page.ok) {
		return page;
	}

	const visibility = asVisibilityFilter(input.visibility);

	if (!visibility.ok) {
		return visibility;
	}

	return ok({
		limit: page.value.limit,
		offset: page.value.offset,
		visibility: visibility.value,
	});
}

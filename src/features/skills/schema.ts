import { fail, ok, type Result } from "#/db/result";
import { hasSearchTerm, MAX_TERM_LENGTH } from "./search";
import { MAX_SLUG_LENGTH } from "./slug";
import {
	isStoredTag,
	normalizeTag,
	TAG_SHAPE_MESSAGE,
	validateTags,
} from "./tags";

/** The failure codes a skill write can return, decided in spec 0003. */
export type SkillFailureCode =
	| "UNAUTHENTICATED"
	| "VALIDATION_FAILED"
	| "SKILLS_WRITE_FAILED";

/**
 * The failure codes a skill read can return: spec 0003's two, plus the not
 * found case the catalogue's detail page needs to tell apart from a broken
 * read, decided in spec 0004.
 */
export type SkillReadFailureCode =
	| "VALIDATION_FAILED"
	| "SKILL_NOT_FOUND"
	| "SKILLS_QUERY_FAILED";

/** The payload accepted by the `createSkill` server function. */
export type CreateSkillInput = {
	name?: unknown;
	summary?: unknown;
	description?: unknown;
	installUrl?: unknown;
	tags?: unknown;
};

/** The payload `createSkill` works with once every field is known good. */
export type ValidatedSkillInput = {
	name: string;
	summary: string;
	description: string;
	installUrl?: string;
	tags: string[];
};

/** The page of skills a caller asked for, with the defaults already applied. */
export type ListSkillsInput = {
	limit?: unknown;
	offset?: unknown;
	term?: unknown;
	tag?: unknown;
};

/**
 * The page of skills `listSkills` works with once every value is known good.
 *
 * `term` and `tag` are the catalogue's filter: a term that holds nothing a
 * search could use is answered as no term at all rather than as a failure.
 */
export type ValidatedListInput = {
	limit: number;
	offset: number;
	term?: string;
	tag?: string;
};

/** The payload accepted by the `getSkillDetail` server function. */
export type SkillSlugInput = {
	slug?: unknown;
};

/** The payload accepted by the `updateSkill` server function. */
export type UpdateSkillInput = CreateSkillInput & {
	slug?: unknown;
};

/** The payload accepted by the `setUpvote` server function. */
export type SetUpvoteInput = {
	skillId?: unknown;
	upvoted?: unknown;
};

/**
 * The failure codes the vote write can return. The read that follows a write is
 * a second statement, so a store that breaks between the two answers with the
 * read failure rather than a made up count.
 */
export type UpvoteFailureCode =
	| "UNAUTHENTICATED"
	| "VALIDATION_FAILED"
	| "SKILL_NOT_FOUND"
	| "SKILLS_QUERY_FAILED"
	| "SKILLS_WRITE_FAILED";

/** The URL safe shape a skill slug must have, matching the database rule. */
const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The shape a stored skill's id has, so a malformed one never reaches the store. */
const SKILL_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The application's default page size, when the caller does not ask for one. */
export const DEFAULT_SKILL_LIMIT = 20;

/** The largest page a caller may ask for. */
export const MAX_SKILL_LIMIT = 100;

/** The longest a skill's name may be, matching the database rule. */
export const MAX_SKILL_NAME_LENGTH = 80;

/** The longest a skill's summary may be, matching the database rule. */
export const MAX_SKILL_SUMMARY_LENGTH = 200;

/** The longest a skill's description may be, enforced here rather than in the schema. */
export const MAX_SKILL_DESCRIPTION_LENGTH = 100_000;

const VALIDATION_MESSAGES: Record<string, string> = {
	name: "Give the skill a name of 80 characters or fewer.",
	summary: "Give the skill a one line summary of 200 characters or fewer.",
	description: "Give the skill a description of 100000 characters or fewer.",
	installUrl: "Give a web address that starts with http:// or https://.",
};

function validationFailure(field: string) {
	return fail(
		"VALIDATION_FAILED" as const,
		VALIDATION_MESSAGES[field] ?? "That value is not allowed.",
		field,
	);
}

function asTrimmedString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

/**
 * Accepts a value only when it is a well formed web address.
 *
 * A bare hostname ("example.com") is refused on purpose: the field is a link
 * someone clicks, so it has to carry a scheme.
 */
export function isWebAddress(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Checks a write payload and narrows it to known good values, or returns the
 * first problem with the field's name, so a form can put the message beside the
 * input that caused it.
 */
export function validateCreateSkillInput(
	input: CreateSkillInput,
): Result<ValidatedSkillInput, "VALIDATION_FAILED"> {
	const name = asTrimmedString(input.name);
	if (name === undefined) {
		return validationFailure("name");
	}
	if (name.length > MAX_SKILL_NAME_LENGTH) {
		return validationFailure("name");
	}

	const summary = asTrimmedString(input.summary);
	if (summary === undefined) {
		return validationFailure("summary");
	}
	if (summary.length > MAX_SKILL_SUMMARY_LENGTH) {
		return validationFailure("summary");
	}

	const description = asTrimmedString(input.description);
	if (description === undefined) {
		return validationFailure("description");
	}
	if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
		return validationFailure("description");
	}

	const installUrl = asTrimmedString(input.installUrl);
	if (installUrl !== undefined && !isWebAddress(installUrl)) {
		return validationFailure("installUrl");
	}

	const tags = validateTags(input.tags);
	if (!tags.ok) {
		return tags;
	}

	return ok({ name, summary, description, installUrl, tags: tags.value });
}

/**
 * Applies the page defaults and refuses values the caller could not have meant,
 * rather than quietly correcting them.
 */
export function validateListSkillsInput(
	input: ListSkillsInput,
): Result<ValidatedListInput, "VALIDATION_FAILED"> {
	const limit = input.limit ?? DEFAULT_SKILL_LIMIT;
	if (typeof limit !== "number" || !Number.isInteger(limit)) {
		return fail("VALIDATION_FAILED", "limit must be a whole number.", "limit");
	}
	if (limit < 0) {
		return fail("VALIDATION_FAILED", "limit cannot be negative.", "limit");
	}
	if (limit > MAX_SKILL_LIMIT) {
		return fail(
			"VALIDATION_FAILED",
			`limit cannot be more than ${MAX_SKILL_LIMIT}.`,
			"limit",
		);
	}

	const offset = input.offset ?? 0;
	if (typeof offset !== "number" || !Number.isInteger(offset)) {
		return fail(
			"VALIDATION_FAILED",
			"offset must be a whole number.",
			"offset",
		);
	}
	if (offset < 0) {
		return fail("VALIDATION_FAILED", "offset cannot be negative.", "offset");
	}

	const term = asFilterTerm(input.term);
	if (!term.ok) {
		return term;
	}

	const tag = asFilterTag(input.tag);
	if (!tag.ok) {
		return tag;
	}

	return ok({ limit, offset, term: term.value, tag: tag.value });
}

/**
 * The term a filtered read works with: trimmed and capped, or nothing at all
 * when the value holds no word a search could use. A value that is not text is
 * refused rather than ignored, because this read is public and a caller that
 * did not come through the address deserves a straight answer rather than a
 * silently widened page.
 */
function asFilterTerm(
	value: unknown,
): Result<string | undefined, "VALIDATION_FAILED"> {
	if (value === undefined) {
		return ok(undefined);
	}

	if (typeof value !== "string") {
		return fail("VALIDATION_FAILED", "term must be a search term.", "term");
	}

	const term = value.trim().slice(0, MAX_TERM_LENGTH);

	return ok(hasSearchTerm(term) ? term : undefined);
}

/**
 * The tag a filtered read works with: the stored form of the value, so a tag
 * written with capitals filters exactly as the lower case one does, or a
 * refusal when the value cannot be a tag at all.
 */
function asFilterTag(
	value: unknown,
): Result<string | undefined, "VALIDATION_FAILED"> {
	if (value === undefined) {
		return ok(undefined);
	}

	if (typeof value !== "string") {
		return fail("VALIDATION_FAILED", "tag must be a tag value.", "tag");
	}

	const tag = normalizeTag(value);

	if (!isStoredTag(tag)) {
		return fail("VALIDATION_FAILED", TAG_SHAPE_MESSAGE, "tag");
	}

	return ok(tag);
}

/**
 * Accepts the slug a detail page asks for, or returns the failure that keeps a
 * malformed address from reaching the store.
 */
export function validateSkillDetailInput(
	input: SkillSlugInput,
): Result<{ slug: string }, "VALIDATION_FAILED"> {
	const slug = asTrimmedString(input.slug);

	if (
		slug === undefined ||
		slug.length > MAX_SLUG_LENGTH ||
		!SKILL_SLUG_PATTERN.test(slug)
	) {
		return fail(
			"VALIDATION_FAILED",
			"That skill address is not valid.",
			"slug",
		);
	}

	return ok({ slug });
}

/**
 * Checks a vote payload: the skill it names and the state to reach. The state
 * to reach is asked for rather than the state held, so a repeated or raced call
 * cannot flip a vote the wrong way.
 */
export function validateSetUpvoteInput(
	input: SetUpvoteInput,
): Result<{ skillId: string; upvoted: boolean }, "VALIDATION_FAILED"> {
	const skillId = asTrimmedString(input.skillId);
	if (skillId === undefined || !SKILL_ID_PATTERN.test(skillId)) {
		return fail(
			"VALIDATION_FAILED",
			"That skill address is not valid.",
			"skillId",
		);
	}

	if (typeof input.upvoted !== "boolean") {
		return fail(
			"VALIDATION_FAILED",
			"An upvote has to say which state to reach.",
			"upvoted",
		);
	}

	return ok({ skillId, upvoted: input.upvoted });
}

/**
 * Checks an edit payload: the slug the skill is addressed by, plus the same four
 * fields publishing collects, validated by the same rules so the two forms
 * never drift.
 */
export function validateUpdateSkillInput(
	input: UpdateSkillInput,
): Result<{ slug: string } & ValidatedSkillInput, "VALIDATION_FAILED"> {
	const slug = validateSkillDetailInput(input);
	if (!slug.ok) {
		return slug;
	}

	const fields = validateCreateSkillInput(input);
	if (!fields.ok) {
		return fields;
	}

	return ok({ slug: slug.value.slug, ...fields.value });
}

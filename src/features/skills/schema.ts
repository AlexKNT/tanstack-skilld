import { fail, ok, type Result } from "#/db/result";

/** The failure codes a skill write can return, decided in spec 0003. */
export type SkillFailureCode =
	| "UNAUTHENTICATED"
	| "VALIDATION_FAILED"
	| "SKILLS_WRITE_FAILED";

/** The failure codes a skill read can return, decided in spec 0003. */
export type SkillsQueryFailureCode =
	| "VALIDATION_FAILED"
	| "SKILLS_QUERY_FAILED";

/** The payload accepted by the `createSkill` server function. */
export type CreateSkillInput = {
	name?: unknown;
	summary?: unknown;
	description?: unknown;
	installUrl?: unknown;
};

/** The payload `createSkill` works with once every field is known good. */
export type ValidatedSkillInput = {
	name: string;
	summary: string;
	description: string;
	installUrl?: string;
};

/** The page of skills a caller asked for, with the defaults already applied. */
export type ListSkillsInput = {
	limit?: unknown;
	offset?: unknown;
};

/** The page of skills `listSkills` works with once every value is known good. */
export type ValidatedListInput = {
	limit: number;
	offset: number;
};

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

	return ok({ name, summary, description, installUrl });
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

	return ok({ limit, offset });
}

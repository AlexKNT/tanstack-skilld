import { fail, ok, type Result } from "#/db/result";

/**
 * The tag rule, in one place.
 *
 * The store, the publish form and the edit form all run a tag through these
 * functions, so a tag can only ever mean one thing. The constants beside them
 * are what the database check and the field messages are both built from, so a
 * change to the rule lands in the store and in the copy together.
 */

/** The longest a stored tag may be, matching the database check. */
export const MAX_TAG_LENGTH = 24;

/** The most tags one skill may carry, matching the database check. */
export const MAX_TAGS_PER_SKILL = 5;

/** The shape a stored tag has, matching the database check. */
export const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What a form says when a typed tag cannot be stored. */
export const TAG_SHAPE_MESSAGE = `Use tags of ${MAX_TAG_LENGTH} characters or fewer, made of lowercase letters, digits and single dashes.`;

/** What a form says when too many tags arrive at once. */
export const TOO_MANY_TAGS_MESSAGE = `A skill can carry up to ${MAX_TAGS_PER_SKILL} tags.`;

/** What a form's tag control says about the values it accepts. */
export const TAG_FIELD_HINT = `Separate up to ${MAX_TAGS_PER_SKILL} tags with commas. Lowercase letters, digits and single dashes.`;

/**
 * Turns what an author typed into the stored form: trimmed, lowercased and with
 * each run of spaces joined into one dash. Anything else is left alone, so a
 * value that still breaks the shape is refused rather than quietly rewritten.
 */
export function normalizeTag(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Reports whether a normalized value is a tag the store accepts. */
export function isStoredTag(value: string): boolean {
	return value.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(value);
}

/**
 * The words a person reads for a tag, worked out here rather than stored, so a
 * label can never drift from its tag.
 */
export function formatTagLabel(tag: string): string {
	const words = tag.replace(/-/g, " ");

	return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Reads a comma separated tag field into the list a write sends.
 *
 * Empty entries are dropped, so a trailing comma is not treated as an empty tag
 * and refused. Everything else is left to the shared rule, which is the only
 * thing that decides whether a tag may be stored.
 */
export function parseTagList(value: string): string[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "");
}

/**
 * Checks a tag list from a form or a caller: normalizes each value, collapses
 * duplicates and keeps the list in alphabetical order.
 *
 * An absent list is a valid skill with no tags. A value that still breaks the
 * shape after normalizing, an empty entry, and a list longer than the ceiling
 * are each refused with the field name `tags`, the way the other fields refuse,
 * so a form can put the message beside the control.
 */
export function validateTags(
	input: unknown,
): Result<string[], "VALIDATION_FAILED"> {
	if (input === undefined) {
		return ok([]);
	}

	if (
		!Array.isArray(input) ||
		input.some((value) => typeof value !== "string")
	) {
		return fail(
			"VALIDATION_FAILED" as const,
			"Give the tags as a list of words.",
			"tags",
		);
	}

	const normalized = input.map((value) => normalizeTag(value));

	if (normalized.some((tag) => !isStoredTag(tag))) {
		return fail("VALIDATION_FAILED" as const, TAG_SHAPE_MESSAGE, "tags");
	}

	const unique = [...new Set(normalized)].sort();

	if (unique.length > MAX_TAGS_PER_SKILL) {
		return fail("VALIDATION_FAILED" as const, TOO_MANY_TAGS_MESSAGE, "tags");
	}

	return ok(unique);
}

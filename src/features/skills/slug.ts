/** The longest a slug may be, matching the database rule. */
export const MAX_SLUG_LENGTH = 60;

const SLUG_FALLBACK_PREFIX = "skill";
const DIGEST_LENGTH = 8;
const DIGEST_RADIX = 36;

/**
 * Folds a name into the characters a URL can carry: lowercase, letters and
 * digits, runs of anything else collapsed into a single separator.
 */
function slugifyName(name: string): string {
	return name
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

/**
 * A short, stable digest of the original name. Used only when the name has no
 * characters a URL can carry, so the slug still points at this skill rather
 * than at nothing.
 */
function digestOf(name: string): string {
	let hash = 5381;
	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 33 + name.charCodeAt(index)) >>> 0;
	}

	return hash.toString(DIGEST_RADIX);
}

/** Shortens a slug to the ceiling without leaving a trailing separator. */
function capLength(slug: string): string {
	if (slug.length <= MAX_SLUG_LENGTH) {
		return slug;
	}

	return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
}

/**
 * Derives a URL safe slug from a skill's name.
 *
 * Pure, so the server is the only place a slug is ever decided and two clients
 * cannot disagree about a URL. A name whose characters a URL cannot carry still
 * yields a usable slug, never an empty one.
 */
export function slugify(name: string): string {
	const base = capLength(slugifyName(name));

	if (base === "") {
		return `${SLUG_FALLBACK_PREFIX}-${digestOf(name).slice(0, DIGEST_LENGTH)}`;
	}

	return base;
}

/**
 * Adds a numeric suffix so a clashing slug can be stored instead of failing.
 * The first clash becomes `-2`, the second `-3`, matching a human's counting.
 */
export function slugWithSuffix(slug: string, attempt: number): string {
	if (attempt < 2) {
		return slug;
	}

	const suffix = `-${attempt}`;
	const room = MAX_SLUG_LENGTH - suffix.length;
	const trimmed = slug.slice(0, room).replace(/-+$/, "");

	return `${trimmed}${suffix}`;
}

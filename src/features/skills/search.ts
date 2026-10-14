/**
 * The one place a typed term becomes a store query.
 *
 * A search term is the only untrusted text in this codebase that reaches a
 * query language, so the whole defence lives here: the term is trimmed, capped,
 * split on anything that is not a letter or digit, and walked into a query made
 * only of those words. Nothing else in the feature is allowed to build one, and
 * the result is always passed to the store as a bound value rather than pasted
 * into a statement.
 */

/** The longest term kept, in characters. */
export const MAX_TERM_LENGTH = 100;

/** The most words one term contributes to the query. */
export const MAX_TERM_WORDS = 8;

/** The longest single word kept from a term. */
export const MAX_TERM_WORD_LENGTH = 40;

/**
 * Splits a term into the words a search may use: lowercase letters and digits
 * only, each capped, at most {@link MAX_TERM_WORDS} of them kept.
 */
export function termWords(term: string): string[] {
	return term
		.trim()
		.slice(0, MAX_TERM_LENGTH)
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((word) => word !== "")
		.slice(0, MAX_TERM_WORDS)
		.map((word) => word.slice(0, MAX_TERM_WORD_LENGTH));
}

/**
 * Turns a typed term into the stored query text, or nothing when the term holds
 * no usable word (whitespace, punctuation or an empty string).
 *
 * Each word becomes a prefix term, so a half typed word finds the whole one, and
 * the words are joined with `&` so every word has to hold. Because the words
 * hold only letters and digits, no input can add an operator or end a statement.
 */
export function buildSearchQuery(term: string): string | undefined {
	const words = termWords(term);

	if (words.length === 0) {
		return undefined;
	}

	return words.map((word) => `${word}:*`).join(" & ");
}

/** Reports whether a term holds anything a search could use. */
export function hasSearchTerm(term: string): boolean {
	return termWords(term).length > 0;
}

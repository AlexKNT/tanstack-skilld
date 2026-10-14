import type { CatalogueFilter } from "./data";
import { MAX_TERM_LENGTH } from "./search";
import { isStoredTag, normalizeTag } from "./tags";

/**
 * The catalogue's filter as the address holds it.
 *
 * The address is the single source of truth for what is filtered: the route
 * validates what arrives in it, and nothing else in the page keeps a filter
 * value of its own.
 */
export type CatalogueSearch = {
	q?: string;
	tag?: string;
};

/**
 * Reads the filter out of an address, dropping anything that cannot be one.
 *
 * An address is not a form, so a value that fails validation is repaired rather
 * than refused: a stale or hand edited link still renders a page. A tag is put
 * through the shared rule before it is compared, so a tag written with capitals
 * filters exactly as the lower case one does.
 */
export function validateCatalogueSearch(
	search: Record<string, unknown>,
): CatalogueSearch {
	const q =
		typeof search.q === "string"
			? search.q.trim().slice(0, MAX_TERM_LENGTH)
			: "";
	const tag = typeof search.tag === "string" ? normalizeTag(search.tag) : "";

	return {
		q: q === "" ? undefined : q,
		tag: isStoredTag(tag) ? tag : undefined,
	};
}

/** The filter the catalogue read takes, built from the validated address. */
export function searchToFilter(search: CatalogueSearch): CatalogueFilter {
	return { term: search.q, tag: search.tag };
}

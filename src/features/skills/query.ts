import {
	infiniteQueryOptions,
	keepPreviousData,
	queryOptions,
} from "@tanstack/react-query";

import {
	type CatalogueFilter,
	getSkillDetail,
	listSkillCards,
	listSkillTags,
} from "./data";

/** How many cards one page of the catalogue holds. */
export const SKILLS_PAGE_SIZE = 20;

/** How long the client treats a page as fresh before it revalidates. */
export const SKILLS_STALE_TIME_MS = 30_000;

/** The viewer segment of a key when nobody is signed in. */
const SIGNED_OUT_SEGMENT = "signed-out";

/**
 * One person's segment of a query key.
 *
 * Every read that answers per viewer carries this, so a page built for one
 * person can never be handed to another, and signing in or out moves the reads
 * to their own keys rather than reusing the previous person's data.
 */
function viewerSegment(viewerId: string | undefined): string {
	return viewerId ?? SIGNED_OUT_SEGMENT;
}

/**
 * The filter's segment of a catalogue key.
 *
 * The filter goes last, after the viewer segment, so the key shape holds
 * whether or not the viewer is signed in, and the unfiltered catalogue keeps a
 * key of its own: applying a filter and clearing it again does not throw the
 * home page's cached first page away. An absent value drops out of the object,
 * so the unfiltered key is the same key however it is reached.
 */
function filterSegment(filter: CatalogueFilter): CatalogueFilter {
	return filter.term === undefined && filter.tag === undefined
		? {}
		: { term: filter.term, tag: filter.tag };
}

/** The catalogue's query keys, so the loader and the client ask for one thing. */
export const skillKeys = {
	all: ["skills"] as const,
	/** Every catalogue page for one viewer, whatever filter each was read with. */
	cardsFamily: (viewerId: string | undefined) =>
		[...skillKeys.all, "cards", viewerSegment(viewerId)] as const,
	/** One filtered catalogue page for one viewer. */
	cards: (viewerId: string | undefined, filter: CatalogueFilter) =>
		[...skillKeys.cardsFamily(viewerId), filterSegment(filter)] as const,
	detail: (slug: string, viewerId: string | undefined) =>
		[...skillKeys.all, "detail", slug, viewerSegment(viewerId)] as const,
	tags: () => [...skillKeys.all, "tags"] as const,
};

/**
 * The paged catalogue read, shared by the home route loader and the client.
 *
 * The loader seeds this exact key on the server, so the first page is in the
 * HTML and the client never fetches it a second time. The viewer is part of the
 * key, so the loader and the component have to agree on it, which they do by
 * reading the same root route value; the filter is part of it too, so each
 * filter has its own cached page and a filtered view is never served as an
 * unfiltered one.
 *
 * The previous page set is kept as placeholder data, so settling a filter
 * leaves the results on screen while the next read is in flight instead of
 * blanking the grid.
 *
 * `refetchOnMount: "always"` is what makes the spec's "revalidates on revisit"
 * true: TanStack Start's SSR query integration hydrates this key for the client,
 * so without a refetch trigger a freshly published skill would stay hidden for
 * the whole stale time. `staleTime` still governs when an existing page is
 * considered stale, so background refetches and invalidation keep their
 * meaning.
 */
export function skillCardsQueryOptions(
	viewerId: string | undefined,
	filter: CatalogueFilter,
) {
	return infiniteQueryOptions({
		queryKey: skillKeys.cards(viewerId, filter),
		queryFn: ({ pageParam }) =>
			listSkillCards({
				data: {
					limit: SKILLS_PAGE_SIZE,
					offset: pageParam,
					term: filter.term,
					tag: filter.tag,
				},
			}),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage.ok || !lastPage.value.hasMore) {
				return undefined;
			}

			return allPages.reduce(
				(offset, page) => offset + (page.ok ? page.value.items.length : 0),
				0,
			);
		},
		placeholderData: keepPreviousData,
		staleTime: SKILLS_STALE_TIME_MS,
		refetchOnMount: "always",
	});
}

/**
 * The tags in use, for the catalogue's chip row.
 *
 * The loader seeds this too, so the row is in the server rendered HTML rather
 * than appearing a moment after the grid. A write to a skill invalidates the
 * whole `skills` key family, so a tag that has just been used, or renamed,
 * reaches the row.
 */
export function skillTagsQueryOptions() {
	return queryOptions({
		queryKey: skillKeys.tags(),
		queryFn: () => listSkillTags(),
		staleTime: SKILLS_STALE_TIME_MS,
		refetchOnMount: "always",
	});
}

/** The single skill read, shared by the detail route loader and the client. */
export function skillDetailQueryOptions(
	slug: string,
	viewerId: string | undefined,
) {
	return queryOptions({
		queryKey: skillKeys.detail(slug, viewerId),
		queryFn: () => getSkillDetail({ data: { slug } }),
		staleTime: SKILLS_STALE_TIME_MS,
	});
}

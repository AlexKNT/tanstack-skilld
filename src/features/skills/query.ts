import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { getSkillDetail, listSkillCards } from "./data";

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

/** The catalogue's query keys, so the loader and the client ask for one thing. */
export const skillKeys = {
	all: ["skills"] as const,
	cards: (viewerId: string | undefined) =>
		[...skillKeys.all, "cards", viewerSegment(viewerId)] as const,
	detail: (slug: string, viewerId: string | undefined) =>
		[...skillKeys.all, "detail", slug, viewerSegment(viewerId)] as const,
};

/**
 * The paged catalogue read, shared by the home route loader and the client.
 *
 * The loader seeds this exact key on the server, so the first page is in the
 * HTML and the client never fetches it a second time. The viewer is part of the
 * key, so the loader and the component have to agree on it, which they do by
 * reading the same root route value.
 *
 * `refetchOnMount: "always"` is what makes the spec's "revalidates on revisit"
 * true: TanStack Start's SSR query integration hydrates this key for the client,
 * so without a refetch trigger a freshly published skill would stay hidden for
 * the whole stale time. `staleTime` still governs when an existing page is
 * considered stale, so background refetches and invalidation keep their
 * meaning.
 */
export function skillCardsQueryOptions(viewerId: string | undefined) {
	return infiniteQueryOptions({
		queryKey: skillKeys.cards(viewerId),
		queryFn: ({ pageParam }) =>
			listSkillCards({ data: { limit: SKILLS_PAGE_SIZE, offset: pageParam } }),
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

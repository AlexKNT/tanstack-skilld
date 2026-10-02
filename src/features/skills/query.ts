import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { getSkillDetail, listSkillCards } from "./data";

/** How many cards one page of the catalogue holds. */
export const SKILLS_PAGE_SIZE = 20;

/** How long the client treats a page as fresh before it revalidates. */
export const SKILLS_STALE_TIME_MS = 30_000;

/** The catalogue's query keys, so the loader and the client ask for one thing. */
export const skillKeys = {
	all: ["skills"] as const,
	cards: () => [...skillKeys.all, "cards"] as const,
	detail: (slug: string) => [...skillKeys.all, "detail", slug] as const,
};

/**
 * The paged catalogue read, shared by the home route loader and the client.
 *
 * The loader seeds this exact key on the server, so the first page is in the
 * HTML and the client never fetches it a second time.
 *
 * `refetchOnMount: "always"` is what makes the spec's "revalidates on revisit"
 * true: TanStack Start's SSR query integration hydrates this key for the client,
 * so without a refetch trigger a freshly published skill would stay hidden for
 * the whole stale time. `staleTime` still governs when an existing page is
 * considered stale, so background refetches and invalidation keep their
 * meaning.
 */
export function skillCardsQueryOptions() {
	return infiniteQueryOptions({
		queryKey: skillKeys.cards(),
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
export function skillDetailQueryOptions(slug: string) {
	return queryOptions({
		queryKey: skillKeys.detail(slug),
		queryFn: () => getSkillDetail({ data: { slug } }),
		staleTime: SKILLS_STALE_TIME_MS,
	});
}

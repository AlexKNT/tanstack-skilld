import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { getMySkill, listMySkillCards } from "#/features/skills/data";
import { SKILLS_STALE_TIME_MS } from "#/features/skills/query";
import { getAccountOverview } from "./data";

/** How many management cards one page of the area's list holds. */
export const ACCOUNT_PAGE_SIZE = 20;

/** The area's query keys, so every read and every invalidation agree. */
export const mySkillKeys = {
	all: ["my-skills"] as const,
	list: () => [...mySkillKeys.all, "list"] as const,
	detail: (slug: string) => [...mySkillKeys.all, "detail", slug] as const,
	overview: () => [...mySkillKeys.all, "overview"] as const,
};

/**
 * The paged read of the signed in user's own skills.
 *
 * `refetchOnMount: "always"` matches the catalogue: the loader seeds the key on
 * the server, so without a refetch trigger a revisit would show whatever the
 * server rendered until the stale time lapsed.
 */
export function mySkillCardsQueryOptions() {
	return infiniteQueryOptions({
		queryKey: mySkillKeys.list(),
		queryFn: ({ pageParam }) =>
			listMySkillCards({
				data: { limit: ACCOUNT_PAGE_SIZE, offset: pageParam },
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
		staleTime: SKILLS_STALE_TIME_MS,
		refetchOnMount: "always",
	});
}

/** One of the signed in user's own skills, for the edit form. */
export function mySkillDetailQueryOptions(slug: string) {
	return queryOptions({
		queryKey: mySkillKeys.detail(slug),
		queryFn: () => getMySkill({ data: { slug } }),
		staleTime: SKILLS_STALE_TIME_MS,
	});
}

/** The identity and skill count shown on the overview. */
export function accountOverviewQueryOptions() {
	return queryOptions({
		queryKey: mySkillKeys.overview(),
		queryFn: () => getAccountOverview(),
		staleTime: SKILLS_STALE_TIME_MS,
	});
}

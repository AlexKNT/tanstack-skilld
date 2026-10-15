import { infiniteQueryOptions, type QueryClient } from "@tanstack/react-query";

import type { SkillVisibility } from "#/db/schema";
import { ACCOUNT_PAGE_SIZE, mySkillKeys } from "#/features/account/query";
import { SKILLS_STALE_TIME_MS, skillKeys } from "#/features/skills/query";
import { listSkillsForModeration } from "./data";

/** How many rows one page of the admin list holds, the catalogue's own size. */
export const MODERATION_PAGE_SIZE = ACCOUNT_PAGE_SIZE;

/** The admin area's query keys, so every read and settling agree. */
export const moderationKeys = {
	all: ["moderation"] as const,
	/** One page family per filter, since each holds a different set of skills. */
	list: (visibility: SkillVisibility | undefined) =>
		[...moderationKeys.all, "list", visibility ?? "every"] as const,
};

/**
 * The paged read of every skill, whatever its visibility, optionally narrowed
 * to one state.
 *
 * `refetchOnMount: "always"` matches the catalogue: the loader seeds the key on
 * the server, so without a refetch trigger a revisit would show whatever the
 * server rendered until the stale time lapsed. The filter is part of the key,
 * so each view keeps its own page and a filtered list is never served as an
 * unfiltered one.
 */
export function moderationSkillsQueryOptions(
	visibility: SkillVisibility | undefined,
) {
	return infiniteQueryOptions({
		queryKey: moderationKeys.list(visibility),
		queryFn: ({ pageParam }) =>
			listSkillsForModeration({
				data: {
					limit: MODERATION_PAGE_SIZE,
					offset: pageParam,
					visibility,
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
		staleTime: SKILLS_STALE_TIME_MS,
		refetchOnMount: "always",
	});
}

/**
 * Settles every read a hide or a restore can make stale.
 *
 * One key factory per surface, each invalidated by prefix, so the catalogue's
 * pages, the skill's own page, the author's own list and count, and the admin
 * list all read again from the store.
 *
 * Awaiting the reads is the point rather than a nicety: the acting person
 * should see a hidden skill gone, or a restored one back, before the interface
 * settles on the answer.
 */
export async function settleVisibilityReads(
	queryClient: QueryClient,
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: skillKeys.all }),
		queryClient.invalidateQueries({ queryKey: mySkillKeys.all }),
		queryClient.invalidateQueries({ queryKey: moderationKeys.all }),
	]);
}

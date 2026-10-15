import type { QueryClient } from "@tanstack/react-query";

import { mySkillKeys } from "#/features/account/query";
import { skillKeys } from "#/features/skills/query";

/**
 * Settles every read a hide or a restore can make stale.
 *
 * One key factory per surface, each invalidated by prefix, so the catalogue's
 * pages and the skill's own page read again from the store. The author's own
 * list and count come from `mySkillKeys`, and the admin list joins them here
 * once that area exists.
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
	]);
}

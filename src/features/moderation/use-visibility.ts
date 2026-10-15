import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Result } from "#/db/result";
import {
	type SetSkillVisibilityCall,
	setSkillVisibility,
	type VisibilityChange,
} from "./data";
import { settleVisibilityReads } from "./query";
import type { ModerationFailureCode } from "./schema";

/**
 * The one client path that hides or restores a skill.
 *
 * Both surfaces call this rather than the server function directly, so settling
 * the reads happens in one place and the author's card and the admin list
 * cannot drift into settling different things.
 */
export function useSetVisibility() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			call: SetSkillVisibilityCall,
		): Promise<Result<VisibilityChange, ModerationFailureCode>> =>
			setSkillVisibility({ data: call }),
		onSuccess: async (result) => {
			if (!result.ok) {
				return;
			}

			await settleVisibilityReads(queryClient);
		},
	});
}

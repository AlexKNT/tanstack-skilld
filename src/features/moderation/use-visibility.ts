import { usePostHog } from "@posthog/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Result } from "#/db/result";
import {
	type SetSkillVisibilityCall,
	setSkillVisibility,
	type VisibilityChange,
} from "./data";
import { settleVisibilityReads } from "./query";
import type { ModerationFailureCode } from "./schema";

/** The event every state change is reported as, named once. */
export const VISIBILITY_EVENT = "skill_visibility_changed";

/**
 * Whether the person acting was the skill's own author or an admin.
 *
 * An admin acting on their own skill counts as the author: the distinction the
 * event carries is about whose work is being judged, not about which surface
 * the control was pressed on.
 */
export type ModerationActorRole = "author" | "admin";

/** One call to the shared path, with the part only the surface knows. */
export type SetVisibilityCall = SetSkillVisibilityCall & {
	actorRole: ModerationActorRole;
};

/**
 * The one client path that hides or restores a skill.
 *
 * Both surfaces call this rather than the server function directly, so settling
 * the reads and capturing the event happen in one place and the author's card
 * and the admin list cannot drift apart. The event is captured here and nowhere
 * else, only after the store has confirmed the state actually changed, so a
 * repeat, a refusal, or a retried call reports nothing at all.
 */
export function useSetVisibility() {
	const queryClient = useQueryClient();
	const posthog = usePostHog();

	return useMutation({
		mutationFn: (
			call: SetVisibilityCall,
		): Promise<Result<VisibilityChange, ModerationFailureCode>> =>
			setSkillVisibility({
				data: {
					slug: call.slug,
					visibility: call.visibility,
					reason: call.reason,
				},
			}),
		onSuccess: async (result, call) => {
			if (!result.ok) {
				return;
			}

			if (result.value.changed) {
				posthog.capture(VISIBILITY_EVENT, {
					slug: call.slug,
					visibility: result.value.visibility,
					actor_role: call.actorRole,
					has_reason: call.reason !== undefined,
				});
			}

			await settleVisibilityReads(queryClient);
		},
	});
}

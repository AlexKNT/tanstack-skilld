import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import {
	type SkillVisibilityChange,
	updateSkillVisibilityRow,
} from "#/db/queries";
import { fail, type Result } from "#/db/result";
import type { SkillVisibility } from "#/db/schema";
import { readIsAdmin } from "./role";
import {
	type ModerationFailureCode,
	type SetSkillVisibilityInput,
	validateSetSkillVisibilityInput,
} from "./schema";

/** What one hide or restore left behind, as the interface reads it. */
export type VisibilityChange = SkillVisibilityChange;

/** The call one surface makes, with the parts the interface already knows. */
export type SetSkillVisibilityCall = {
	slug: string;
	visibility: SkillVisibility;
	reason?: string;
};

/**
 * Moves one skill to the visibility asked for.
 *
 * The actor is the session user id read on the server, so no payload can name
 * one, and whether the caller may act at all is decided inside the store's own
 * statement: the author of the row, or an admin, and nobody else. The role comes
 * from Clerk's public metadata, read for this request.
 *
 * Takes the state to reach rather than a direction, so a repeated or retried
 * call lands on one honest state, and a call that changes nothing reports that
 * rather than writing a fresh actor, time, and reason.
 */
export const setSkillVisibility = createServerFn({ method: "POST" })
	.inputValidator((input: SetSkillVisibilityInput) => input)
	.handler(
		async ({
			data,
		}): Promise<Result<VisibilityChange, ModerationFailureCode>> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return fail(
					"UNAUTHENTICATED",
					"Sign in to change a skill's visibility.",
				);
			}

			const validated = validateSetSkillVisibilityInput(data);

			if (!validated.ok) {
				return validated;
			}

			const { slug, visibility, reason } = validated.value;
			const isAdmin = await readIsAdmin(userId);

			return updateSkillVisibilityRow({
				slug,
				actorId: userId,
				visibility,
				reason,
				isAdmin,
			});
		},
	);

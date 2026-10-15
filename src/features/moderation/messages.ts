import type { Failure } from "#/db/result";
import {
	MAX_MODERATION_REASON_LENGTH,
	type ModerationFailureCode,
} from "./schema";

/**
 * The one place a moderation refusal is put into words.
 *
 * Both surfaces open the same dialog, and the dialog reads its copy from here,
 * so the same refusal can never read two ways. The store's own message is what
 * a caller gets back from the server function; this map is what a person reads,
 * which is why the codes are listed exhaustively rather than fallen through.
 */
export const MODERATION_FAILURE_MESSAGES: Record<
	ModerationFailureCode,
	string
> = {
	UNAUTHENTICATED: "Sign in again, then try that once more.",
	VALIDATION_FAILED: `A reason can be up to ${MAX_MODERATION_REASON_LENGTH} characters.`,
	NOT_ALLOWED:
		"Only an admin can restore a skill they hid, so ask one to bring it back.",
	SKILL_NOT_FOUND: "That skill is no longer yours to change.",
	SKILLS_WRITE_FAILED: "That change could not be saved. Try again in a moment.",
};

/** The sentence a person reads for a refusal, whichever code came back. */
export function moderationFailureMessage(failure: Failure): string {
	return isModerationFailureCode(failure.code)
		? MODERATION_FAILURE_MESSAGES[failure.code]
		: failure.message;
}

/** Whether a code is one this map has wording for. */
function isModerationFailureCode(code: string): code is ModerationFailureCode {
	return Object.hasOwn(MODERATION_FAILURE_MESSAGES, code);
}

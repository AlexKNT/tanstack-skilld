/** The cookie the analytics answer lives in. Not `httpOnly`: the browser applies a change at once. */
export const CONSENT_COOKIE = "cookie-consent";

/** The only two values the cookie may hold. */
export const CONSENT_VALUES = ["granted", "denied"] as const;

/** The visitor's analytics answer. `undefined` means they have not answered. */
export type ConsentChoice = (typeof CONSENT_VALUES)[number];

/** Six months, in seconds, for the cookie's `Max-Age`. */
export const CONSENT_COOKIE_MAX_AGE = 15_552_000;

/**
 * Narrows an unknown cookie value to one of the two allowed answers.
 *
 * The cookie is client writable, so anything that is not one of the two words
 * reads as no answer, which is the same state a first time visitor is in.
 */
export function isConsentChoice(value: unknown): value is ConsentChoice {
	return (
		typeof value === "string" &&
		(CONSENT_VALUES as readonly string[]).includes(value)
	);
}

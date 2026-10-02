/**
 * The one formatter for a skill's added date.
 *
 * Pinned to a locale and to UTC, so the server and the browser produce exactly
 * the same characters and hydration stays clean.
 */
const SKILL_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

/** Renders a skill's added date as one deterministic string, e.g. `2 Oct 2026`. */
export function formatSkillDate(date: Date): string {
	return SKILL_DATE_FORMAT.format(date);
}

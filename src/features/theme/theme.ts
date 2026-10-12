/** The cookie the theme choice lives in. Not `httpOnly`: the browser applies a change at once. */
export const THEME_COOKIE = "theme";

/** The only three values the cookie may hold. */
export const THEME_VALUES = ["system", "light", "dark"] as const;

/** The visitor's theme choice: follow the device, or force light or dark. */
export type ThemeChoice = (typeof THEME_VALUES)[number];

/** What an absent or unknown cookie resolves to. */
export const DEFAULT_THEME: ThemeChoice = "system";

/** One year, in seconds, for the cookie's `Max-Age`. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const THEME_LABELS: Record<ThemeChoice, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

/** Narrows an unknown cookie value to one of the three allowed choices. */
export function isThemeChoice(value: unknown): value is ThemeChoice {
	return (
		typeof value === "string" &&
		(THEME_VALUES as readonly string[]).includes(value)
	);
}

/** The label a control shows for a choice. */
export function themeLabel(choice: ThemeChoice): string {
	return THEME_LABELS[choice];
}

/** The choice a cycle control moves to next: system to light to dark, and back. */
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
	if (choice === "system") {
		return "light";
	}

	return choice === "light" ? "dark" : "system";
}

/**
 * The inline script that applies the resolved theme before the first paint.
 *
 * It reads the cookie itself, falls back to the device preference for the
 * system choice, and toggles the `dark` class on the root element. Kept as
 * plain ES5 in one statement so it cannot fail on an older browser or a
 * Content Security Policy that allows hashes.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);var c=m?decodeURIComponent(m[1]):"system";if(c!=="light"&&c!=="dark"){c=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",c==="dark")}catch(e){}})();`;

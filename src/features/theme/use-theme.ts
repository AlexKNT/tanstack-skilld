import { createContext, useContext, useSyncExternalStore } from "react";

import {
	DEFAULT_THEME,
	isThemeChoice,
	THEME_COOKIE,
	THEME_COOKIE_MAX_AGE,
	type ThemeChoice,
} from "./theme";

const listeners = new Set<() => void>();
let cached: ThemeChoice | undefined;

/** The choice the server resolved, so an SSR render and its hydration agree. */
export const ThemeChoiceContext = createContext<ThemeChoice>(DEFAULT_THEME);

function readCookieChoice(): ThemeChoice {
	if (typeof document === "undefined") {
		return DEFAULT_THEME;
	}

	const match = document.cookie.match(/(?:^|; )theme=([^;]+)/);
	const value = match === null ? undefined : decodeURIComponent(match[1]);

	return isThemeChoice(value) ? value : DEFAULT_THEME;
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getChoiceSnapshot(): ThemeChoice {
	cached ??= readCookieChoice();
	return cached;
}

/** What the device preference resolves to, defaulting to light off the browser. */
function systemResolvedChoice(): "light" | "dark" {
	if (typeof window === "undefined" || !window.matchMedia) {
		return "light";
	}

	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

/** Applies the resolved theme to the root element straight away. */
export function applyThemeChoice(choice: ThemeChoice): void {
	if (typeof document === "undefined") {
		return;
	}

	const resolved = choice === "system" ? systemResolvedChoice() : choice;
	document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Writes the choice to the cookie the server reads, applies it to the root
 * element at once (no round trip, no reload), and tells every control.
 */
export function setThemeChoice(choice: ThemeChoice): void {
	cached = choice;

	if (typeof document !== "undefined") {
		// biome-ignore lint/suspicious/noDocumentCookie: the browser must apply a theme change at once, and no client cookie setter is available.
		document.cookie = `${THEME_COOKIE}=${choice}; Path=/; SameSite=Lax; Max-Age=${THEME_COOKIE_MAX_AGE}`;
		applyThemeChoice(choice);
	}

	for (const listener of listeners) {
		listener();
	}
}

/** The current choice, kept in step with every other control on the page. */
export function useThemeChoice(): {
	choice: ThemeChoice;
	setChoice: (choice: ThemeChoice) => void;
} {
	const serverChoice = useContext(ThemeChoiceContext);
	const choice = useSyncExternalStore(
		subscribe,
		getChoiceSnapshot,
		() => serverChoice,
	);

	return { choice, setChoice: setThemeChoice };
}

/**
 * The `dark` class the root element should carry, or `undefined` for light.
 *
 * On the server this follows the choice the router resolved (so an explicit
 * light or dark renders correctly with no flash); on the client the cookie and
 * the device preference decide, and a change re-renders the root at once.
 */
export function useThemeClassName(
	serverChoice: ThemeChoice,
): string | undefined {
	const choice = useSyncExternalStore(
		subscribe,
		getChoiceSnapshot,
		() => serverChoice,
	);
	const resolved = choice === "system" ? systemResolvedChoice() : choice;

	return resolved === "dark" ? "dark" : undefined;
}

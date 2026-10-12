import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import {
	DEFAULT_THEME,
	isThemeChoice,
	THEME_COOKIE,
	type ThemeChoice,
} from "./theme";

/**
 * Reads the theme cookie on the server.
 *
 * The cookie is deliberately not `httpOnly` (the browser applies a change
 * without a round trip), so it is treated as untrusted: anything that is not
 * one of the three allowed values falls back to `system`. Because the read
 * happens while the document is rendered, the first paint already carries the
 * right theme for the light and dark choices.
 */
export const readThemeChoice = createServerFn({ method: "GET" }).handler(
	async (): Promise<ThemeChoice> => {
		const value = getCookie(THEME_COOKIE);
		return isThemeChoice(value) ? value : DEFAULT_THEME;
	},
);

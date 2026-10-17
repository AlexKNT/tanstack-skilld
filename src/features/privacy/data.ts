import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { CONSENT_COOKIE, type ConsentChoice, isConsentChoice } from "./consent";

/**
 * Reads the analytics answer on the server.
 *
 * The cookie is written by the browser, so it is treated as untrusted: a
 * missing value, a forged value, or an expired cookie all resolve to
 * `undefined`, which is the same state as a visitor who has not answered.
 * Because the read happens while the document is rendered, a returning visitor
 * never sees the banner flash.
 */
export const readConsentChoice = createServerFn({ method: "GET" }).handler(
	async (): Promise<ConsentChoice | undefined> => {
		const value = getCookie(CONSENT_COOKIE);
		return isConsentChoice(value) ? value : undefined;
	},
);

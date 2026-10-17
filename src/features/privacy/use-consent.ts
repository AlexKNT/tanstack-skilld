import { usePostHog } from "@posthog/react";
import type { PostHog } from "posthog-js";
import { createContext, useContext, useSyncExternalStore } from "react";

import {
	CONSENT_COOKIE,
	CONSENT_COOKIE_MAX_AGE,
	type ConsentChoice,
	isConsentChoice,
} from "./consent";

const listeners = new Set<() => void>();
let cached: ConsentChoice | undefined;
let hasRead = false;

/** The answer the server resolved, so a render and its hydration agree. */
export const ConsentChoiceContext = createContext<ConsentChoice | undefined>(
	undefined,
);

/** Reads the cookie in the browser, treating anything unrecognised as no answer. */
function readCookieChoice(): ConsentChoice | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}

	const match = document.cookie.match(
		new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`),
	);

	if (match === null) {
		return undefined;
	}

	try {
		const value = decodeURIComponent(match[1]);
		return isConsentChoice(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getChoiceSnapshot(): ConsentChoice | undefined {
	if (!hasRead) {
		cached = readCookieChoice();
		hasRead = true;
	}

	return cached;
}

function notifyListeners(): void {
	for (const listener of listeners) {
		listener();
	}
}

/**
 * The cookie attributes every write and the clear share.
 *
 * `Secure` is added only where the page is already served over https, so a
 * local development server over http still accepts the write.
 */
function cookieAttributes(): string {
	const secure =
		typeof window !== "undefined" && window.location.protocol === "https:"
			? "; Secure"
			: "";

	return `; Path=/; SameSite=Lax${secure}`;
}

/**
 * Writes the answer to the cookie the server reads and tells every control.
 *
 * The write goes through `document.cookie` so the choice applies at once with
 * no round trip and no reload.
 */
export function writeConsentChoice(choice: ConsentChoice): void {
	cached = choice;
	hasRead = true;

	if (typeof document !== "undefined") {
		// biome-ignore lint/suspicious/noDocumentCookie: the browser must apply a consent change at once, and no client cookie setter is available.
		document.cookie = `${CONSENT_COOKIE}=${choice}${cookieAttributes()}; Max-Age=${CONSENT_COOKIE_MAX_AGE}`;
	}

	notifyListeners();
}

/**
 * Clears the stored answer with the same attributes it was written with.
 *
 * The next choice, in either direction, then applies to a visitor who has not
 * answered, which is what reopens the banner.
 */
export function clearConsentChoice(): void {
	cached = undefined;
	hasRead = true;

	if (typeof document !== "undefined") {
		// biome-ignore lint/suspicious/noDocumentCookie: the answer must be cleared at once, and no client cookie setter is available.
		document.cookie = `${CONSENT_COOKIE}=${cookieAttributes()}; Max-Age=0`;
	}

	notifyListeners();
}

/**
 * The current answer on the client, with the server's answer as the snapshot
 * used while rendering on the server and during hydration.
 */
export function useConsentSnapshot(
	serverChoice: ConsentChoice | undefined,
): ConsentChoice | undefined {
	return useSyncExternalStore(subscribe, getChoiceSnapshot, () => serverChoice);
}

/**
 * Accepting turns capture on, relaxes the two gates that were held closed, and
 * starts exception reporting once. It runs after the cookie is written, so a
 * reload during the same click already carries the answer.
 */
function acceptAnalytics(instance: PostHog): void {
	writeConsentChoice("granted");
	instance.opt_in_capturing();
	instance.set_config({
		opt_out_persistence_by_default: false,
		disable_external_dependency_loading: false,
	});
	instance.startExceptionAutocapture();
}

/** Declining writes the answer, then clears PostHog's own consent and identity. */
function declineAnalytics(instance: PostHog): void {
	writeConsentChoice("denied");
	instance.reset();
	instance.opt_out_capturing();
}

/** The footer control: forget the answer and put PostHog back to its closed state. */
function resetConsent(instance: PostHog): void {
	clearConsentChoice();
	instance.reset();
	instance.opt_out_capturing();
}

/**
 * The answer every control reads, plus the three ways it can change.
 *
 * The banner, the footer control, and the analytics gate all read one snapshot,
 * so an answer applies in both directions without a reload.
 */
export function useConsentChoice(): {
	choice: ConsentChoice | undefined;
	accept: () => void;
	decline: () => void;
	clear: () => void;
} {
	const posthog = usePostHog();
	const serverChoice = useContext(ConsentChoiceContext);
	const choice = useConsentSnapshot(serverChoice);

	return {
		choice,
		accept: () => acceptAnalytics(posthog),
		decline: () => declineAnalytics(posthog),
		clear: () => resetConsent(posthog),
	};
}

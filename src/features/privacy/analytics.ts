import type { PostHogConfig, PostHogInterface } from "posthog-js";

import type { ConsentChoice } from "./consent";

/** The analytics variables a configured build carries. */
export type AnalyticsConfig = {
	projectToken: string;
	host: string;
};

/** Reads the two analytics variables, or `undefined` when either is absent. */
export function readAnalyticsConfig(): AnalyticsConfig | undefined {
	const projectToken: unknown = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
	const host: unknown = import.meta.env.VITE_POSTHOG_HOST;

	if (typeof projectToken !== "string" || typeof host !== "string") {
		return undefined;
	}

	if (projectToken === "" || host === "") {
		return undefined;
	}

	return { projectToken, host };
}

/**
 * Whether analytics is configured at all.
 *
 * The banner, the footer's reset control and the root document's provider all
 * ask this one question, so an unconfigured build asks about nothing, loads
 * nothing, and offers no control that would do nothing.
 */
export function isAnalyticsConfigured(): boolean {
	return readAnalyticsConfig() !== undefined;
}

/**
 * The PostHog options that hold analytics back until the answer is `granted`.
 *
 * The gate is decided from the cookie while the provider renders, so the first
 * page the visitor sees cannot send anything. Feature flag loading stays off in
 * both states because this app reads no flags, runs no surveys and no
 * experiments, and the option cannot be relaxed in the same page.
 */
export function analyticsGateOptions(
	consent: ConsentChoice | undefined,
): Partial<PostHogConfig> {
	const granted = consent === "granted";

	return {
		opt_out_capturing_by_default: !granted,
		opt_out_persistence_by_default: !granted,
		capture_exceptions: granted,
		disable_external_dependency_loading: !granted,
		advanced_disable_flags: true,
	};
}

/**
 * The `loaded` callback: clears what an earlier grant left behind.
 *
 * It runs inside the library's own start, not from a child effect, so nothing
 * depends on an effect ordering. When the answer is not `granted`, PostHog's
 * reset drops its stored consent and any identity it kept for this browser.
 */
export function analyticsLoadCleanup(
	consent: ConsentChoice | undefined,
): (instance: PostHogInterface) => void {
	return (instance) => {
		if (consent !== "granted") {
			instance.reset();
		}
	};
}

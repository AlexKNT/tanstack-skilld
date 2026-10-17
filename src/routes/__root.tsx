import { ClerkProvider, useUser } from "@clerk/tanstack-react-start";
import { shadcn } from "@clerk/ui/themes";
import {
	PostHogErrorBoundary,
	PostHogProvider,
	usePostHog,
} from "@posthog/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	type ErrorComponentProps,
	HeadContent,
	Link,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { CaptureResult } from "posthog-js";
import { useEffect, useMemo, useRef } from "react";
import {
	AppErrorFallback,
	AppErrorSurface,
} from "#/components/app-error-surface";
import { SiteHeader } from "#/components/site-header";
import { Button } from "#/components/ui/button";
import {
	analyticsGateOptions,
	analyticsLoadCleanup,
	isAnalyticsConfigured,
	readAnalyticsConfig,
} from "#/features/privacy/analytics";
import { ConsentBanner } from "#/features/privacy/components/consent-banner";
import { SiteFooter } from "#/features/privacy/components/site-footer";
import {
	type ConsentChoice,
	isConsentChoice,
} from "#/features/privacy/consent";
import { readConsentChoice } from "#/features/privacy/data";
import {
	ConsentChoiceContext,
	useConsentChoice,
	useConsentSnapshot,
} from "#/features/privacy/use-consent";
import { readViewerId } from "#/features/skills/data";
import { useSkillViewerCacheSync } from "#/features/skills/use-viewer";
import { readThemeChoice } from "#/features/theme/data";
import {
	DEFAULT_THEME,
	isThemeChoice,
	THEME_INIT_SCRIPT,
	type ThemeChoice,
} from "#/features/theme/theme";
import {
	ThemeChoiceContext,
	useThemeClassName,
} from "#/features/theme/use-theme";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async () => {
		// These reads are small and independent, so they travel together. The
		// viewer id is what keeps one person's vote state out of another's page,
		// and the consent answer decides the analytics gate while rendering.
		const [theme, viewerId, consent] = await Promise.all([
			readThemeChoice().catch(() => DEFAULT_THEME),
			readViewerId(),
			readConsentChoice().catch(() => undefined),
		]);

		return { theme, viewerId, consent };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Skild",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
		// Runs in the head, before the first paint, so the system choice never
		// flashes the wrong theme. The script is a constant in this repo.
		scripts: [{ children: THEME_INIT_SCRIPT }],
	}),
	shellComponent: RootDocument,
	errorComponent: RootError,
});

/**
 * The surface a failed root read or an uncaught route error renders in.
 *
 * The router's own reset re-runs the read that failed, so the retry here is a
 * real retry rather than a re-render of the error.
 */
function RootError({ reset }: ErrorComponentProps) {
	return (
		<AppErrorSurface message="This page could not be loaded." onRetry={reset}>
			<Button asChild size="sm" variant="ghost">
				<Link to="/">Back to the catalogue</Link>
			</Button>
		</AppErrorSurface>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const analytics = readAnalyticsConfig();
	const serverConsent = useResolvedConsentChoice();
	const consent = useConsentSnapshot(serverConsent);
	// The provider compares its options by value on every render, and a fresh
	// callback reference would count as a change, so the cleanup is kept stable.
	const loaded = useMemo(() => analyticsLoadCleanup(consent), [consent]);

	if (analytics === undefined) {
		if (import.meta.env.DEV) {
			const missingVariable = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
				? "VITE_POSTHOG_HOST"
				: "VITE_POSTHOG_PROJECT_TOKEN";
			throw new Error(
				`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
			);
		}

		return (
			<ConsentChoiceContext.Provider value={serverConsent}>
				<RootContent>{children}</RootContent>
			</ConsentChoiceContext.Provider>
		);
	}

	return (
		<ConsentChoiceContext.Provider value={serverConsent}>
			<PostHogProvider
				apiKey={analytics.projectToken}
				options={{
					api_host: analytics.host,
					ui_host: analytics.host,
					defaults: "2025-05-24",
					before_send: withoutSearchTerm,
					logs: {
						serviceName: "skild-web",
						environment: import.meta.env.MODE,
					},
					loaded,
					...analyticsGateOptions(consent),
				}}
			>
				<PostHogErrorBoundary fallback={AppErrorFallback}>
					<RootContent>{children}</RootContent>
				</PostHogErrorBoundary>
			</PostHogProvider>
		</ConsentChoiceContext.Provider>
	);
}

/**
 * Drops the catalogue's search term from the properties every event carries.
 *
 * The filter lives in the address, so a typed term would ride along on every
 * event as part of the automatic `$current_url`, which is exactly what the
 * filter's own event is careful never to send (spec 0008's security model says
 * nothing a person types leaves the app for an analytics service). Only `q` is
 * removed; the rest of the address, including the tag, is left alone.
 */
function withoutSearchTerm(event: CaptureResult | null): CaptureResult | null {
	if (event === null) {
		return null;
	}

	const currentUrl = event.properties.$current_url;

	if (typeof currentUrl !== "string") {
		return event;
	}

	try {
		const url = new URL(currentUrl);

		if (!url.searchParams.has("q")) {
			return event;
		}

		url.searchParams.delete("q");

		return {
			...event,
			properties: { ...event.properties, $current_url: url.toString() },
		};
	} catch {
		return event;
	}
}

function RootContent({ children }: { children: React.ReactNode }) {
	const theme = useResolvedThemeChoice();
	const themeClass = useThemeClassName(theme);

	return (
		<html className={themeClass} lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeChoiceContext.Provider value={theme}>
					<ClerkProvider appearance={{ theme: shadcn }}>
						<PostHogUserIdentification />
						<SkillViewerCacheSync />
						<SiteHeader />
						{children}
						<SiteFooter />
						<ConsentBanner />
						<TanStackDevtools
							config={{
								position: "bottom-right",
							}}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
								TanStackQueryDevtools,
							]}
						/>
						<Scripts />
					</ClerkProvider>
				</ThemeChoiceContext.Provider>
			</body>
		</html>
	);
}

/**
 * Keeps the viewer's reads in step with the session. Mounted inside the Clerk
 * provider, beside the analytics identification, because signing in through the
 * header's dialog navigates nowhere.
 */
function SkillViewerCacheSync() {
	useSkillViewerCacheSync();

	return null;
}

/**
 * The theme choice the root route resolved on the server, read back from the
 * router context. The shell is not a normal route component, so it reads the
 * root match's context rather than calling a route hook.
 */
function useResolvedThemeChoice(): ThemeChoice {
	return useRouterState({
		select: (state) => {
			const context = state.matches[0]?.context as
				| { theme?: unknown }
				| undefined;
			return isThemeChoice(context?.theme) ? context.theme : DEFAULT_THEME;
		},
	});
}

/**
 * The consent answer the root route resolved on the server, read back from the
 * router context. The shell is not a normal route component, so it reads the
 * root match's context rather than calling a route hook.
 */
function useResolvedConsentChoice(): ConsentChoice | undefined {
	return useRouterState({
		select: (state) => {
			const context = state.matches[0]?.context as
				| { consent?: unknown }
				| undefined;

			return isConsentChoice(context?.consent) ? context.consent : undefined;
		},
	});
}

function PostHogUserIdentification() {
	const posthog = usePostHog();
	const { choice } = useConsentChoice();
	const consented = choice === "granted";
	const { isLoaded, isSignedIn, user } = useUser();
	const previousUserId = useRef<string | null>(null);

	useEffect(() => {
		if (!isLoaded) return;

		// Identifying a signed in person is analytics too, so it waits for the
		// same yes that every other event waits for.
		if (!consented || !isAnalyticsConfigured()) {
			previousUserId.current = null;
			return;
		}

		if (!isSignedIn || !user) {
			if (previousUserId.current) {
				posthog.reset();
				previousUserId.current = null;
			}
			return;
		}

		if (previousUserId.current && previousUserId.current !== user.id) {
			posthog.reset();
		}

		if (previousUserId.current !== user.id) {
			posthog.identify(user.id, {
				email: user.primaryEmailAddress?.emailAddress,
				name:
					[user.firstName, user.lastName].filter(Boolean).join(" ") ||
					undefined,
			});
			previousUserId.current = user.id;
		}
	}, [consented, isLoaded, isSignedIn, posthog, user]);

	return null;
}

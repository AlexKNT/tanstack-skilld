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
	HeadContent,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect, useRef } from "react";
import { SiteHeader } from "#/components/site-header";
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
		// Both reads are small and independent, so they travel together. The
		// viewer id is what keeps one person's vote state out of another's page.
		const [theme, viewerId] = await Promise.all([
			readThemeChoice().catch(() => DEFAULT_THEME),
			readViewerId(),
		]);

		return { theme, viewerId };
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
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
	const host = import.meta.env.VITE_POSTHOG_HOST;

	if (!projectToken || !host) {
		if (import.meta.env.DEV) {
			const missingVariable = !projectToken
				? "VITE_POSTHOG_PROJECT_TOKEN"
				: "VITE_POSTHOG_HOST";
			throw new Error(
				`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
			);
		}

		return <RootContent>{children}</RootContent>;
	}

	return (
		<PostHogProvider
			apiKey={projectToken}
			options={{
				api_host: host,
				ui_host: host,
				capture_exceptions: true,
				debug: import.meta.env.DEV,
				defaults: "2025-05-24",
				logs: {
					serviceName: "skild-web",
					environment: import.meta.env.MODE,
				},
			}}
		>
			<PostHogErrorBoundary>
				<RootContent>{children}</RootContent>
			</PostHogErrorBoundary>
		</PostHogProvider>
	);
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

function PostHogUserIdentification() {
	const posthog = usePostHog();
	const { isLoaded, isSignedIn, user } = useUser();
	const previousUserId = useRef<string | null>(null);

	useEffect(() => {
		if (!isLoaded) return;

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
	}, [isLoaded, isSignedIn, posthog, user]);

	return null;
}

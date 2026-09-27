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
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect, useRef } from "react";
import { SiteHeader } from "#/components/site-header";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider appearance={{ theme: shadcn }}>
					<PostHogUserIdentification />
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
			</body>
		</html>
	);
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

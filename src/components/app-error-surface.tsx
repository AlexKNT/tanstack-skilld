import type { PostHogErrorBoundaryFallbackProps } from "@posthog/react";
import { CircleAlert } from "lucide-react";
import type React from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";

/**
 * The app's own error surface: what failed, in one sentence, and one way back.
 *
 * Every read in the app already answers a failure with its own surface and a
 * retry beside the message the store returned. This is the surface for a
 * failure that has no page to render in, so it carries the content column and
 * its own heading.
 */
export function AppErrorSurface({
	message,
	onRetry,
	children,
}: {
	message: string;
	onRetry?: () => void;
	children?: React.ReactNode;
}) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:py-20">
			<Alert className="max-w-2xl" variant="destructive">
				<CircleAlert aria-hidden="true" />
				<AlertTitle>Something went wrong</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				{onRetry === undefined && children === undefined ? null : (
					<div className="col-start-2 mt-2 flex flex-wrap items-center gap-2">
						{onRetry === undefined ? null : (
							<Button onClick={onRetry} size="sm" variant="outline">
								Try again
							</Button>
						)}
						{children}
					</div>
				)}
			</Alert>
		</main>
	);
}

/**
 * What the analytics provider's boundary shows when an error escapes the router.
 *
 * A boundary given no fallback renders nothing at all, which reads as a blank
 * page, so this one always names the failure and offers the boundary's reset.
 * The router's own errors are answered by the root route's error component
 * instead, which resets the route rather than the whole tree.
 */
export function AppErrorFallback({
	resetError,
}: PostHogErrorBoundaryFallbackProps) {
	return (
		<AppErrorSurface
			message="This page could not be rendered. The error has been reported."
			onRetry={resetError}
		/>
	);
}

import { SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in/$")({
	component: Page,
});

/**
 * Reads the `redirect` search param a guarded route set on its way here, so
 * Clerk can send the user back to where they were headed once they sign in.
 */
function readRedirectTarget(): string | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	const value = new URLSearchParams(window.location.search).get("redirect");

	if (value === null || !value.startsWith("/") || value.startsWith("//")) {
		return undefined;
	}

	// Only in app paths are accepted, so the param cannot bounce a user off site.
	return value;
}

function Page() {
	const redirectUrl = readRedirectTarget();

	return (
		<div className="flex min-h-screen items-center justify-center">
			<SignIn
				{...(redirectUrl === undefined
					? {}
					: {
							fallbackRedirectUrl: redirectUrl,
							forceRedirectUrl: redirectUrl,
						})}
			/>
		</div>
	);
}

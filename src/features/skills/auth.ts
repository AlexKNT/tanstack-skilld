import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/** Where the publish form lives, and the path a signed out visitor returns to. */
export const PUBLISH_PATH = "/skills/new";

/** Where a signed out visitor is sent when no usable return path was given. */
const DEFAULT_RETURN_PATH = "/";

/**
 * Accepts only a root relative, in app path.
 *
 * The return target is handed back to the sign in page and then to Clerk, so a
 * value that could leave the site (an absolute URL, or a protocol relative one
 * such as `//evil.example`) is replaced with the default rather than trusted.
 */
function safeReturnPath(value: unknown): string {
	if (typeof value !== "string") {
		return DEFAULT_RETURN_PATH;
	}

	if (!value.startsWith("/") || value.startsWith("//")) {
		return DEFAULT_RETURN_PATH;
	}

	return value;
}

/**
 * The signed in guard for a route's `beforeLoad`.
 *
 * Reads the Clerk session on the server and throws a router redirect when there
 * is none, so a signed out visitor never receives the guarded page's HTML. The
 * redirect carries the path it came from, which the sign in page hands back to
 * Clerk so the user lands where they were headed after signing in.
 */
export const ensureSignedIn = createServerFn({ method: "GET" })
	.inputValidator((input: { returnTo?: unknown } | undefined) => ({
		returnTo: safeReturnPath(input?.returnTo),
	}))
	.handler(async ({ data }): Promise<undefined> => {
		const { isAuthenticated } = await auth();

		if (!isAuthenticated) {
			throw redirect({
				to: "/sign-in/$",
				search: { redirect: data.returnTo },
			});
		}

		return undefined;
	});

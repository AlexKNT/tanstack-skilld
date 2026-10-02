import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/** Where a signed out visitor is sent, and where sign in should return them. */
export const PUBLISH_PATH = "/skills/new";

/**
 * The signed in guard for a route's `beforeLoad`.
 *
 * Reads the Clerk session on the server and throws a router redirect when there
 * is none, so a signed out visitor never receives the guarded page's HTML. The
 * redirect carries the path it came from, which the sign in page hands back to
 * Clerk so the user lands on the form after signing in.
 */
export const ensureSignedIn = createServerFn({ method: "GET" }).handler(
	async (): Promise<undefined> => {
		const { isAuthenticated } = await auth();

		if (!isAuthenticated) {
			throw redirect({
				to: "/sign-in/$",
				search: { redirect: PUBLISH_PATH },
			});
		}

		return undefined;
	},
);

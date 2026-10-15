import { clerkClient } from "@clerk/tanstack-react-start/server";

/** The value the role has to hold for a person to moderate anyone's skill. */
const ADMIN_ROLE = "admin";

/** The field Clerk's public metadata carries the role in. */
const ROLE_FIELD = "role";

/**
 * Reports whether the given person holds the admin role.
 *
 * The role is read from Clerk's public metadata for the session user id, never
 * from anything the browser sent and never from the metadata field Clerk lets a
 * browser write. It is read on each request that asks rather than cached with a
 * time to live, so a role removed in Clerk stops working on the next request.
 *
 * A lookup that fails grants nothing. The author's own path does not depend on
 * this answer, and an admin whose lookup fails is simply not treated as one.
 */
export async function readIsAdmin(userId: string): Promise<boolean> {
	try {
		const user = await clerkClient().users.getUser(userId);

		return user.publicMetadata[ROLE_FIELD] === ADMIN_ROLE;
	} catch (error) {
		console.error("[moderation] Clerk role lookup failed", error);
		return false;
	}
}

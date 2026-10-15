import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import { countSkillRowsByAuthor } from "#/db/queries";
import { fail, ok, type Result } from "#/db/result";

/** The identity and counts the account overview shows. */
export type AccountOverview = {
	user: {
		fullName: string;
		imageUrl: string | undefined;
		primaryEmail: string | undefined;
		joinedAt: Date;
	};
	/** The skills the catalogue shows under this author's name. */
	skillCount: number;
	/** The skills an author hid themselves, or an admin hid for them. */
	hiddenSkillCount: number;
};

/** The failure codes the overview can return. */
export type AccountOverviewFailureCode =
	| "UNAUTHENTICATED"
	| "SKILLS_QUERY_FAILED";

/** The name shown when Clerk holds neither a name nor an email. */
const FALLBACK_NAME = "Skild member";

/**
 * Derives a display name: the joined first and last name, else the local part
 * of the primary email, else a neutral fallback. Never guessed on the client.
 */
function fullNameOf(
	firstName: string | null,
	lastName: string | null,
	primaryEmail: string | undefined,
): string {
	const joined = [firstName, lastName]
		.filter((part): part is string => part !== null && part !== "")
		.join(" ")
		.trim();

	if (joined !== "") {
		return joined;
	}

	const localPart = primaryEmail?.split("@")[0]?.trim();
	if (localPart !== undefined && localPart !== "") {
		return localPart;
	}

	return FALLBACK_NAME;
}

/**
 * Reads the signed in user's identity from Clerk and their skill count from our
 * store. The count is a real `count(*)`, and the identity is never cached on
 * the client, so neither can go stale in the markup.
 */
export const getAccountOverview = createServerFn({ method: "GET" }).handler(
	async (): Promise<Result<AccountOverview, AccountOverviewFailureCode>> => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return fail("UNAUTHENTICATED", "Sign in to see your account.");
		}

		const count = await countSkillRowsByAuthor(userId);
		if (!count.ok) {
			return count;
		}
		try {
			const user = await clerkClient().users.getUser(userId);
			const primaryEmail =
				user.emailAddresses.find(
					(address) => address.id === user.primaryEmailAddressId,
				)?.emailAddress ?? undefined;

			return ok({
				user: {
					fullName: fullNameOf(user.firstName, user.lastName, primaryEmail),
					imageUrl: user.imageUrl === "" ? undefined : user.imageUrl,
					primaryEmail,
					joinedAt: new Date(user.createdAt),
				},
				skillCount: count.value.published,
				hiddenSkillCount: count.value.hidden,
			});
		} catch (error) {
			console.error("[account] clerk user lookup failed", error);
			return fail("SKILLS_QUERY_FAILED", "Your account could not be loaded.");
		}
	},
);

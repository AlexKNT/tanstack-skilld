import { clerkClient } from "@clerk/tanstack-react-start/server";

/** A skill's publisher, read from Clerk and shown beside the skill. */
export type SkillAuthor = {
	id: string;
	name: string;
	imageUrl: string | undefined;
};

/**
 * Reads the people behind a page of rows in one batched Clerk call.
 *
 * Best effort by design: duplicate ids are asked for once, only the three
 * fields a surface needs are read, and any failure (a slow Clerk, an unknown
 * id) is logged and answered with an empty map so the rows still render. A
 * caller that finds no entry for an id decides for itself what to show; the
 * moderation area shows one neutral label rather than failing the row.
 */
export async function loadAuthors(
	authorIds: ReadonlyArray<string | undefined>,
): Promise<Map<string, SkillAuthor>> {
	const uniqueIds = [
		...new Set(authorIds.filter((id): id is string => id !== undefined)),
	];

	if (uniqueIds.length === 0) {
		return new Map();
	}

	try {
		const { data } = await clerkClient().users.getUserList({
			limit: uniqueIds.length,
			userId: uniqueIds,
		});

		const authors = new Map<string, SkillAuthor>();
		for (const user of data) {
			const fullName = [user.firstName, user.lastName]
				.filter((part) => part !== null && part !== "")
				.join(" ")
				.trim();

			authors.set(user.id, {
				id: user.id,
				name: fullName === "" ? (user.username ?? "Skild member") : fullName,
				imageUrl: user.imageUrl === "" ? undefined : user.imageUrl,
			});
		}

		return authors;
	} catch (error) {
		console.error("[skills] publisher lookup failed", error);
		return new Map();
	}
}

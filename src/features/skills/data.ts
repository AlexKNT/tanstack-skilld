import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import { insertSkillWithSlug, listSkillRows } from "#/db/queries";
import type { Result } from "#/db/result";
import {
	type CreateSkillInput,
	type SkillFailureCode,
	type ValidatedSkillInput,
	validateCreateSkillInput,
	validateListSkillsInput,
} from "./schema";
import { slugify, slugWithSuffix } from "./slug";

/** How many clashing slugs to try before giving up on a derived name. */
const MAX_SLUG_ATTEMPTS = 25;

/**
 * The skill shape the catalogue reads: the columns a card needs, with the
 * nullable ones expressed as `undefined` rather than `null`.
 */
export type SkillListItem = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	authorId: string | undefined;
	installUrl: string | undefined;
	createdAt: Date;
};

/**
 * Reads the catalogue, newest first.
 *
 * Public: the catalogue is the front page and anyone may read it. Deliberately
 * returns a failure rather than throwing, so the page renders an error state
 * instead of falling over.
 */
export const listSkills = createServerFn({ method: "GET" })
	.inputValidator((input: { limit?: number; offset?: number } | undefined) =>
		validateListSkillsInput(input ?? {}),
	)
	.handler(
		async ({
			data,
		}): Promise<
			Result<SkillListItem[], "VALIDATION_FAILED" | "SKILLS_QUERY_FAILED">
		> => {
			if (!data.ok) {
				return data;
			}

			return listSkillRows(data.value.limit, data.value.offset);
		},
	);

/** The created skill a caller gets back, including the slug the server chose. */
export type CreatedSkill = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	description: string;
	installUrl: string | undefined;
	authorId: string | undefined;
	createdAt: Date;
};

/**
 * Saves one skill, with the slug derived on the server so two clients cannot
 * disagree about a URL.
 *
 * Requires a signed in session, and takes the author id from that session
 * rather than from the payload, so nobody can publish under another person's
 * name. A clashing slug is retried with a numeric suffix rather than refused.
 */
export const createSkill = createServerFn({ method: "POST" })
	.inputValidator((input: CreateSkillInput) => input)
	.handler(
		async ({ data }): Promise<Result<CreatedSkill, SkillFailureCode>> => {
			const { isAuthenticated, userId } = await auth();

			if (!isAuthenticated || !userId) {
				return {
					ok: false,
					code: "UNAUTHENTICATED",
					message: "Sign in to publish a skill.",
				};
			}

			const validated = validateCreateSkillInput(data);
			if (!validated.ok) {
				return validated;
			}

			return saveSkill(validated.value, userId);
		},
	);

/** Writes a validated skill, working through slug candidates on a clash. */
async function saveSkill(
	values: ValidatedSkillInput,
	authorId: string,
): Promise<Result<CreatedSkill, SkillFailureCode>> {
	const baseSlug = slugify(values.name);

	for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
		const candidate = slugWithSuffix(baseSlug, attempt);

		const inserted = await insertSkillWithSlug(candidate, {
			name: values.name,
			summary: values.summary,
			description: values.description,
			installUrl: values.installUrl,
			authorId,
		});

		if (!inserted.ok) {
			return inserted;
		}

		if (inserted.value !== undefined) {
			const row = inserted.value;
			return {
				ok: true,
				value: {
					id: row.id,
					slug: row.slug,
					name: row.name,
					summary: row.summary,
					description: row.description,
					installUrl: row.installUrl ?? undefined,
					authorId: row.authorId ?? undefined,
					createdAt: row.createdAt,
				},
			};
		}
	}

	return {
		ok: false,
		code: "SKILLS_WRITE_FAILED",
		message: "That name is already taken by a lot of skills. Try another name.",
	};
}

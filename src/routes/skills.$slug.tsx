import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from "#/components/ui/empty";
import { Separator } from "#/components/ui/separator";
import type { Result } from "#/db/result";
import { NOINDEX_HEADER_VALUE } from "#/features/seo/indexing";
import { skillHead, skillStructuredData } from "#/features/seo/meta";
import { absoluteSiteUrl } from "#/features/seo/site";
import { SkillAuthorBlock } from "#/features/skills/components/skill-author";
import { SkillInstallButton } from "#/features/skills/components/skill-install-button";
import { SkillMarkdown } from "#/features/skills/components/skill-markdown";
import { SkillReadError } from "#/features/skills/components/skill-read-error";
import { SkillTagList } from "#/features/skills/components/skill-tag-list";
import { SkillUpvoteButton } from "#/features/skills/components/skill-upvote-button";
import type { SkillDetail } from "#/features/skills/data";
import { formatSkillDate } from "#/features/skills/date";
import { skillDetailQueryOptions, skillKeys } from "#/features/skills/query";
import type { SkillReadFailureCode } from "#/features/skills/schema";

type SkillContext = {
	queryClient: QueryClient;
	viewerId: string | undefined;
};

/** The detail read's cached result, the value both the head and the headers use. */
type SkillDetailResult = Result<SkillDetail, SkillReadFailureCode>;

export const Route = createFileRoute("/skills/$slug")({
	loader: async ({ context: { queryClient, viewerId }, params }) => {
		const result = await queryClient.ensureQueryData(
			skillDetailQueryOptions(params.slug, viewerId),
		);

		// A missing skill is the one failure the router turns into a real 404.
		if (!result.ok && result.code === "SKILL_NOT_FOUND") {
			throw notFound();
		}
	},
	// The head reads the row the loader already put in the cache, so the tags a
	// crawler receives describe the same skill the page renders. When nothing is
	// there, the page emits no subject specific tag at all.
	head: ({ match, params }) => {
		const cached = readCachedDetail(match.context, params.slug);

		if (cached === undefined || !cached.ok) {
			return { meta: [], links: [], scripts: [] };
		}

		const skill = cached.value;
		const url = absoluteSiteUrl(`/skills/${skill.slug}`);

		return {
			...skillHead({ name: skill.name, summary: skill.summary, url }),
			scripts: [
				skillStructuredData({
					name: skill.name,
					summary: skill.summary,
					url,
					publisher: skill.author?.name,
					updatedAt: skill.updatedAt,
					upvoteCount: skill.upvoteCount,
				}),
			],
		};
	},
	// A read that failed still renders a page, at 200, so the middleware cannot
	// recognise it by status. Marking it here keeps a broken page out of an
	// index without moving the private path rule out of the middleware.
	headers: ({ match, params }) => {
		const cached = readCachedDetail(match.context, params.slug);

		return cached?.ok === true
			? undefined
			: { "X-Robots-Tag": NOINDEX_HEADER_VALUE };
	},
	component: SkillDetailPage,
	notFoundComponent: SkillNotFound,
});

/**
 * The skill this page describes, read back from the query cache the loader
 * filled.
 *
 * A head invents nothing: an absent entry tells the caller to emit no subject
 * specific tag rather than a placeholder name.
 */
function readCachedDetail(
	context: SkillContext,
	slug: string,
): SkillDetailResult | undefined {
	return context.queryClient.getQueryData<SkillDetailResult>(
		skillKeys.detail(slug, context.viewerId),
	);
}

/** One skill's page: its identity and install action, then its markdown body. */
function SkillDetailPage() {
	const { slug } = Route.useParams();
	const { viewerId } = Route.useRouteContext();
	const query = useSuspenseQuery(skillDetailQueryOptions(slug, viewerId));

	if (!query.data.ok) {
		if (query.data.code === "SKILL_NOT_FOUND") {
			return <SkillNotFound />;
		}

		return (
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:py-20">
				<h1 className="font-display text-3xl font-bold">
					The skill could not be loaded
				</h1>
				<SkillReadError
					message={query.data.message}
					onRetry={() => void query.refetch()}
					retrying={query.isRefetching}
				/>
			</main>
		);
	}

	const skill = query.data.value;

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:py-20">
			<article className="flex flex-col gap-8">
				<header className="flex flex-col gap-4">
					<h1 className="max-w-3xl text-balance font-display text-4xl leading-tight font-bold sm:text-5xl">
						{skill.name}
					</h1>
					<p className="max-w-3xl text-lg text-muted-foreground">
						{skill.summary}
					</p>
					<SkillTagList tags={skill.tags} />
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex flex-wrap items-center gap-3">
							{skill.author === undefined ? null : (
								<SkillAuthorBlock author={skill.author} />
							)}
							{skill.author === undefined ? null : (
								<Separator className="h-4" orientation="vertical" />
							)}
							<time
								className="text-sm text-muted-foreground"
								dateTime={skill.createdAt.toISOString()}
							>
								Added {formatSkillDate(skill.createdAt)}
							</time>
							{skill.updatedAt > skill.createdAt ? (
								<time
									className="text-sm text-muted-foreground"
									dateTime={skill.updatedAt.toISOString()}
								>
									Edited {formatSkillDate(skill.updatedAt)}
								</time>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<SkillUpvoteButton skill={skill} />
							<SkillInstallButton installUrl={skill.installUrl} />
						</div>
					</div>
				</header>
				<Separator />
				<SkillMarkdown description={skill.description} />
			</article>
		</main>
	);
}

/** The 404 surface, used by the route's not found case and a failed refetch. */
function SkillNotFound() {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:py-24">
			<Empty className="border border-dashed">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchX aria-hidden="true" />
					</EmptyMedia>
					<h1 className="text-lg font-medium tracking-tight">
						Skill not found
					</h1>
					<EmptyDescription>
						That skill does not exist or has been removed.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild variant="outline">
						<Link to="/">
							<ArrowLeft aria-hidden="true" />
							Back to the catalogue
						</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</main>
	);
}

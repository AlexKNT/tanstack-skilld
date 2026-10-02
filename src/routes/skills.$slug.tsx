import { useSuspenseQuery } from "@tanstack/react-query";
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
import { SkillAuthorBlock } from "#/features/skills/components/skill-author";
import { SkillInstallButton } from "#/features/skills/components/skill-install-button";
import { SkillMarkdown } from "#/features/skills/components/skill-markdown";
import { SkillReadError } from "#/features/skills/components/skill-read-error";
import { formatSkillDate } from "#/features/skills/date";
import { skillDetailQueryOptions } from "#/features/skills/query";

export const Route = createFileRoute("/skills/$slug")({
	loader: async ({ context: { queryClient }, params }) => {
		const result = await queryClient.ensureQueryData(
			skillDetailQueryOptions(params.slug),
		);

		// A missing skill is the one failure the router turns into a real 404.
		if (!result.ok && result.code === "SKILL_NOT_FOUND") {
			throw notFound();
		}
	},
	component: SkillDetailPage,
	notFoundComponent: SkillNotFound,
});

/** One skill's page: its identity and install action, then its markdown body. */
function SkillDetailPage() {
	const { slug } = Route.useParams();
	const query = useSuspenseQuery(skillDetailQueryOptions(slug));

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
						</div>
						<SkillInstallButton installUrl={skill.installUrl} />
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

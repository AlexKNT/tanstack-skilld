import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Spinner } from "#/components/ui/spinner";
import {
	SkillCardGrid,
	SkillCardGridSkeleton,
} from "#/features/skills/components/skill-card-grid";
import { SkillReadError } from "#/features/skills/components/skill-read-error";
import { skillCardsQueryOptions } from "#/features/skills/query";

export const Route = createFileRoute("/")({
	loader: ({ context: { queryClient, viewerId } }) =>
		queryClient.ensureInfiniteQueryData(skillCardsQueryOptions(viewerId)),
	pendingComponent: CatalogueLoading,
	component: Catalogue,
});

const CATALOGUE_ERROR_TITLE = "The catalogue could not be loaded";
const CATALOGUE_ERROR_MESSAGE = "The catalogue could not be loaded.";

/**
 * The catalogue: the introduction band above the grid of the newest skills.
 *
 * The loader puts the first page in the server rendered HTML, so a visitor sees
 * real skills on first paint; the same query key then drives Load more on the
 * client without fetching the first page twice.
 */
function Catalogue() {
	const { viewerId } = Route.useRouteContext();
	const query = useInfiniteQuery(skillCardsQueryOptions(viewerId));

	if (query.status === "pending") {
		return <CatalogueLoading />;
	}

	const pages = query.data?.pages ?? [];
	const loadFailure = pages.length > 0 && !pages[0].ok ? pages[0] : undefined;

	if (query.isError || loadFailure !== undefined) {
		return (
			<CatalogueShell>
				<SkillReadError
					message={
						loadFailure === undefined
							? CATALOGUE_ERROR_MESSAGE
							: loadFailure.message
					}
					onRetry={() => void query.refetch()}
					retrying={query.isRefetching}
					title={CATALOGUE_ERROR_TITLE}
				/>
			</CatalogueShell>
		);
	}

	const skills = pages.flatMap((page) => (page.ok ? page.value.items : []));
	const laterFailure = pages.slice(1).find((page) => !page.ok);

	return (
		<CatalogueShell>
			{skills.length === 0 ? (
				<CatalogueEmpty />
			) : (
				<div className="flex flex-col gap-6">
					<SkillCardGrid skills={skills} />
					{laterFailure === undefined || laterFailure.ok ? null : (
						<SkillReadError
							message={laterFailure.message}
							onRetry={() => void query.refetch()}
							retrying={query.isRefetching}
							title={CATALOGUE_ERROR_TITLE}
						/>
					)}
					{query.hasNextPage ? (
						<div className="flex justify-center">
							<Button
								disabled={query.isFetchingNextPage}
								onClick={() => void query.fetchNextPage()}
								variant="outline"
							>
								{query.isFetchingNextPage ? (
									<>
										<Spinner aria-hidden="true" data-icon="inline-start" />
										Loading
									</>
								) : (
									"Load more"
								)}
							</Button>
						</div>
					) : null}
				</div>
			)}
		</CatalogueShell>
	);
}

/** The shared page frame: the introduction band and the catalogue column. */
function CatalogueShell({ children }: { children: ReactNode }) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:py-20">
			<header className="flex flex-col items-start gap-4">
				<span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Skill catalogue
				</span>
				<h1 className="max-w-2xl text-balance font-display text-4xl leading-tight font-bold sm:text-5xl">
					Discover and share AI agent skills
				</h1>
				<p className="max-w-2xl text-lg text-muted-foreground">
					Browse the newest skills the community has shared, or open one to read
					how it works.
				</p>
			</header>
			<div>{children}</div>
		</main>
	);
}

/** The placeholder grid shown while the catalogue loads on the client. */
function CatalogueLoading() {
	return (
		<CatalogueShell>
			<SkillCardGridSkeleton />
		</CatalogueShell>
	);
}

/** Shown when the store holds no skills at all. */
function CatalogueEmpty() {
	return (
		<Empty className="border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Sparkles aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No skills yet</EmptyTitle>
				<EmptyDescription>
					Skills will appear here once someone publishes one.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

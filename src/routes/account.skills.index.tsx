import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Spinner } from "#/components/ui/spinner";
import {
	ManagedSkillCard,
	ManagedSkillCardSkeleton,
} from "#/features/account/components/managed-skill-card";
import { mySkillCardsQueryOptions } from "#/features/account/query";
import { SkillReadError } from "#/features/skills/components/skill-read-error";

export const Route = createFileRoute("/account/skills/")({
	validateSearch: (search: Record<string, unknown>) => ({
		deleted: typeof search.deleted === "string" ? search.deleted : undefined,
	}),
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureInfiniteQueryData(mySkillCardsQueryOptions()),
	component: MySkillsPage,
	pendingComponent: MySkillsLoading,
});

const LIST_ERROR_MESSAGE = "Your skills could not be loaded.";

/** The author's own skills, newest edit first, with paging and every state. */
function MySkillsPage() {
	const { deleted } = Route.useSearch();
	const query = useInfiniteQuery(mySkillCardsQueryOptions());

	if (query.status === "pending") {
		return <MySkillsLoading />;
	}

	const pages = query.data?.pages ?? [];
	const loadFailure = pages.length > 0 && !pages[0].ok ? pages[0] : undefined;

	if (query.isError || loadFailure !== undefined) {
		return (
			<MySkillsShell>
				<SkillReadError
					message={loadFailure?.message ?? LIST_ERROR_MESSAGE}
					onRetry={() => void query.refetch()}
					retrying={query.isRefetching}
					title={LIST_ERROR_MESSAGE}
				/>
			</MySkillsShell>
		);
	}

	const skills = pages.flatMap((page) => (page.ok ? page.value.items : []));
	const laterFailure = pages.slice(1).find((page) => !page.ok);

	return (
		<MySkillsShell>
			{deleted === undefined ? null : <DeletedNotice />}
			{skills.length === 0 ? (
				<MySkillsEmpty />
			) : (
				<div className="flex flex-col gap-6">
					<ul className="grid gap-4">
						{skills.map((skill) => (
							<li key={skill.id}>
								<ManagedSkillCard skill={skill} />
							</li>
						))}
					</ul>
					{laterFailure === undefined || laterFailure.ok ? null : (
						<SkillReadError
							message={laterFailure.message}
							onRetry={() => void query.refetch()}
							retrying={query.isRefetching}
							title={LIST_ERROR_MESSAGE}
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
		</MySkillsShell>
	);
}

/** The page frame: the heading band and the list column. */
function MySkillsShell({ children }: { children: ReactNode }) {
	return (
		<section className="flex flex-col gap-8">
			<header className="flex flex-col gap-4">
				<span className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Your skills
				</span>
				<h1 className="text-balance font-display text-4xl leading-tight font-bold">
					My skills
				</h1>
				<p className="text-lg text-muted-foreground">
					Skills you published, newest edit first.
				</p>
			</header>
			<div>{children}</div>
		</section>
	);
}

/** The confirmation carried back from a delete. */
function DeletedNotice() {
	return (
		<output className="block rounded-lg border border-border bg-card px-4 py-3 text-sm">
			Skill deleted
		</output>
	);
}

/** Shown when the author has published nothing yet. */
function MySkillsEmpty() {
	return (
		<Empty className="border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Sparkles aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>You have not published a skill yet</EmptyTitle>
				<EmptyDescription>
					Share your first skill so others can find and install it.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/skills/new">Publish a skill</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

/** The placeholders shown while the list loads or retries. */
function MySkillsLoading() {
	return (
		<MySkillsShell>
			<ManagedSkillCardSkeleton />
		</MySkillsShell>
	);
}

import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchX, ShieldCheck } from "lucide-react";
import { type ReactNode, useState } from "react";

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
import { SKILL_VISIBILITY_VALUES, type SkillVisibility } from "#/db/schema";
import { ModerationSkillRow } from "#/features/moderation/components/moderation-skill-row";
import { ensureAdmin } from "#/features/moderation/data";
import { moderationSkillsQueryOptions } from "#/features/moderation/query";
import { ensureSignedIn } from "#/features/skills/auth";
import { SkillReadError } from "#/features/skills/components/skill-read-error";

/** The three things the filter can show, in the order they are offered. */
const FILTERS = [
	{ value: undefined, label: "Every skill" },
	{ value: "published", label: "Published" },
	{ value: "hidden", label: "Hidden" },
] as const;

/** Reads a filter from the address, dropping a value the store does not hold. */
function asFilter(value: unknown): SkillVisibility | undefined {
	return SKILL_VISIBILITY_VALUES.some((allowed) => allowed === value)
		? (value as SkillVisibility)
		: undefined;
}

/**
 * Every skill, whatever its visibility, for an admin.
 *
 * The sign in guard runs first and carries the requested path, so a signed out
 * visitor lands back here. The role guard runs second and answers the app's not
 * found surface rather than a redirect, because a signed in person who is not
 * an admin should not learn that this area exists at all.
 *
 * The filter lives in the address and is validated there, so a shared link
 * renders the filtered page from the server and an unreadable value simply
 * shows every skill rather than failing the page.
 */
export const Route = createFileRoute("/admin/skills")({
	validateSearch: (search: Record<string, unknown>) => ({
		visibility: asFilter(search.visibility),
	}),
	loaderDeps: ({ search }) => ({ visibility: search.visibility }),
	beforeLoad: async ({ location }) => {
		await ensureSignedIn({
			data: { returnTo: `${location.pathname}${location.searchStr}` },
		});
		await ensureAdmin();
	},
	loader: ({ context: { queryClient }, deps }) =>
		queryClient.ensureInfiniteQueryData(
			moderationSkillsQueryOptions(deps.visibility),
		),
	component: AdminSkillsPage,
	notFoundComponent: AdminNotFound,
});

const LIST_ERROR_MESSAGE = "The skills could not be loaded.";

/** The admin list: every skill, its state, and the control that moves it. */
function AdminSkillsPage() {
	const { visibility } = Route.useSearch();
	const [announcement, setAnnouncement] = useState("");
	const query = useInfiniteQuery(moderationSkillsQueryOptions(visibility));

	if (query.status === "pending") {
		return <AdminLoading />;
	}

	const pages = query.data?.pages ?? [];
	const loadFailure = pages.length > 0 && !pages[0].ok ? pages[0] : undefined;

	if (query.isError || loadFailure !== undefined) {
		return (
			<AdminShell>
				<SkillReadError
					message={loadFailure?.message ?? LIST_ERROR_MESSAGE}
					onRetry={() => void query.refetch()}
					retrying={query.isRefetching}
					title={LIST_ERROR_MESSAGE}
				/>
			</AdminShell>
		);
	}

	const skills = pages.flatMap((page) => (page.ok ? page.value.items : []));

	return (
		<AdminShell>
			<VisibilityFilter active={visibility} />
			{/* The list changes under a hide, so the region that speaks lives here
			    rather than inside a row that may be gone by the time it speaks. */}
			<output aria-live="polite" className="sr-only">
				{announcement}
			</output>
			{skills.length === 0 ? (
				<Empty className="border border-dashed">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ShieldCheck aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No skills here</EmptyTitle>
						<EmptyDescription>
							Nothing matches this filter. Try another one.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="grid gap-4">
					{skills.map((skill) => (
						<li key={skill.id}>
							<ModerationSkillRow onAnnounce={setAnnouncement} skill={skill} />
						</li>
					))}
				</ul>
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
		</AdminShell>
	);
}

/** The filter, which is a link each: the address holds it, so it can be shared. */
function VisibilityFilter({ active }: { active: SkillVisibility | undefined }) {
	return (
		<nav aria-label="Filter by visibility" className="flex flex-wrap gap-2">
			{FILTERS.map((filter) => {
				const current = filter.value === active;

				return (
					<Button
						asChild
						key={filter.value}
						size="sm"
						variant={current ? "default" : "outline"}
					>
						<Link
							aria-current={current ? "page" : undefined}
							search={{ visibility: filter.value }}
							to="/admin/skills"
						>
							{filter.label}
						</Link>
					</Button>
				);
			})}
		</nav>
	);
}

/** The page frame: the heading band and the list column. */
function AdminShell({ children }: { children: ReactNode }) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:py-16">
			<header className="flex flex-col gap-4">
				<span className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Moderation
				</span>
				<h1 className="text-balance font-display text-4xl leading-tight font-bold">
					Every skill
				</h1>
				<p className="text-lg text-muted-foreground">
					Hide a skill that breaks the rules, or restore one that is back in
					order. Hidden skills are absent from the catalogue and from their own
					page.
				</p>
			</header>
			<div className="flex flex-col gap-6">{children}</div>
		</main>
	);
}

/** The placeholders shown while the list loads or retries. */
function AdminLoading() {
	return (
		<AdminShell>
			<div className="grid gap-4" aria-hidden="true">
				{[0, 1, 2].map((key) => (
					<div
						className="h-32 animate-pulse rounded-lg border border-border bg-card"
						key={key}
					/>
				))}
			</div>
		</AdminShell>
	);
}

/** What a signed in person without the role sees, and nobody else does. */
function AdminNotFound() {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:py-24">
			<Empty className="border border-dashed">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchX aria-hidden="true" />
					</EmptyMedia>
					<h1 className="text-lg font-medium tracking-tight">Page not found</h1>
					<EmptyDescription>
						That page does not exist or has been removed.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild variant="outline">
						<Link to="/">Back to the catalogue</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</main>
	);
}

import { usePostHog } from "@posthog/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Spinner } from "#/components/ui/spinner";
import type { Result } from "#/db/result";
import { homeHead } from "#/features/seo/meta";
import { absoluteSiteUrl } from "#/features/seo/site";
import {
	SkillCardGrid,
	SkillCardGridSkeleton,
} from "#/features/skills/components/skill-card-grid";
import { SkillFilterBand } from "#/features/skills/components/skill-filter-band";
import {
	FILTERED_EMPTY_TITLE,
	SkillFilterEmpty,
} from "#/features/skills/components/skill-filter-empty";
import { SkillReadError } from "#/features/skills/components/skill-read-error";
import type { CatalogueFilter, SkillCardPage } from "#/features/skills/data";
import {
	searchToFilter,
	validateCatalogueSearch,
} from "#/features/skills/filter";
import {
	skillCardsQueryOptions,
	skillTagsQueryOptions,
} from "#/features/skills/query";
import type { SkillReadFailureCode } from "#/features/skills/schema";

export const Route = createFileRoute("/")({
	validateSearch: validateCatalogueSearch,
	// The filter is a loader dependency, so a settled filter re-runs the loader
	// and the filtered first page is there before the grid renders.
	loaderDeps: ({ search }) => searchToFilter(search),
	loader: ({ context: { queryClient, viewerId }, deps }) =>
		Promise.all([
			queryClient.ensureInfiniteQueryData(
				skillCardsQueryOptions(viewerId, deps),
			),
			queryClient.ensureQueryData(skillTagsQueryOptions()),
		]),
	// A filtered view is a different page rather than a duplicate of the home
	// page, so it carries no canonical and asks not to be indexed instead.
	head: ({ match }) =>
		homeHead(
			match.search.q === undefined && match.search.tag === undefined
				? absoluteSiteUrl("/")
				: undefined,
		),
	pendingComponent: CatalogueLoading,
	component: Catalogue,
});

const CATALOGUE_ERROR_TITLE = "The catalogue could not be loaded";
const CATALOGUE_ERROR_MESSAGE = "The catalogue could not be loaded.";

/** The event a settled filter change captures, named the way the others are. */
const FILTER_EVENT = "catalogue_filtered";

/** One page of the catalogue, as the client's cache holds it. */
type CataloguePage = Result<SkillCardPage, SkillReadFailureCode>;

/**
 * The catalogue: the introduction band, the filter, and the grid of the newest
 * skills.
 *
 * The loader puts the filtered first page in the server rendered HTML, so a
 * shared or reloaded filtered link shows the filtered view on first paint; the
 * same query key then drives Load more on the client without fetching the first
 * page twice. The address is the only place a filter lives, so every control
 * here reports a change to it rather than holding one.
 */
function Catalogue() {
	const { viewerId } = Route.useRouteContext();
	const { q, tag } = Route.useSearch();
	const navigate = Route.useNavigate();
	const posthog = usePostHog();
	const routeIsLoading = useRouterState({ select: (state) => state.isLoading });

	const filter = searchToFilter({ q, tag });
	const filterId = filterKey(filter);
	const query = useInfiniteQuery(skillCardsQueryOptions(viewerId, filter));
	const tagsQuery = useQuery(skillTagsQueryOptions());
	const [announcement, setAnnouncement] = useState("");
	const handledFilter = useRef(filterId);

	// The data the settled filter produced, and nothing while a read is still in
	// flight, so the announcement can never describe the results an earlier
	// filter left on screen.
	const settled =
		query.isPlaceholderData || query.isFetching ? undefined : query.data;

	useEffect(() => {
		if (settled === undefined || filterId === handledFilter.current) {
			return;
		}

		const firstPage = settled.pages[0];
		if (firstPage === undefined || !firstPage.ok) {
			return;
		}

		handledFilter.current = filterId;

		const skills = settled.pages.flatMap((page) =>
			page.ok ? page.value.items : [],
		);

		setAnnouncement(
			skills.length === 0
				? FILTERED_EMPTY_TITLE
				: `${skills.length === 1 ? "1 skill" : `${skills.length} skills`} shown${hasMorePages(settled.pages) ? ", more available" : ""}.`,
		);

		// Clearing a filter is not a filter being applied, so it captures nothing.
		if (filter.term === undefined && filter.tag === undefined) {
			return;
		}

		posthog.capture(FILTER_EVENT, {
			tag: filter.tag ?? null,
			has_query: filter.term !== undefined,
		});
	}, [filter.tag, filter.term, filterId, posthog, settled]);

	/** Settles a term into the address, keeping the active tag. */
	const handleTermSettle = useCallback(
		(term: string | undefined) => {
			void navigate({
				replace: true,
				search: (prev) => ({ ...prev, q: term }),
			});
		},
		[navigate],
	);

	/** Applies a tag, keeping the term, or clears it when the active chip is chosen again. */
	const handleTagChoose = useCallback(
		(chosenTag: string | undefined) => {
			void navigate({
				replace: true,
				search: (prev) => ({ ...prev, tag: chosenTag }),
			});
		},
		[navigate],
	);

	/** Empties the address, which is what clears the filter. */
	const handleClearFilters = useCallback(() => {
		void navigate({ replace: true, search: {} });
	}, [navigate]);

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
	const isFiltered = filter.term !== undefined || filter.tag !== undefined;
	const tags = tagsQuery.data?.ok ? tagsQuery.data.value.items : undefined;
	// The address changes before the read for it answers, so the region says
	// plainly that what is on screen is about to change.
	const busy = routeIsLoading || query.isFetching;

	return (
		<CatalogueShell>
			<div className="flex flex-col gap-6">
				<SkillFilterBand
					busy={busy}
					onTagChoose={handleTagChoose}
					onTermSettle={handleTermSettle}
					tag={filter.tag}
					tags={tags}
					term={filter.term}
				/>
				<output aria-live="polite" className="sr-only">
					{announcement}
				</output>
				<section
					aria-busy={busy}
					aria-label="Skills"
					className="flex flex-col gap-6"
				>
					{skills.length === 0 ? (
						isFiltered ? (
							<SkillFilterEmpty
								onClear={handleClearFilters}
								tag={filter.tag}
								term={filter.term}
							/>
						) : (
							<CatalogueEmpty />
						)
					) : (
						<>
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
						</>
					)}
				</section>
			</div>
		</CatalogueShell>
	);
}

/** A stable name for one filter, so a settle can be told apart from a repeat. */
function filterKey(filter: CatalogueFilter): string {
	return `${filter.term ?? ""}|${filter.tag ?? ""}`;
}

/** Whether the pages loaded so far say that a further page follows. */
function hasMorePages(pages: readonly CataloguePage[]): boolean {
	for (let index = pages.length - 1; index >= 0; index -= 1) {
		const page = pages[index];

		if (page?.ok) {
			return page.value.hasMore;
		}
	}

	return false;
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

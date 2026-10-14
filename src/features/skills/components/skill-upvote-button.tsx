import { useUser } from "@clerk/tanstack-react-start";
import { usePostHog } from "@posthog/react";
import {
	type InfiniteData,
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ThumbsUp } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { ok, type Result } from "#/db/result";
import {
	type SkillCard,
	type SkillCardPage,
	type SkillDetail,
	setUpvote,
	type UpvoteState,
} from "#/features/skills/data";
import { skillKeys } from "#/features/skills/query";
import type { SkillReadFailureCode } from "#/features/skills/schema";
import { useSkillViewerId } from "#/features/skills/use-viewer";
import { cn } from "#/lib/utils";

/** The vote columns a control is rendered from, plus the name it announces. */
type UpvotableSkill = Pick<
	SkillCard,
	"id" | "slug" | "name" | "upvoteCount" | "viewerHasUpvoted"
>;

/** One page of the catalogue, as the client's cache holds it. */
type SkillCardsResult = Result<SkillCardPage, SkillReadFailureCode>;

/** One skill's page, as the client's cache holds it. */
type SkillDetailResult = Result<SkillDetail, SkillReadFailureCode>;

/** The cache as it stood before a click, put back if the write fails. */
type UpvoteSnapshot = {
	/** Every cached catalogue page set, because the card may sit in any of them. */
	cards: ReadonlyArray<
		readonly [QueryKey, InfiniteData<SkillCardsResult, number> | undefined]
	>;
	detail: SkillDetailResult | undefined;
};

/** The event, named the way the other features name theirs. */
const UPVOTE_EVENT = "skill_upvote_changed";

/** What a write that never reached the store says, in the control. */
const UPVOTE_FAILED_MESSAGE = "Your upvote could not be saved.";

/** The count as it is announced. */
function upvoteCountLabel(count: number): string {
	return count === 1 ? "1 upvote" : `${count} upvotes`;
}

/** The control's accessible name: the action it will take and the skill. */
function upvoteActionName(skill: UpvotableSkill): string {
	return skill.viewerHasUpvoted
		? `Remove your upvote from ${skill.name}`
		: `Upvote ${skill.name}`;
}

/** The catalogue pages with one skill's vote state replaced. */
function cardsWithUpvote(
	pages: InfiniteData<SkillCardsResult, number> | undefined,
	skillId: string,
	state: UpvoteState,
): InfiniteData<SkillCardsResult, number> | undefined {
	if (pages === undefined) {
		return undefined;
	}

	return {
		...pages,
		pages: pages.pages.map((page) =>
			page.ok
				? ok({
						...page.value,
						items: page.value.items.map((item) =>
							item.id === skillId
								? {
										...item,
										upvoteCount: state.upvoteCount,
										viewerHasUpvoted: state.upvoted,
									}
								: item,
						),
					})
				: page,
		),
	};
}

/** The detail read with the skill's vote state replaced. */
function detailWithUpvote(
	current: SkillDetailResult | undefined,
	state: UpvoteState,
): SkillDetailResult | undefined {
	if (current === undefined || !current.ok) {
		return current;
	}

	return ok({
		...current.value,
		upvoteCount: state.upvoteCount,
		viewerHasUpvoted: state.upvoted,
	});
}

/**
 * The upvote control: one button carrying the count, on a card and on a skill's
 * page.
 *
 * The click is reflected before the store answers and put back if the write
 * fails, so the interface never keeps a vote the store does not hold. Both
 * directions are asked for by the state to reach, so a repeated click is safe.
 * A signed out visitor is sent to sign in with the page they were on, rather
 * than given a control that does nothing.
 */
export function SkillUpvoteButton({
	skill,
	className,
}: {
	skill: UpvotableSkill;
	className?: string;
}) {
	const viewerId = useSkillViewerId();
	const queryClient = useQueryClient();
	const posthog = usePostHog();
	const location = useLocation();
	const navigate = useNavigate();
	const { isLoaded, isSignedIn } = useUser();

	const [failure, setFailure] = useState<string | undefined>(undefined);
	const [announcement, setAnnouncement] = useState("");

	// The card may sit on an unfiltered page or on any filtered one, so a vote
	// moves every cached catalogue page set for this viewer rather than one key.
	const cardsFamilyKey = skillKeys.cardsFamily(viewerId);
	const detailKey = skillKeys.detail(skill.slug, viewerId);

	function restore(snapshot: UpvoteSnapshot): void {
		for (const [key, data] of snapshot.cards) {
			if (data !== undefined) {
				queryClient.setQueryData(key, data);
			}
		}

		if (snapshot.detail !== undefined) {
			queryClient.setQueryData(detailKey, snapshot.detail);
		}
	}

	const mutation = useMutation({
		mutationFn: (next: boolean) =>
			setUpvote({ data: { skillId: skill.id, upvoted: next } }),
		onMutate: (next) => {
			setFailure(undefined);
			setAnnouncement("");

			const snapshot: UpvoteSnapshot = {
				cards: queryClient.getQueriesData<
					InfiniteData<SkillCardsResult, number>
				>({ queryKey: cardsFamilyKey }),
				detail: queryClient.getQueryData<SkillDetailResult>(detailKey),
			};

			const moved = next === skill.viewerHasUpvoted ? 0 : next ? 1 : -1;
			const optimistic: UpvoteState = {
				upvoted: next,
				upvoteCount: Math.max(0, skill.upvoteCount + moved),
			};

			queryClient.setQueriesData<InfiniteData<SkillCardsResult, number>>(
				{ queryKey: cardsFamilyKey },
				(current) => cardsWithUpvote(current, skill.id, optimistic),
			);

			if (snapshot.detail !== undefined) {
				queryClient.setQueryData(
					detailKey,
					detailWithUpvote(snapshot.detail, optimistic),
				);
			}

			return snapshot;
		},
		onSuccess: async (result, _next, snapshot) => {
			if (!result.ok) {
				restore(snapshot);

				if (result.code === "UNAUTHENTICATED") {
					await sendToSignIn();
					return;
				}

				setFailure(result.message);
				return;
			}

			const settled = result.value;

			queryClient.setQueriesData<InfiniteData<SkillCardsResult, number>>(
				{ queryKey: cardsFamilyKey },
				(current) => cardsWithUpvote(current, skill.id, settled),
			);

			if (snapshot.detail !== undefined) {
				queryClient.setQueryData(
					detailKey,
					detailWithUpvote(snapshot.detail, settled),
				);
			}

			posthog.capture(UPVOTE_EVENT, {
				slug: skill.slug,
				upvoted: settled.upvoted,
			});

			setAnnouncement(
				`${settled.upvoted ? "Upvote saved." : "Upvote removed."} ${upvoteCountLabel(settled.upvoteCount)}.`,
			);
		},
		onError: (_error, _next, snapshot) => {
			if (snapshot !== undefined) {
				restore(snapshot);
			}

			setFailure(UPVOTE_FAILED_MESSAGE);
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: cardsFamilyKey });
			void queryClient.invalidateQueries({ queryKey: detailKey });
		},
	});

	/**
	 * Sends a signed out visitor to sign in, carrying the page they were on.
	 *
	 * The route and the return path are the ones the account area's guard uses,
	 * so signing in lands the visitor back here. The guard itself throws its
	 * redirect, which cannot be followed from a click handler, so the control
	 * performs the same navigation rather than calling it.
	 */
	async function sendToSignIn(): Promise<void> {
		await navigate({
			to: "/sign-in/$",
			search: { redirect: `${location.pathname}${location.searchStr}` },
		});
	}

	async function handleClick(): Promise<void> {
		if (isLoaded && !isSignedIn) {
			await sendToSignIn();
			return;
		}

		mutation.mutate(!skill.viewerHasUpvoted);
	}

	const actionName = upvoteActionName(skill);

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			<Button
				aria-pressed={skill.viewerHasUpvoted}
				onClick={() => void handleClick()}
				title={actionName}
				type="button"
				variant={skill.viewerHasUpvoted ? "secondary" : "outline"}
			>
				<ThumbsUp
					aria-hidden="true"
					className={cn(skill.viewerHasUpvoted && "fill-current")}
				/>
				<span className="sr-only">{actionName}</span>
				<span className="tabular-nums">{skill.upvoteCount}</span>
			</Button>
			<output
				aria-live="polite"
				className={cn(
					"text-sm",
					failure === undefined ? "sr-only" : "text-destructive",
				)}
			>
				{failure ?? announcement}
			</output>
		</div>
	);
}

import { Link } from "@tanstack/react-router";
import { ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { VisibilityDialog } from "#/features/moderation/components/visibility-dialog";
import type { ManagedSkillCard as ManagedSkillCardData } from "#/features/skills/data";
import { formatSkillDate } from "#/features/skills/date";
import { HiddenSkillNote } from "./hidden-skill-note";

/**
 * One of the author's skills, as a management card: its name and summary, when
 * it was last updated, the two places it opens (its edit page, and its public
 * page), and the visibility control.
 *
 * A hidden row says who hid it, when and why, because the reason an admin gives
 * is written for the author to read. A skill the viewer hid themselves may be
 * restored here; one an admin hid may not, and the card says so instead of
 * offering a control that would be refused. The outcome of a change is
 * announced in the polite region below the controls, because the dialog that
 * made it closes on success.
 */
export function ManagedSkillCard({ skill }: { skill: ManagedSkillCardData }) {
	const [announcement, setAnnouncement] = useState("");
	const hidden = skill.visibility === "hidden";
	const moderation = skill.moderation;
	const hiddenByViewer = hidden && moderation?.bySelf === true;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>
					<h2 className="text-lg font-semibold text-balance">
						<Link
							className="rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
							params={{ slug: skill.slug }}
							to="/account/skills/$slug/edit"
						>
							{skill.name}
						</Link>
					</h2>
				</CardTitle>
				<p className="line-clamp-3 text-sm text-muted-foreground">
					{skill.summary}
				</p>
				{hidden ? (
					<HiddenSkillNote
						moderation={moderation}
						note={
							hiddenByViewer ? undefined : "An admin must restore it for you."
						}
					/>
				) : null}
			</CardHeader>
			<CardFooter className="mt-auto flex-wrap gap-3 border-t pt-6">
				<time
					className="text-sm text-muted-foreground"
					dateTime={skill.updatedAt.toISOString()}
				>
					Updated {formatSkillDate(skill.updatedAt)}
				</time>
				<div className="ml-auto flex flex-wrap gap-2">
					<Button asChild size="sm" variant="outline">
						<Link params={{ slug: skill.slug }} to="/account/skills/$slug/edit">
							<Pencil aria-hidden="true" />
							Edit
						</Link>
					</Button>
					<Button asChild size="sm" variant="ghost">
						<Link params={{ slug: skill.slug }} to="/skills/$slug">
							<ExternalLink aria-hidden="true" />
							Public page
						</Link>
					</Button>
					{hidden && !hiddenByViewer ? null : (
						<VisibilityDialog
							action={hidden ? "restore" : "hide"}
							actorRole="author"
							name={skill.name}
							onDone={(outcome) => setAnnouncement(outcome.message)}
							slug={skill.slug}
						/>
					)}
				</div>
				<output aria-live="polite" className="sr-only">
					{announcement}
				</output>
			</CardFooter>
		</Card>
	);
}

/** The placeholder grid shown while the area's list loads or retries. */
export function ManagedSkillCardSkeleton() {
	const keys = ["a", "b", "c"] as const;

	return (
		<div className="grid gap-4" aria-hidden="true">
			{keys.map((key) => (
				<Card className="gap-4" key={key}>
					<CardHeader>
						<Skeleton className="h-5 w-1/3" />
						<Skeleton className="h-4 w-2/3" />
					</CardHeader>
				</Card>
			))}
		</div>
	);
}

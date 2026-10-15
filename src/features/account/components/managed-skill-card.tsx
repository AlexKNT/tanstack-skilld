import { Link } from "@tanstack/react-router";
import { ExternalLink, EyeOff, Pencil } from "lucide-react";
import { useState } from "react";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import {
	VisibilityDialog,
	type VisibilityOutcome,
} from "#/features/moderation/components/visibility-dialog";
import type { ManagedSkillCard as ManagedSkillCardData } from "#/features/skills/data";
import { formatSkillDate } from "#/features/skills/date";
import { useSkillViewerId } from "#/features/skills/use-viewer";

/**
 * One of the author's skills, as a management card: its name and summary, when
 * it was last updated, the two places it opens (its edit page, and its public
 * page), and the visibility control.
 *
 * A skill the viewer hid themselves may be restored here; one an admin hid may
 * not, and the card says so instead of offering a control that would be
 * refused. The outcome of a change is announced in the polite region below the
 * controls, because the dialog that made it closes on success.
 */
export function ManagedSkillCard({ skill }: { skill: ManagedSkillCardData }) {
	const viewerId = useSkillViewerId();
	const [announcement, setAnnouncement] = useState("");
	const hidden = skill.visibility === "hidden";
	const hiddenByViewer = hidden && skill.moderatedBy === viewerId;

	const announce = (outcome: VisibilityOutcome) => {
		if (!outcome.changed) {
			setAnnouncement(
				`${skill.name} was already ${hidden ? "hidden" : "published"}.`,
			);
			return;
		}

		setAnnouncement(
			outcome.visibility === "hidden"
				? `${skill.name} is hidden. It has left the catalogue.`
				: `${skill.name} is published again.`,
		);
	};

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
					<p className="flex items-center gap-2 text-sm text-muted-foreground">
						<Badge variant="secondary">
							<EyeOff aria-hidden="true" />
							Hidden
						</Badge>
						{hiddenByViewer
							? "You hid this skill."
							: "An admin hid this skill."}
					</p>
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
							name={skill.name}
							onDone={announce}
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

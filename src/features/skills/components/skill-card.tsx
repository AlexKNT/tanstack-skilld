import { Link } from "@tanstack/react-router";

import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import type { SkillCard as SkillCardData } from "#/features/skills/data";
import { formatSkillDate } from "#/features/skills/date";
import { SkillAuthorBlock } from "./skill-author";
import { SkillInstallButton } from "./skill-install-button";
import { SkillUpvoteButton } from "./skill-upvote-button";

/**
 * One skill in the catalogue grid.
 *
 * The title carries a stretched link, so the whole card opens the skill, while
 * the install and upvote controls are layered above it: one clickable surface,
 * never an anchor inside an anchor.
 */
export function SkillCard({ skill }: { skill: SkillCardData }) {
	return (
		<Card className="relative h-full">
			<CardHeader>
				<CardTitle>
					<h2 className="text-lg font-semibold text-balance">
						<Link
							className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
							params={{ slug: skill.slug }}
							to="/skills/$slug"
						>
							{skill.name}
						</Link>
					</h2>
				</CardTitle>
				<CardDescription className="line-clamp-3">
					{skill.summary}
				</CardDescription>
				<CardAction className="relative z-10">
					<SkillInstallButton installUrl={skill.installUrl} />
				</CardAction>
			</CardHeader>
			<CardFooter className="mt-auto flex-wrap gap-3 border-t">
				<SkillUpvoteButton className="relative z-10" skill={skill} />
				{skill.author === undefined ? null : (
					<SkillAuthorBlock author={skill.author} />
				)}
				<time
					className="ml-auto shrink-0 text-sm text-muted-foreground"
					dateTime={skill.createdAt.toISOString()}
				>
					{formatSkillDate(skill.createdAt)}
				</time>
			</CardFooter>
		</Card>
	);
}

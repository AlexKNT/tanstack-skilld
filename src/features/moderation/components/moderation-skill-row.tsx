import { EyeOff, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { formatSkillDate } from "#/features/skills/date";
import type { ModerationItem } from "../data";
import { VisibilityDialog } from "./visibility-dialog";

/**
 * One skill as the admin list reads it: who published it, what state it is in,
 * and the last action anybody took on it.
 *
 * A hide and a restore are the same control in both directions, and the control
 * a row offers is always the change it can still make. The outcome is announced
 * by the page rather than here, because a hide can take this row off the list
 * before it has a chance to speak.
 */
export function ModerationSkillRow({
	skill,
	onAnnounce,
}: {
	skill: ModerationItem;
	/** Where the row's outcome is announced: the page's region, not the row's. */
	onAnnounce: (message: string) => void;
}) {
	const hidden = skill.visibility === "hidden";

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>
					<h2 className="text-lg font-semibold text-balance">{skill.name}</h2>
				</CardTitle>
				<p className="line-clamp-2 text-sm text-muted-foreground">
					{skill.summary}
				</p>
				<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<Badge variant={hidden ? "secondary" : "outline"}>
						{hidden ? (
							<EyeOff aria-hidden="true" />
						) : (
							<UserRound aria-hidden="true" />
						)}
						{hidden ? "Hidden" : "Published"}
					</Badge>
					<span className="flex items-center gap-2">
						{skill.publisher === undefined ? null : (
							<Avatar className="size-5">
								<AvatarImage
									alt=""
									src={skill.publisher.imageUrl ?? undefined}
								/>
								<AvatarFallback>
									{skill.publisher.name.slice(0, 1)}
								</AvatarFallback>
							</Avatar>
						)}
						{skill.publisher?.name ?? "No publisher recorded"}
					</span>
				</div>
				{skill.moderator === undefined ? null : (
					<p className="text-sm text-muted-foreground">
						{hidden ? "Hidden" : "Restored"} by {skill.moderator}
						{skill.moderatedAt === undefined
							? ""
							: ` on ${formatSkillDate(skill.moderatedAt)}`}
						{skill.reason === undefined ? "" : `: ${skill.reason}`}
					</p>
				)}
			</CardHeader>
			<CardFooter className="mt-auto flex-wrap gap-3 border-t pt-6">
				<time
					className="text-sm text-muted-foreground"
					dateTime={skill.createdAt.toISOString()}
				>
					Published {formatSkillDate(skill.createdAt)}
				</time>
				<div className="ml-auto flex flex-wrap gap-2">
					<VisibilityDialog
						action={hidden ? "restore" : "hide"}
						name={skill.name}
						onDone={(outcome) => onAnnounce(outcome.message)}
						slug={skill.slug}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}

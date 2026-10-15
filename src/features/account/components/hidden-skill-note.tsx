import { EyeOff } from "lucide-react";

import { Badge } from "#/components/ui/badge";
import type { SkillModerationRecord } from "#/features/skills/data";
import { formatSkillDate } from "#/features/skills/date";

/**
 * The state an author meets on a skill the catalogue is not showing: the badge,
 * who held it back and when, and the reason they gave.
 *
 * Both author surfaces that can meet a hidden skill render this, so a reason an
 * admin writes reads the same wherever the author finds it. `note` is the one
 * sentence that differs between them, because what the author can do about it
 * depends on which surface they are looking at.
 */
export function HiddenSkillNote({
	moderation,
	note,
}: {
	moderation: SkillModerationRecord | undefined;
	note?: string;
}) {
	return (
		<div className="grid gap-2 text-sm text-muted-foreground">
			<p className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">
					<EyeOff aria-hidden="true" />
					Hidden
				</Badge>
				<span>
					{moderation === undefined
						? "Not in the catalogue."
						: `${moderation.bySelf ? "Hidden by you" : `Hidden by ${moderation.actor}`} on ${formatSkillDate(moderation.at)}.`}
				</span>
			</p>
			<p className="text-balance">
				{moderation?.reason === undefined
					? "No reason was given."
					: `Reason: ${moderation.reason}`}
			</p>
			{note === undefined ? null : <p className="text-balance">{note}</p>}
		</div>
	);
}

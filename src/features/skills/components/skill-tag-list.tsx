import { Link } from "@tanstack/react-router";

import { Badge } from "#/components/ui/badge";
import { formatTagLabel } from "#/features/skills/tags";
import { cn } from "#/lib/utils";

/**
 * A skill's tags as badges.
 *
 * Each badge is a real link that applies its own tag as the catalogue's filter,
 * so a tag is one click from the list of skills carrying it and a filtered
 * address can be opened in a new tab or shared. The tag the visitor is already
 * filtering by is kept, because applying a tag does not throw away a term.
 *
 * The row is layered above the card's stretched title link rather than nested
 * inside it, so the card stays one clickable surface with the links as separate
 * stops for a keyboard.
 */
export function SkillTagList({
	tags,
	className,
}: {
	tags: string[];
	className?: string;
}) {
	if (tags.length === 0) {
		return null;
	}

	return (
		<ul className={cn("relative z-10 flex flex-wrap gap-1.5", className)}>
			{tags.map((tag) => (
				<li key={tag}>
					<Badge asChild variant="outline">
						<Link search={(prev) => ({ ...prev, tag })} to="/">
							{formatTagLabel(tag)}
						</Link>
					</Badge>
				</li>
			))}
		</ul>
	);
}

import { useId } from "react";

import { Button } from "#/components/ui/button";
import type { SkillTag } from "#/features/skills/data";
import { formatTagLabel } from "#/features/skills/tags";

/**
 * The tags in use, as a wrapping row of buttons.
 *
 * A chip is an action on this page rather than a link: choosing it narrows the
 * catalogue, and choosing the active one again clears it, which a button's
 * pressed state says plainly to a keyboard or screen reader user. The row is
 * read from the store, so a chip can only exist for a tag some skill carries
 * and can never lead to an empty result.
 */
export function SkillTagChips({
	tags,
	activeTag,
	onChoose,
}: {
	tags: SkillTag[];
	activeTag: string | undefined;
	onChoose: (tag: string | undefined) => void;
}) {
	const labelId = useId();

	if (tags.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm font-medium" id={labelId}>
				Tags in use
			</span>
			<ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
				{tags.map(({ tag, count }) => {
					const selected = tag === activeTag;

					return (
						<li key={tag}>
							<Button
								aria-pressed={selected}
								onClick={() => onChoose(selected ? undefined : tag)}
								size="sm"
								type="button"
								variant={selected ? "secondary" : "outline"}
							>
								{formatTagLabel(tag)}
								<span
									aria-hidden="true"
									className="tabular-nums text-muted-foreground"
								>
									{count}
								</span>
								<span className="sr-only">
									{count === 1 ? "1 skill" : `${count} skills`}
								</span>
							</Button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

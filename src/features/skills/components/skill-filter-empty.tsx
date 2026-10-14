import { SearchX } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { formatTagLabel } from "#/features/skills/tags";

/** The heading the filtered empty surface carries, and announces. */
export const FILTERED_EMPTY_TITLE = "No skills match that filter";

/**
 * What the filter says the visitor was looking for, in plain words.
 *
 * Two ways to narrow the catalogue mean two ways to reach nothing, so the copy
 * names whichever is active without blaming the visitor for it.
 */
function filteredEmptyBody(term: string | undefined, tag: string | undefined) {
	if (term !== undefined && tag !== undefined) {
		return `Nothing in the catalogue matches the word "${term}" with the tag "${formatTagLabel(tag)}".`;
	}

	if (tag !== undefined) {
		return `Nothing in the catalogue matches the tag "${formatTagLabel(tag)}".`;
	}

	return `Nothing in the catalogue matches the word "${term}".`;
}

/**
 * Shown when a filter matched nothing.
 *
 * Its own surface, told apart from the catalogue's "no skills yet" one, because
 * telling a visitor the catalogue is empty when it was their filter that
 * matched nothing would be a small lie told by the interface. One action clears
 * the whole filter, so nothing has to be unpicked by hand.
 */
export function SkillFilterEmpty({
	term,
	tag,
	onClear,
}: {
	term: string | undefined;
	tag: string | undefined;
	onClear: () => void;
}) {
	return (
		<Empty className="border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchX aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>{FILTERED_EMPTY_TITLE}</EmptyTitle>
				<EmptyDescription>{filteredEmptyBody(term, tag)}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button onClick={onClear} type="button" variant="outline">
					Clear filters
				</Button>
			</EmptyContent>
		</Empty>
	);
}

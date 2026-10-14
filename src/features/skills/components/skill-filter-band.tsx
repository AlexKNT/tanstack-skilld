import type { SkillTag } from "#/features/skills/data";
import { SkillSearchBox } from "./skill-search-box";
import { SkillTagChips } from "./skill-tag-chips";

/**
 * The catalogue's filter band: the search box, then the tags in use.
 *
 * The band holds no filter of its own. It shows what the address holds and
 * hands every change up to the page, which is the one place the address is
 * written, so the URL stays the single source of truth.
 */
export function SkillFilterBand({
	term,
	tag,
	tags,
	busy,
	onTermSettle,
	onTagChoose,
}: {
	term: string | undefined;
	tag: string | undefined;
	/** The tags in use, or nothing while that read has not answered yet. */
	tags: SkillTag[] | undefined;
	busy: boolean;
	onTermSettle: (term: string | undefined) => void;
	onTagChoose: (tag: string | undefined) => void;
}) {
	return (
		<section
			aria-label="Filter the catalogue"
			className="flex flex-col gap-5 rounded-lg border bg-card p-4 sm:p-6"
		>
			<SkillSearchBox busy={busy} onSettle={onTermSettle} term={term} />
			{tags === undefined ? null : (
				<SkillTagChips activeTag={tag} onChoose={onTagChoose} tags={tags} />
			)}
		</section>
	);
}

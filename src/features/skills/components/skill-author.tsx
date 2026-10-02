import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import type { SkillAuthor } from "#/features/skills/data";
import { cn } from "#/lib/utils";

/** The initials shown in place of a picture, at most two letters. */
function initialsOf(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter((part) => part !== "")
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}

/**
 * A skill's publisher: their picture (or initials) and their name.
 *
 * The picture is decorative, because the name beside it already names the
 * person, so an empty `alt` is deliberate rather than a missing description.
 */
export function SkillAuthorBlock({
	author,
	className,
}: {
	author: SkillAuthor;
	className?: string;
}) {
	return (
		<div className={cn("flex min-w-0 items-center gap-2", className)}>
			<Avatar size="sm">
				{author.imageUrl === undefined ? null : (
					<AvatarImage alt="" src={author.imageUrl} />
				)}
				<AvatarFallback>{initialsOf(author.name)}</AvatarFallback>
			</Avatar>
			<span className="truncate text-sm text-muted-foreground">
				{author.name}
			</span>
		</div>
	);
}

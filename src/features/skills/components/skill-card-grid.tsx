import { Card, CardContent, CardHeader } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { SkillCard as SkillCardData } from "#/features/skills/data";
import { SkillCard } from "./skill-card";

/** The responsive catalogue grid: one column at the smallest width, three at large. */
const GRID_CLASS = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** Six placeholders, enough to fill the first screenful on a wide display. */
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

/** The catalogue's cards, as a real list so assistive tech counts them. */
export function SkillCardGrid({ skills }: { skills: SkillCardData[] }) {
	return (
		<ul className={GRID_CLASS}>
			{skills.map((skill) => (
				<li className="h-full" key={skill.id}>
					<SkillCard skill={skill} />
				</li>
			))}
		</ul>
	);
}

/** The placeholder grid shown while the catalogue loads or retries. */
export function SkillCardGridSkeleton() {
	return (
		<div aria-hidden="true" className={GRID_CLASS}>
			{SKELETON_KEYS.map((key) => (
				<Card className="gap-4" key={key}>
					<CardHeader>
						<Skeleton className="h-5 w-2/3" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-4/5" />
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<Skeleton className="size-6 rounded-full" />
						<Skeleton className="h-4 w-20" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

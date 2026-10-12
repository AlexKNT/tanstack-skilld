import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from "#/components/ui/empty";
import { EditSkillForm } from "#/features/account/components/edit-skill-form";
import { mySkillDetailQueryOptions } from "#/features/account/query";
import { SkillReadError } from "#/features/skills/components/skill-read-error";

export const Route = createFileRoute("/account/skills/$slug/edit")({
	loader: async ({ context: { queryClient }, params }) => {
		const result = await queryClient.ensureQueryData(
			mySkillDetailQueryOptions(params.slug),
		);

		// A skill that is missing, or belongs to someone else, is a real 404.
		if (!result.ok && result.code === "SKILL_NOT_FOUND") {
			throw notFound();
		}
	},
	component: EditSkillPage,
	notFoundComponent: EditSkillNotFound,
});

/** The edit page: the four prefilled fields, and the delete action. */
function EditSkillPage() {
	const { slug } = Route.useParams();
	const query = useSuspenseQuery(mySkillDetailQueryOptions(slug));

	if (!query.data.ok) {
		if (query.data.code === "SKILL_NOT_FOUND") {
			return <EditSkillNotFound />;
		}

		return (
			<section className="flex flex-col gap-6">
				<h1 className="font-display text-3xl font-bold">
					The skill could not be loaded
				</h1>
				<SkillReadError
					message={query.data.message}
					onRetry={() => void query.refetch()}
					retrying={query.isRefetching}
				/>
			</section>
		);
	}

	const skill = query.data.value;

	return (
		<section className="flex flex-col gap-8">
			<header className="flex flex-col gap-4">
				<span className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Edit
				</span>
				<h1 className="text-balance font-display text-4xl leading-tight font-bold">
					Edit skill
				</h1>
				<p className="text-lg text-muted-foreground">
					Update the details of {skill.name}, or delete it for good.
				</p>
				<Button asChild className="w-fit" size="sm" variant="link">
					<Link search={{ deleted: undefined }} to="/account/skills">
						<ArrowLeft aria-hidden="true" />
						Back to my skills
					</Link>
				</Button>
			</header>
			<EditSkillForm skill={skill} />
		</section>
	);
}

/** The 404 surface, shown for a missing skill and for someone else's. */
function EditSkillNotFound() {
	return (
		<section className="flex flex-col gap-6">
			<Empty className="border border-dashed">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchX aria-hidden="true" />
					</EmptyMedia>
					<h1 className="text-lg font-medium tracking-tight">
						Skill not found
					</h1>
					<EmptyDescription>
						That skill does not exist, or it is not one of yours.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild variant="outline">
						<Link search={{ deleted: undefined }} to="/account/skills">
							<ArrowLeft aria-hidden="true" />
							Back to my skills
						</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</section>
	);
}

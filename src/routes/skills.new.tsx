import { createFileRoute } from "@tanstack/react-router";

import { ensureSignedIn, PUBLISH_PATH } from "#/features/skills/auth";
import {
	PublishSkillForm,
	PublishSkillIntro,
} from "#/features/skills/components/publish-skill-form";

/**
 * The publish page. Kept at a static `/skills/new`, which wins over the
 * `/skills/$slug` detail route because TanStack Router ranks a static segment
 * above a parameter segment (see `src/routes/skills.$slug.tsx`). Reordering the
 * skills routes must preserve that ranking, or `/skills/new` would try to load
 * a skill whose slug is literally "new".
 *
 * The guard runs in `beforeLoad` on the server, so a signed out visitor is
 * redirected before the form's HTML is ever produced.
 */
export const Route = createFileRoute("/skills/new")({
	beforeLoad: async () => {
		await ensureSignedIn({ data: { returnTo: PUBLISH_PATH } });
	},
	component: PublishSkillPage,
});

function PublishSkillPage() {
	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-16 sm:py-20">
			<PublishSkillIntro />
			<PublishSkillForm />
		</main>
	);
}

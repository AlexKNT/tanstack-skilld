import { createFileRoute } from "@tanstack/react-router";

import { ProfileForms } from "#/features/account/components/profile-forms";

export const Route = createFileRoute("/account/profile")({
	component: ProfilePage,
});

/** The profile page: the name, photo, and email sections, all written to Clerk. */
function ProfilePage() {
	return (
		<section className="flex flex-col gap-8">
			<header className="flex flex-col gap-4">
				<span className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Profile
				</span>
				<h1 className="text-balance font-display text-4xl leading-tight font-bold">
					Profile
				</h1>
				<p className="text-lg text-muted-foreground">
					Keep your name, photo, and email address up to date.
				</p>
			</header>
			<ProfileForms />
		</section>
	);
}

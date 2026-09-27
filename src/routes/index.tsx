import { Show, useClerk } from "@clerk/tanstack-react-start";
import { usePostHog } from "@posthog/react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";

const features = [
	{
		title: "Nested routing",
		body: "Type safe routes from TanStack Router, with shared layouts and file based conventions.",
	},
	{
		title: "Clerk auth",
		body: "Sign in, sign up, and session management wired for TanStack Start server functions.",
	},
	{
		title: "Shared components",
		body: "Tailwind CSS 4 with shadcn/ui building blocks, themed to match the app.",
	},
] as const;

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const { openSignUp } = useClerk();
	const posthog = usePostHog();

	const handleSignUp = () => {
		posthog.capture("sign_up_started", { source: "home_hero" });
		posthog.logger.info("sign-up dialog opened", { source: "home_hero" });
		openSignUp();
	};

	return (
		<main className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
			<section className="flex flex-col items-start gap-6">
				<span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					TanStack Start learning build
				</span>

				<h1 className="max-w-2xl text-balance font-[Fraunces] text-4xl leading-tight font-bold sm:text-6xl">
					Discover and share AI agent skills
				</h1>

				<p className="max-w-xl text-lg text-muted-foreground">
					A learning project built on the JavaScript Mastery Skild tutorial,
					using TanStack Start, Clerk, Tailwind CSS, and shadcn/ui.
				</p>

				<div className="flex flex-wrap items-center gap-4">
					<Show when="signed-out">
						<Button size="lg" onClick={handleSignUp}>
							Create an account
						</Button>
					</Show>
					<Show when="signed-in">
						<p className="text-sm text-muted-foreground">
							You are signed in. Open your profile from the header to manage
							your account.
						</p>
					</Show>
				</div>
			</section>

			<section className="mt-16 grid gap-4 sm:grid-cols-3">
				{features.map((feature) => (
					<article
						key={feature.title}
						className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
					>
						<h2 className="font-semibold">{feature.title}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
					</article>
				))}
			</section>
		</main>
	);
}

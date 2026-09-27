import { Show, UserButton, useClerk } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Button } from "#/components/ui/button";

/**
 * Sticky top navigation shown on every route.
 * Shows sign in and sign up buttons when signed out, and Clerk's user button when signed in.
 */
export function SiteHeader() {
	const { openSignIn, openSignUp } = useClerk();

	return (
		<header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-md">
			<div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
				<Link to="/" className="flex items-center gap-2 text-lg font-semibold">
					<Sparkles
						aria-hidden="true"
						className="size-5 text-[var(--lagoon-deep)]"
					/>
					Skild
				</Link>

				<div className="flex items-center gap-2">
					<Show when="signed-out">
						<Button variant="ghost" size="sm" onClick={() => openSignIn()}>
							Sign in
						</Button>
						<Button size="sm" onClick={() => openSignUp()}>
							Sign up
						</Button>
					</Show>
					<Show when="signed-in">
						<UserButton />
					</Show>
				</div>
			</div>
		</header>
	);
}

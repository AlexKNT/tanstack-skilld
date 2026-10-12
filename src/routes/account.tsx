import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AccountNav } from "#/features/account/components/account-nav";
import { ensureSignedIn } from "#/features/skills/auth";

/**
 * The signed in area's layout.
 *
 * The guard runs in `beforeLoad` on the server, before any of the area's HTML
 * is produced, and carries the requested path so signing in returns the visitor
 * to where they were headed. Every page below renders inside this shell.
 */
export const Route = createFileRoute("/account")({
	beforeLoad: async ({ location }) => {
		await ensureSignedIn({
			data: { returnTo: `${location.pathname}${location.searchStr}` },
		});
	},
	component: AccountLayout,
});

function AccountLayout() {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:py-16">
			<div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
				<div className="sm:w-56 sm:shrink-0">
					<AccountNav />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-8">
					<Outlet />
				</div>
			</div>
		</main>
	);
}

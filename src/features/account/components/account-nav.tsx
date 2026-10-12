import { Link } from "@tanstack/react-router";
import { Files, LayoutDashboard, Settings, UserRound } from "lucide-react";

import { cn } from "#/lib/utils";

/** The area's four pages, in the order the sidebar lists them. */
const ACCOUNT_LINKS = [
	{ to: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
	{ to: "/account/skills", label: "My skills", icon: Files, exact: false },
	{ to: "/account/profile", label: "Profile", icon: UserRound, exact: false },
	{ to: "/account/settings", label: "Settings", icon: Settings, exact: false },
] as const;

/**
 * The area's navigation: a vertical list on wider screens that folds to a row
 * of links at small widths. The current page is marked with `aria-current`.
 */
export function AccountNav() {
	return (
		<nav aria-label="Account">
			<ul className="flex flex-wrap gap-1 border-b pb-4 sm:flex-col sm:gap-1 sm:border-none sm:pb-0">
				{ACCOUNT_LINKS.map((link) => (
					<li key={link.to}>
						<Link
							activeOptions={{ exact: link.exact }}
							activeProps={{
								className: "bg-accent text-accent-foreground font-medium",
							}}
							className={cn(
								"flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
								"focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
							)}
							to={link.to}
						>
							<link.icon aria-hidden="true" className="size-4" />
							{link.label}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Files, Settings, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { accountOverviewQueryOptions } from "#/features/account/query";
import { SkillReadError } from "#/features/skills/components/skill-read-error";
import { formatSkillDate } from "#/features/skills/date";

export const Route = createFileRoute("/account/")({
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(accountOverviewQueryOptions()),
	component: OverviewPage,
	pendingComponent: OverviewLoading,
});

const PAGE_LINKS = [
	{ to: "/account/skills", label: "My skills", icon: Files },
	{ to: "/account/profile", label: "Profile", icon: UserRound },
	{ to: "/account/settings", label: "Settings", icon: Settings },
] as const;

function initialsOf(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter((part) => part !== "")
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
}

/** The overview: who you are, how many skills you have, and where to go next. */
function OverviewPage() {
	const query = useSuspenseQuery(accountOverviewQueryOptions());

	if (!query.data.ok) {
		return (
			<section className="flex flex-col gap-6">
				<h1 className="font-display text-3xl font-bold">Your account</h1>
				<SkillReadError
					message={query.data.message}
					onRetry={() => void query.refetch()}
					retrying={query.isRefetching}
				/>
			</section>
		);
	}

	const { user, skillCount, hiddenSkillCount } = query.data.value;
	const skillWord = skillCount === 1 ? "skill" : "skills";
	const hiddenWord = hiddenSkillCount === 1 ? "skill" : "skills";

	return (
		<section className="flex flex-col gap-8">
			<header className="flex flex-col gap-4">
				<span className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Overview
				</span>
				<h1 className="text-balance font-display text-4xl leading-tight font-bold">
					{user.fullName}
				</h1>
				<p className="text-lg text-muted-foreground">Your Skild account</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Identity</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex items-center gap-4">
						<Avatar size="lg">
							{user.imageUrl === undefined ? null : (
								<AvatarImage alt="" src={user.imageUrl} />
							)}
							<AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
						</Avatar>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{user.fullName}</span>
							{user.primaryEmail === undefined ? null : (
								<span className="truncate text-sm text-muted-foreground">
									{user.primaryEmail}
								</span>
							)}
						</div>
					</div>
					<dl className="grid gap-1 text-sm text-muted-foreground">
						<div className="flex gap-2">
							<dt className="font-medium text-foreground">Joined</dt>
							<dd>
								<time dateTime={user.joinedAt.toISOString()}>
									{formatSkillDate(user.joinedAt)}
								</time>
							</dd>
						</div>
						<div className="flex gap-2">
							<dt className="font-medium text-foreground">Published</dt>
							<dd>
								{skillCount} {skillWord}
							</dd>
						</div>
						{hiddenSkillCount === 0 ? null : (
							<div className="flex gap-2">
								<dt className="font-medium text-foreground">Hidden</dt>
								<dd>
									{hiddenSkillCount} {hiddenWord}, not in the catalogue
								</dd>
							</div>
						)}
					</dl>
				</CardContent>
			</Card>

			<nav aria-label="Account pages">
				<ul className="grid gap-3 sm:grid-cols-3">
					{PAGE_LINKS.map((link) => (
						<li key={link.to}>
							<Button
								asChild
								className="h-auto w-full justify-start gap-3 py-3"
								variant="outline"
							>
								<Link to={link.to}>
									<link.icon aria-hidden="true" />
									{link.label}
								</Link>
							</Button>
						</li>
					))}
				</ul>
			</nav>
		</section>
	);
}

/** The shape-matching placeholders used while the overview's loader runs. */
export function OverviewLoading() {
	return (
		<div aria-hidden="true" className="flex flex-col gap-8">
			<div className="flex flex-col gap-4">
				<Skeleton className="h-5 w-24" />
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-6 w-40" />
			</div>
			<Skeleton className="h-48 w-full rounded-xl" />
		</div>
	);
}

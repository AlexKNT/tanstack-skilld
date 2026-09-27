import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { Spinner } from "#/components/ui/spinner";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/design")({
	component: DesignGallery,
	head: () => ({
		meta: [{ title: "Skild primitives" }],
	}),
});

/**
 * A stand in portrait for the Avatar image state, drawn inline so the page needs
 * no network request and no binary asset. The catalogue passes real owner images.
 */
const ownerPortrait =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='p' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%234fb8b2'/%3E%3Cstop offset='1' stop-color='%2324747c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' fill='url(%23p)'/%3E%3Ccircle cx='32' cy='24' r='10' fill='%23f3faf5'/%3E%3Cpath d='M8 64c3-13 12-19 24-19s21 6 24 19z' fill='%23f3faf5'/%3E%3C/svg%3E";

/** The reference page for the design system: every primitive, both themes. */
function DesignGallery() {
	if (!import.meta.env.DEV) {
		return (
			<main className="mx-auto w-full max-w-5xl px-4 py-16">
				<h1 className="font-display text-3xl font-bold">Skild primitives</h1>
				<p className="mt-3 max-w-xl text-muted-foreground">
					This page is a development reference for the design system and is not
					part of the shipped site.
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
			<header className="flex flex-col gap-3">
				<p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Development only
				</p>
				<h1 className="max-w-2xl text-balance font-display text-3xl leading-tight font-bold sm:text-4xl">
					Skild primitives
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Every primitive the catalogue builds on, rendered once on the light
					page surface and once on the dark page surface, so both sets of token
					values can be seen before a theme switcher exists. Not linked from the
					site navigation.
				</p>
			</header>

			<ThemePanel label="Light theme">
				<PrimitiveSet />
			</ThemePanel>

			<ThemePanel dark label="Dark theme">
				<PrimitiveSet />
			</ThemePanel>
		</main>
	);
}

/**
 * One theme's page surface. The dark panel carries the `dark` class, which is
 * what the token blocks in `src/styles.css` switch on.
 */
function ThemePanel({
	label,
	dark = false,
	children,
}: {
	label: string;
	dark?: boolean;
	children: ReactNode;
}) {
	return (
		<section
			className={cn(
				"rounded-2xl border border-border p-6 text-foreground sm:p-8",
				dark && "dark bg-background",
			)}
		>
			<div className="flex items-center gap-3">
				<h2 className="font-display text-xl font-semibold whitespace-nowrap">
					{label}
				</h2>
				<Separator className="flex-1" />
			</div>
			<div className="mt-8 flex flex-col gap-10">{children}</div>
		</section>
	);
}

/** One primitive, with the note that says what it is for in this app. */
function PrimitiveBlock({
	name,
	note,
	children,
}: {
	name: string;
	note: string;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="text-sm font-semibold">{name}</h3>
				<p className="text-sm text-muted-foreground">{note}</p>
			</div>
			{children}
		</section>
	);
}

function PrimitiveSet() {
	return (
		<>
			<PrimitiveBlock
				name="Card"
				note="A skill on the list, composed from its own header, action, body and footer."
			>
				<Card className="max-w-md">
					<CardHeader>
						<CardTitle>Agent skill card</CardTitle>
						<CardDescription>
							A title, a tagline, and one action, which is what the catalogue
							puts on every list item.
						</CardDescription>
						<CardAction>
							<Badge variant="secondary">new</Badge>
						</CardAction>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Nothing here is styled by hand: the depth is the{" "}
							<code>--shadow-card</code> token and every colour is a token.
						</p>
					</CardContent>
					<CardFooter className="gap-2 border-t">
						<Button size="sm">Open</Button>
						<Button size="sm" variant="ghost">
							Save
						</Button>
					</CardFooter>
				</Card>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Badge"
				note="Skill tags, and the hidden marker later. Every variant, plus one as a link."
			>
				<div className="flex flex-wrap items-center gap-2">
					<Badge>default</Badge>
					<Badge variant="secondary">secondary</Badge>
					<Badge variant="outline">outline</Badge>
					<Badge variant="destructive">hidden</Badge>
					<Badge variant="ghost">ghost</Badge>
					<Badge variant="link">link</Badge>
					<Badge asChild variant="outline">
						<a href="/">as a link</a>
					</Badge>
				</div>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Avatar"
				note="A skill owner, with initials standing in when there is no picture."
			>
				<div className="flex flex-wrap items-center gap-8">
					<div className="flex items-center gap-3">
						<Avatar size="lg">
							<AvatarImage alt="A placeholder portrait" src={ownerPortrait} />
							<AvatarFallback>AL</AvatarFallback>
						</Avatar>
						<p className="text-sm text-muted-foreground">With a picture</p>
					</div>
					<div className="flex items-center gap-3">
						<Avatar size="lg">
							<AvatarFallback>SK</AvatarFallback>
						</Avatar>
						<p className="text-sm text-muted-foreground">Initials fallback</p>
					</div>
				</div>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Separator"
				note="The dividers on the skill detail page, in both directions."
			>
				<div className="flex max-w-md flex-col gap-4">
					<p className="text-sm">Above the divider</p>
					<Separator />
					<p className="text-sm">Below it</p>
					<div className="flex h-10 items-center gap-4">
						<span className="text-sm">Left</span>
						<Separator orientation="vertical" />
						<span className="text-sm">Right</span>
					</div>
				</div>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Skeleton"
				note="The loading list and the loading detail page."
			>
				<Card className="max-w-md">
					<CardHeader>
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-56" />
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-4/5" />
					</CardContent>
				</Card>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Empty"
				note="No skills yet, and no results once search exists."
			>
				<Empty className="border border-dashed">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Sparkles aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No skills yet</EmptyTitle>
						<EmptyDescription>
							Once someone publishes a skill it shows up here. Be the first to
							share one.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button size="sm">Publish a skill</Button>
					</EmptyContent>
				</Empty>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Alert"
				note="A callout, and the error state a failed read lands on."
			>
				<div className="flex flex-col gap-3">
					<Alert>
						<CircleAlert aria-hidden="true" />
						<AlertTitle>Heads up</AlertTitle>
						<AlertDescription>
							This is the default callout, for anything worth saying next to the
							content.
						</AlertDescription>
					</Alert>
					<Alert variant="destructive">
						<CircleAlert aria-hidden="true" />
						<AlertTitle>Could not load skills</AlertTitle>
						<AlertDescription>
							The list did not load. Check your connection, then try again.
						</AlertDescription>
					</Alert>
				</div>
			</PrimitiveBlock>

			<PrimitiveBlock
				name="Spinner"
				note="Pending states: on its own, and inside the control that is working."
			>
				<div className="flex flex-wrap items-center gap-8">
					<div className="flex items-center gap-2">
						<Spinner />
						<span className="text-sm text-muted-foreground">
							Fetching skills
						</span>
					</div>
					<Button disabled size="sm">
						<Spinner aria-hidden="true" data-icon="inline-start" />
						Publishing
					</Button>
				</div>
			</PrimitiveBlock>
		</>
	);
}

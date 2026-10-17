import { NOINDEX_HEADER_VALUE } from "./indexing";

/** The brand a page title is built from. */
export const BRAND_NAME = "Skild";

/**
 * The home page's title.
 *
 * It leads with the brand because the page has no subject of its own, while a
 * skill page leads with the skill's name.
 */
export const HOME_TITLE = "Skild · Discover and share AI agent skills";

/** The home page's description, written once so every tag repeats one value. */
export const HOME_DESCRIPTION =
	"Discover, share, and upvote community built AI agent skills, then install them with one command.";

/** One `<meta>` a head can carry. */
type MetaTag =
	| { title: string }
	| { name: string; content: string }
	| { property: string; content: string };

/** One `<link>` a head can carry. */
export type HeadLink = {
	rel: string;
	href: string;
};

/** One `<script>` a head can carry, as the router renders it. */
export type HeadScript = {
	type: string;
	children: string;
};

/** A page's head fragments, in the shape a route's `head` returns. */
export type PageHead = {
	meta: MetaTag[];
	links: HeadLink[];
	scripts?: HeadScript[];
};

/**
 * The home page's head.
 *
 * A filtered catalogue is a distinct page rather than a duplicate of the home
 * page, so it carries `noindex` and no canonical instead of pointing a search
 * engine at an address that is not the one it requested.
 */
export function homeHead(canonicalUrl: string | undefined): PageHead {
	if (canonicalUrl === undefined) {
		return {
			meta: [
				{ title: HOME_TITLE },
				{ name: "description", content: HOME_DESCRIPTION },
				{ name: "robots", content: NOINDEX_HEADER_VALUE },
			],
			links: [],
		};
	}

	return {
		meta: [
			{ title: HOME_TITLE },
			{ name: "description", content: HOME_DESCRIPTION },
		],
		links: [{ rel: "canonical", href: canonicalUrl }],
	};
}

/** The title a skill page carries, with the brand after the skill's own name. */
export function skillTitle(name: string): string {
	return `${name} · ${BRAND_NAME}`;
}

/**
 * A skill page's head: its own title and description, the canonical, and the
 * small social card. No image is emitted because the site ships none.
 */
export function skillHead(input: {
	name: string;
	summary: string;
	url: string;
}): PageHead {
	const title = skillTitle(input.name);

	return {
		meta: [
			{ title },
			{ name: "description", content: input.summary },
			{ property: "og:title", content: title },
			{ property: "og:description", content: input.summary },
			{ property: "og:type", content: "website" },
			{ property: "og:url", content: input.url },
			{ property: "og:site_name", content: BRAND_NAME },
			{ name: "twitter:card", content: "summary" },
		],
		links: [{ rel: "canonical", href: input.url }],
	};
}

/** The values structured data reads from the skill the page renders. */
export type SkillStructuredDataInput = {
	name: string;
	summary: string;
	url: string;
	publisher: string | undefined;
	updatedAt: Date;
	upvoteCount: number;
};

/**
 * A skill page's structured data script.
 *
 * `SoftwareApplication` is the closest schema.org type for a skill, and the
 * category and platform are fixed because every skill in the catalogue is one.
 */
export function skillStructuredData(
	input: SkillStructuredDataInput,
): HeadScript {
	const data = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: input.name,
		description: input.summary,
		url: input.url,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Any",
		dateModified: input.updatedAt.toISOString(),
		...(input.publisher === undefined
			? {}
			: { publisher: { "@type": "Person", name: input.publisher } }),
		interactionStatistic: {
			"@type": "InteractionCounter",
			interactionType: "https://schema.org/LikeAction",
			userInteractionCount: input.upvoteCount,
		},
	};

	return { type: "application/ld+json", children: JSON.stringify(data) };
}

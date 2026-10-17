/**
 * The private paths this app keeps out of an index.
 *
 * One list feeds both the response header rule and the `Disallow` lines the
 * robots file serves, so a path added here cannot be missing from either.
 * `disallow` holds the robots form, where `$` anchors the end of a path that
 * would otherwise read as a prefix of a public one.
 */
const PRIVATE_PATH_RULES = [
	{ path: "/account", disallow: "/account" },
	{ path: "/admin", disallow: "/admin" },
	{ path: "/skills/new", disallow: "/skills/new$" },
	{ path: "/sign-in", disallow: "/sign-in" },
	{ path: "/sign-up", disallow: "/sign-up" },
	{ path: "/design", disallow: "/design" },
] as const;

/** The value every response that must stay out of an index carries. */
export const NOINDEX_HEADER_VALUE = "noindex, nofollow";

/** The `Disallow` lines robots.txt serves, in the same order as the rules. */
export const ROBOTS_DISALLOW_LINES: readonly string[] = PRIVATE_PATH_RULES.map(
	(rule) => `Disallow: ${rule.disallow}`,
);

/** Whether a path belongs to a private area, including everything below it. */
export function isPrivatePath(pathname: string): boolean {
	return PRIVATE_PATH_RULES.some(
		(rule) => pathname === rule.path || pathname.startsWith(`${rule.path}/`),
	);
}

/**
 * Renders the robots file.
 *
 * With no sitemap address it answers the group that disallows everything, which
 * is what any host but the site's own receives. Otherwise it lists the private
 * paths and points at the sitemap.
 */
export function renderRobots(sitemapUrl: string | undefined): string {
	if (sitemapUrl === undefined) {
		return "User-agent: *\nDisallow: /\n";
	}

	return [
		"User-agent: *",
		...ROBOTS_DISALLOW_LINES,
		"",
		`Sitemap: ${sitemapUrl}`,
		"",
	].join("\n");
}

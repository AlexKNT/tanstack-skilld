/** One address in the sitemap, with the date it last changed when one is known. */
export type SitemapEntry = {
	loc: string;
	lastmod?: string;
};

const XML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&apos;",
};

/**
 * Renders a sitemap document.
 *
 * Every address is escaped, so a stored slug can never close a tag. An entry
 * without a date carries a location alone, and no entry carries `changefreq` or
 * `priority` because search engines ignore both.
 */
export function renderSitemap(entries: readonly SitemapEntry[]): string {
	const urls = entries.map((entry) => {
		const lastmod =
			entry.lastmod === undefined
				? ""
				: `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`;

		return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`;
	});

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls,
		"</urlset>",
		"",
	].join("\n");
}

function escapeXml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) => XML_ESCAPES[character] ?? character,
	);
}

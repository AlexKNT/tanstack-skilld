import { createFileRoute } from "@tanstack/react-router";

import { listPublishedSkillEntries } from "#/db/queries";
import { absoluteSiteUrl } from "#/features/seo/site";
import { renderSitemap } from "#/features/seo/sitemap";

/**
 * The sitemap, rendered from the store on each uncached request.
 *
 * The home entry carries a location alone because nothing supplies a timestamp
 * for it. A failed read answers 503 with no body, so a crawler returns later
 * instead of recording an empty site.
 */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const entries = await listPublishedSkillEntries();

				if (!entries.ok) {
					return new Response(null, {
						status: 503,
						headers: { "Cache-Control": "no-store" },
					});
				}

				const body = renderSitemap([
					{ loc: absoluteSiteUrl("/") },
					...entries.value.map((entry) => ({
						loc: absoluteSiteUrl(`/skills/${entry.slug}`),
						lastmod: entry.updatedAt.toISOString().slice(0, 10),
					})),
				]);

				return new Response(body, {
					status: 200,
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});

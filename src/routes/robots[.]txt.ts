import { createFileRoute } from "@tanstack/react-router";

import { renderRobots } from "#/features/seo/indexing";
import { absoluteSiteUrl, isSiteRequestHost } from "#/features/seo/site";

const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * The robots file, answered from the shared private path list.
 *
 * Only the site's own host receives the group that points at the sitemap. Any
 * other host is answered with a disallow everything group that must not be
 * cached, so a cached copy can never follow the site to a different address.
 */
export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: ({ request }) => {
				if (!isSiteRequestHost(request.url)) {
					return new Response(renderRobots(undefined), {
						status: 200,
						headers: { ...TEXT_HEADERS, "Cache-Control": "no-store" },
					});
				}

				return new Response(renderRobots(absoluteSiteUrl("/sitemap.xml")), {
					status: 200,
					headers: {
						...TEXT_HEADERS,
						"Cache-Control": "public, max-age=300",
						Vary: "Host",
					},
				});
			},
		},
	},
});

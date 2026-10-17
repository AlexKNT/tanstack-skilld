import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createMiddleware, createStart } from "@tanstack/react-start";

import { isPrivatePath, NOINDEX_HEADER_VALUE } from "#/features/seo/indexing";
import { isSiteRequestHost } from "#/features/seo/site";

/** The two paths whose answers are files a crawler reads rather than pages. */
const CRAWL_PATHS = new Set(["/sitemap.xml", "/robots.txt"]);

/**
 * Answers a server function call that produced no response.
 *
 * A server function request normally resolves to a response, and Clerk's
 * middleware appends its own response headers onto `result.response` once the
 * chain returns. A call that arrives without the `x-tsr-serverFn` header the
 * app's own client sends is answered with the bare value instead, so that
 * append reads a property of nothing and the request dies as an unhandled 500.
 * This middleware sits directly after Clerk's, so whatever the chain returns
 * reaches Clerk in the shape it expects, and a request the app client did not
 * send is refused by name rather than as an internal failure.
 */
const responseShapedResult = createMiddleware().server(async ({ next }) => {
	const result = await next();

	if (result instanceof Response || result.response !== undefined) {
		return result;
	}

	return {
		...result,
		response: new Response(
			JSON.stringify({
				status: 400,
				message: "This request did not come from the app client.",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		),
	};
});

/**
 * Shapes every response for a crawler.
 *
 * It sits before Clerk's middleware so it sees the response Clerk has finished
 * with, which is the only place the session cookie Clerk appends can be taken
 * back off the two crawl files. It marks a private path, a page that failed,
 * and every response on a host that is not the site's own as `noindex`, so a
 * redirect from a guarded route carries the header too, which a route head
 * could not do.
 */
const crawlHeaders = createMiddleware().server(async ({ request, next }) => {
	const result = await next();
	const response = result instanceof Response ? result : result.response;

	if (!(response instanceof Response)) {
		return result;
	}

	const url = new URL(request.url);
	const mustNotIndex =
		!isSiteRequestHost(url) ||
		isPrivatePath(url.pathname) ||
		response.status >= 400;

	const shaped = withHeaders(response, (headers) => {
		if (mustNotIndex) {
			headers.set("X-Robots-Tag", NOINDEX_HEADER_VALUE);
		}

		if (CRAWL_PATHS.has(url.pathname)) {
			headers.delete("Set-Cookie");
		}
	});

	return result instanceof Response ? shaped : { ...result, response: shaped };
});

/**
 * Applies header changes to a response, replacing it when its headers cannot be
 * written.
 *
 * A redirect created by `Response.redirect` has an immutable header list, and
 * those are exactly the responses this rule has to mark, so the fallback builds
 * a fresh response around the same body.
 */
function withHeaders(
	response: Response,
	apply: (headers: Headers) => void,
): Response {
	try {
		apply(response.headers);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		apply(headers);

		const body =
			response.status === 204 || response.status === 304 ? null : response.body;

		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

export const startInstance = createStart(() => {
	return {
		requestMiddleware: [crawlHeaders, clerkMiddleware(), responseShapedResult],
	};
});

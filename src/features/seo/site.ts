/**
 * The address a development run uses when `VITE_SITE_URL` is absent.
 *
 * Kept as a constant so the local fallback is one value rather than a literal
 * repeated at every caller.
 */
export const DEVELOPMENT_SITE_URL = "http://localhost:3000";

/** The environment variable that carries the site's address. */
const SITE_URL_VARIABLE = "VITE_SITE_URL";

const DEV = import.meta.env.DEV;

/**
 * Validates a configured address and reduces it to its origin.
 *
 * An absent address is allowed only in development, where it falls back to the
 * local server, so a production build never invents one. A malformed value
 * names the variable, because the person who set it needs to know which one to
 * fix.
 */
export function resolveSiteUrl(
	raw: string | undefined,
	isDevelopment: boolean,
): string {
	const value = raw?.trim() ?? "";

	if (value === "") {
		if (isDevelopment) {
			return DEVELOPMENT_SITE_URL;
		}

		throw new Error(
			`${SITE_URL_VARIABLE} is missing. Set it to the site's absolute address, for example https://skild.example.com, then rebuild.`,
		);
	}

	let url: URL;

	try {
		url = new URL(value);
	} catch {
		throw new Error(
			`${SITE_URL_VARIABLE} is not a valid absolute address: "${value}".`,
		);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(
			`${SITE_URL_VARIABLE} must start with http:// or https://: "${value}".`,
		);
	}

	if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
		throw new Error(
			`${SITE_URL_VARIABLE} must be an origin alone, with no path, query, or hash: "${value}".`,
		);
	}

	return url.origin;
}

/**
 * Reads the configured address once, at module load.
 *
 * The module is imported by the server entry, so a missing or malformed value
 * in a production build fails as the server starts rather than on the first
 * request. It is also imported by route heads, which run in the browser too, so
 * the value is read through the build rather than the process environment.
 */
export const SITE_URL = resolveSiteUrl(readConfiguredSiteUrl(), DEV);

const SITE_HOST = new URL(SITE_URL).host;

/**
 * Builds an absolute address on the configured site.
 *
 * A path without a leading slash is joined the same way, so a caller cannot
 * produce `https://example.comskills` by leaving one off.
 */
export function absoluteSiteUrl(path: string): string {
	const normalized = path.startsWith("/") ? path : `/${path}`;

	return new URL(normalized, `${SITE_URL}/`).toString();
}

/**
 * Whether a request arrived on the site's own host.
 *
 * The comparison reads the host and port, not the scheme, so a preview on the
 * same name at another port is not mistaken for the real site. Behind a proxy
 * that rewrites the host this fails closed: the response is marked `noindex`
 * rather than indexed at the wrong address.
 */
export function isSiteRequestHost(requestUrl: string | URL): boolean {
	const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;

	return url.host === SITE_HOST;
}

function readConfiguredSiteUrl(): string | undefined {
	const value: unknown = import.meta.env.VITE_SITE_URL;

	return typeof value === "string" ? value : undefined;
}

import "./load-env.server";

/**
 * Reads the Postgres connection string from the environment.
 *
 * This is the one place that knows the variable's name, so a missing value
 * fails loudly and names the variable rather than surfacing later as a
 * confusing connection error. Call it at the edge of a server only entry
 * point, never at module scope of a shared file.
 */
export function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;

	if (!url || url.trim() === "") {
		throw new Error(
			"DATABASE_URL is missing. Add the Postgres connection string to .env.local (see .env.example) and try again.",
		);
	}

	return url;
}

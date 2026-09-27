import { drizzle } from "drizzle-orm/node-postgres";

import { getDatabaseUrl } from "./env.server";
import * as schema from "./schema";

/**
 * The Postgres connection, created on first use and reused after that.
 *
 * The connection string is read here rather than at module scope so importing
 * this module never throws during a build; the first query pays that cost and
 * fails with the named variable when it is missing.
 */
function createDatabase() {
	return drizzle(getDatabaseUrl(), { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

/** Returns the shared Drizzle client, creating it on the first call. */
export function getDatabase() {
	database ??= createDatabase();
	return database;
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getDatabaseUrl } from "./env.server";
import * as schema from "./schema";

/**
 * The Postgres connection, created on first use and reused after that.
 *
 * The connection string is read here rather than at module scope so importing
 * this module never throws during a build; the first query pays that cost and
 * fails with the named variable when it is missing.
 *
 * A small pool and a short idle timeout keep one serverless instance from
 * holding the driver default of ten connections, and release idle ones before
 * the host reclaims the instance.
 */
function createDatabase() {
	const pool = new Pool({
		connectionString: getDatabaseUrl(),
		max: 3,
		idleTimeoutMillis: 10_000,
	});

	return drizzle(pool, { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

/** Returns the shared Drizzle client, creating it on the first call. */
export function getDatabase() {
	database ??= createDatabase();
	return database;
}

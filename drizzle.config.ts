import { defineConfig } from "drizzle-kit";

import "./src/db/load-env.server";

/**
 * Drizzle Kit's configuration.
 *
 * `generate` only reads the schema, but this file is also loaded by `migrate`,
 * which needs a live connection. The placeholder below exists so `db:generate`
 * works before a database exists. `migrate` does not use this value: it runs
 * through the app's own validated reader, so a real connection string is still
 * required there and a missing one still fails loudly, naming the variable.
 */
export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder",
	},
});


import { config } from "dotenv";

/**
 * Loads the local environment files into `process.env`.
 *
 * Vite reads `.env.local` for the dev server and the build, but the command
 * line tools (drizzle-kit and the seed script) run outside Vite and would
 * otherwise see nothing. The files are read in order and an existing value is
 * never overwritten, so a host's own variables always win over a local file.
 */
config({ path: [".env.local", ".env"], quiet: true });

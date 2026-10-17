# 0012. Rationale

_Decision record for [index.md](./index.md): the context, the options considered, and the reasoning behind the choice._

## Context

The app is feature complete and runs only on the developer's machine. `npm run build` produces `dist/client` and `dist/server/server.js`, and nothing in the repository describes where those files should run, which values the host needs, or what happens to the last good deploy when a new one fails. Until that is decided, the scope's "Deploy" feature cannot start, and the site cannot be shown or used anywhere but locally.

The shape of the app narrows the problem. The server holds a Node Postgres pool (`pg`), Clerk middleware and a CSRF middleware run on every request, and two routes answer crawl files. The server therefore needs a Node runtime with outbound TCP to the Supabase pooler, not a static file host. Clerk, PostHog, and Postgres are already hosted elsewhere, so the only new account is the application host itself.

Two build facts drive the configuration more than any provider feature. First, `VITE_SITE_URL` is read through `import.meta.env`, so it is fixed into the bundle at build time, and the built server refuses to start without it. That is one step too late for a deploy: the build can succeed, the deploy can go live, and only then does the failure appear. This spec adds a build time guard for that reason. Second, every `VITE_` value is public by construction, so `DATABASE_URL` and `CLERK_SECRET_KEY` must never be renamed into that namespace. A host that cannot keep build time and runtime values distinct would put the project back at risk.

The database is already hosted. The Supabase pooler host names `eu-west-1`, so the function region can sit beside it. The server opens a Node Postgres pool, and node-postgres defaults to a maximum of 10 connections per instance, which is too many when every function instance keeps its own.

The repository already has a one branch workflow and a CI job that runs lint, typecheck, the test command, and a build on every push to main. The remaining choice is where the built app runs, and how much of that CI work the host should repeat.

## Options considered

### Option 1: Netlify with its TanStack Start adapter

Netlify maintains an adapter for TanStack Start. The adapter turns the Vite build into a Netlify function plus static assets, and the site connects directly to the GitHub repository. Values are set in the dashboard, split into build time and runtime, and the deploy history keeps every build so a previous one can be restored.

**Pros**:

- A maintained adapter for this exact framework, so the Vite configuration stays small.
- Node functions can hold the existing `pg` pool and reach Supabase over TCP with no extra product.
- Free tier covers a learning build, with environment variables, deploy history, and rollback in the dashboard.
- A failed build leaves the live site untouched by default.
- Functions can run in `eu-west-1`, beside the database.

**Cons**:

- One more build dependency, and its configuration follows the TanStack Start release in use.
- The adapter's conventions hide some of what happens at deploy time, so the first deploy needs a careful look at the build log.
- The free tier's function limits and cold starts are real constraints, even if they are unlikely to bite here.

### Option 2: Vercel with the Nitro adapter

Vercel runs the same Node workload well, and its dashboard has strong logs and rollback. TanStack Start reaches Vercel through the Nitro build plugin rather than a Vercel maintained adapter.

**Pros**:

- Excellent function runtime, logs, and preview story.
- Node functions reach the Supabase pooler the same way.

**Cons**:

- The Start integration is a community or framework side adapter rather than a host maintained one, so a Start upgrade can move under the project without a Vercel release note.
- The free tier's commercial use terms are easier to trip than Netlify's for a project that may grow.
- Nothing in this app needs what Vercel does better, so the extra adapter risk buys nothing here.

### Option 3: Cloudflare Workers with the official adapter

Cloudflare has an official TanStack Start adapter and a very fast edge runtime. Postgres over TCP is reached through Hyperdrive, a connection proxy in front of the database.

**Pros**:

- Fast responses worldwide and a generous free tier.
- Official framework support.

**Cons**:

- The app uses a Node Postgres pool directly, so it would need Hyperdrive configured for the Supabase pooler, plus Node compatibility flags. That is a second moving part and a new failure surface for a learning build.
- The Clerk and `pg` behaviour on Workers differs enough from Node that the first deploy would be spent debugging the runtime, not shipping.
- The benefit, global edge latency, is not a problem this app has.

### Option 4: Railway or Render running a plain Node service

Either provider runs the built server as an ordinary long lived Node process, which suits a `pg` pool better than a serverless function does. Neither ships a TanStack Start adapter, so the project would add a small server entry and a start command.

**Pros**:

- No serverless limits, and one process holds one pool.
- Simple mental model: a process, a port, an environment.

**Cons**:

- The custom server entry is new code in the repository that must be kept in step with the Start build output.
- Deploy history and rollback are less immediate than Netlify's one click restore.
- No adapter means the first deploy is hand assembled, and every Start upgrade is a manual check.

## Rationale

Netlify wins because it is the option that needs the least new code and the least new operational knowledge. The app's server needs a Node runtime with a TCP connection to Postgres, and Netlify's functions provide that without Hyperdrive or a custom server. Its adapter is maintained by the host, which matters on a project that is still learning the framework: when TanStack Start moves, the adapter is the host's problem rather than one more thing to maintain here. The dashboard also covers the operational half of the acceptance criteria directly, with separate build time and runtime values and a deploy history that restores a previous build.

Vercel was the closest runner up, and it would work. It lost on integration ownership and free tier terms, not on capability. Cloudflare was rejected because the `pg` pool would need Hyperdrive, which turns a deploy feature into a database proxy project. Railway and Render would handle the pool best, but they need a server entry this repository does not have, and that entry is exactly the kind of hand maintained glue that a host maintained adapter removes.

Several smaller calls were made with the same reasoning. Production only, because previews would need a second Clerk instance and a second site address, and neither buys anything for a single developer. The existing Supabase database, because the seed is already there and a separate database would turn this into a migration and seed feature. The existing PostHog project, because the client already sends each event's current URL, so local and live events stay separable without a second project. The Clerk development instance for now, because a production instance needs a domain you control, and a domain was explicitly out of scope. Manual migrations, because the live database is the one used locally, and an automatic migration on a push would be the fastest way to break a site nobody is watching.

One more pipeline was considered and rejected: build once in CI, then deploy the artifact with the Netlify CLI. It would remove the split between the CI build and the Netlify build, and make rollback structural. It also adds a Netlify token to GitHub secrets and a second place to watch a deploy, for a project with one developer and one site. The dashboard build keeps the whole deploy in one screen, which matters more here than removing the duplicate build.

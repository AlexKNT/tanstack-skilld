# 0012. Deploy the app to Netlify

**Date**: 2026-10-17
**Status**: In Progress

## Summary

The app only runs on your machine today. This decision puts it on Netlify, connected to the GitHub repository, so every push to main builds and goes live at a public address. Netlify builds with Node 24, keeps the secrets in its dashboard, and holds the last good deploy so one click restores it. The live site keeps the existing Clerk development instance, the existing Supabase database, and the existing PostHog project.

## Requirements

**User stories**:

- As the person building Skild, I want a push to main to put the app on a public address, so that I can use and show it from anywhere.
- As a visitor, I want sign in, browsing, publishing, and the analytics choice to work on the live site exactly as they do locally.
- As the owner, I want a failed build to leave the last good deploy serving, so that a mistake never takes the site down.
- As a future maintainer, I want the production variables documented in the repository, so that a deploy can be reproduced without reading my local machine.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: A push to main produces a Netlify production deploy. When it finishes, the site's primary address answers 200 and serves the home page rendered on the server, not a blank client shell.
- **AC-2**: The production build runs with `VITE_SITE_URL` set to the site's primary address, exactly, with no trailing path. `/robots.txt` allows crawling, every public page's canonical points at that origin, and `/sitemap.xml` lists absolute addresses on it.
- **AC-3**: Sign in and sign up complete on the live site against the existing Clerk development instance, and a signed in visitor reaches the account area. `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` come from that same instance.
- **AC-4**: The live home page lists skills from the existing Supabase database, a skill detail page renders at its own address, and a signed in visitor can publish a skill that persists and appears in the catalogue.
- **AC-5**: With consent accepted, a pageview from the production address reaches the existing PostHog project, and the event's automatic current URL property carries the production host, so live and local events are distinguishable. With no consent stored, no request reaches the PostHog host.
- **AC-6**: No secret reaches the browser or the repository. `DATABASE_URL` and `CLERK_SECRET_KEY` appear nowhere in the client output, and no production value is committed.
- **AC-7**: A build that fails never replaces the live deploy. The previous successful deployment keeps serving, and the Netlify dashboard can restore it without a code change.
- **AC-8**: A production build with `VITE_SITE_URL` absent fails before a deploy exists, with an error naming the variable. A server started without `DATABASE_URL` answers on the app's error surface while its log names the variable, rather than serving an empty catalogue. The same build and start with both values present succeed.
- **AC-9**: The build image and the function runtime use Node 24, matching CI and `@types/node`, and the build command is `npm run build` with no migration step attached.
- **AC-10**: The repository documents every production variable: the four Clerk routing variables and the PostHog pair are named in `.env.example`, and the README has a deploy section with the variable table, the manual migration rule, and the rollback path.

## Decision

**Chosen option**: Option 1: Netlify with its TanStack Start adapter

Netlify builds the app on every push to main, runs it on Node 24 serverless functions in `eu-west-1`, and keeps the values in dashboard environment variables. The live site uses the existing Clerk development instance, the existing PostHog project, and the existing Supabase database.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`)

## Feature design

**Data model sketch**: No schema change and no new entity. The deploy reads and writes the existing tables only.

**State transitions**:

```
push to main -> build running -> build succeeded -> live
                              -> build failed    -> previous live deploy keeps serving
live -> restore previous deploy (Netlify dashboard) -> live
```

No automatic migration runs in any transition. Schema changes are applied by hand against the production database before a push that needs them.

**API surface**: no new endpoint. The deploy must keep these existing surfaces answering:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/` | GET | `q` and `tag` search params | catalogue HTML from the database | public | 500 when the read fails |
| `/skills/$slug` | GET | slug path param | detail page, metadata, structured data | public | 404 when hidden or absent |
| `/sign-in/$`, `/sign-up/$` | GET | `redirect` param | Clerk UI | public | none expected |
| `/account/*`, `/admin/skills` | GET | Clerk session cookie | guarded pages | session, admin role for `/admin` | redirect to sign in when signed out |
| `/sitemap.xml`, `/robots.txt` | GET | none | XML, plain text | public | 503 when the sitemap read fails |
| server functions (`listSkills`, `createSkill`, upvote, moderation) | POST | JSON body, session cookie | JSON result with an explicit status | per function, session required for writes | the existing explicit failure codes |

**Value sourcing** (every value each action produces, computes, or displays names where it comes from):

| Action | Value produced / displayed | Source |
|---|---|---|
| Create the site | the primary address every other value depends on | the site name chosen at creation, `skild` if free, recorded before the first build |
| Build the client bundle | site origin, Clerk publishable key, PostHog token and host | `VITE_SITE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_POSTHOG_PROJECT_TOKEN`, `VITE_POSTHOG_HOST` set in the Netlify dashboard with the Builds scope and inlined at build |
| Build the client bundle | Clerk's in app sign in and sign up addresses | the four `VITE_CLERK_*` routing variables, copied from `.env.local` |
| Serve a request or a server function | database connection | `DATABASE_URL` in the Netlify dashboard with the Functions scope, kept secret |
| Serve a request | the request host used by the noindex rule | the request URL as the function receives it, confirmed in build task 2 |
| Verify a session | Clerk secret key | `CLERK_SECRET_KEY` in the Netlify dashboard with the Functions scope, kept secret |
| Guard `/admin/skills` | the admin role | Clerk user `public_metadata.role` set to `admin` for the live account |
| Answer `/robots.txt` and `/sitemap.xml` | the allowed host, absolute addresses | derived from `VITE_SITE_URL` through `SITE_URL` |
| Deploy | Node version | `.nvmrc` at the repository root, value `24` |
| Deploy | function region | `netlify.toml`, value `eu-west-1` |
| Call an event | the host in the event's automatic current URL | derived from the production address by PostHog |
| Log a PostHog entry | the environment label | the Vite build mode, `production` |

**Key invariants**:

- `VITE_SITE_URL` equals the address visitors actually use, with no trailing path. Otherwise every response carries the noindex header and the canonicals point at the wrong origin.
- The site name is fixed before the first build. Renaming the site means updating `VITE_SITE_URL` and rebuilding.
- The build fails when `VITE_SITE_URL` is absent, through a guard in `vite.config.ts` that reads the build environment, so a broken build never becomes a deploy.
- `DATABASE_URL` and `CLERK_SECRET_KEY` are never prefixed with `VITE_` and never reach the browser.
- No production value lives in the repository. `.env.example` carries names and purpose only.
- The Postgres pool is created explicitly with `max: 3` and a short idle timeout, so a function instance cannot hold the driver default of 10 connections.
- Deploy previews and branch deploys are off, so every deploy is production and no preview can write to the live database.
- The deploy never runs a migration.
- The build runs on Node 24.

**Security model**:

- Secrets live only in the Netlify dashboard. `DATABASE_URL` and `CLERK_SECRET_KEY` are server side, and the `VITE_` values are public by design.
- HTTPS is terminated at Netlify, and every address Netlify serves is HTTPS only.
- The existing origin check, CSRF middleware, host check, and noindex rule stay in force. The host check fails closed on an address that is not the configured site.
- Writes stay behind Clerk: publishing and upvoting require a session, and hiding a skill requires the owner or the admin role.
- The Clerk development instance is a deliberate tradeoff. It works on any domain, but it shows a development badge and carries usage limits, so this site must not hold real user data.
- Deploy previews are off because a preview would run the same development Clerk instance against the live database, under a host the crawl rules mark noindex.
- The live site uses the same Supabase database as local development, so a local experiment writes live data. This is accepted for the learning build and recorded as a follow up.

**Configuration required** (every value set in the Netlify dashboard, with the scope shown):

| Variable | Scope | Read at | Value | Secret |
|---|---|---|---|---|
| `VITE_SITE_URL` | Builds | build | the primary address, origin only | no |
| `VITE_CLERK_PUBLISHABLE_KEY` | Builds | build | the existing Clerk development instance | no |
| `VITE_CLERK_SIGN_IN_URL` | Builds | build | `/sign-in` | no |
| `VITE_CLERK_SIGN_UP_URL` | Builds | build | `/sign-up` | no |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Builds | build | `/` | no |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Builds | build | `/` | no |
| `VITE_POSTHOG_PROJECT_TOKEN` | Builds | build | the existing PostHog project token | no |
| `VITE_POSTHOG_HOST` | Builds | build | `https://eu.i.posthog.com` | no |
| `CLERK_SECRET_KEY` | Functions | runtime | the same Clerk instance | yes |
| `DATABASE_URL` | Functions | runtime | the existing Supabase session pooler string, in `eu-west-1` | yes |
| `.nvmrc` | repository file | build and functions | `24` | no |

`.env.local` also holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, which no code reads. They are not copied to Netlify. The site name is chosen when the site is created (`skild` if free), and it fixes the primary address used by every value above.

**Critical test scenarios** (each maps to an acceptance criterion in Requirements):

- Happy path: a push to main builds, deploys, and the live home page lists seeded skills, verifies **AC-1**, **AC-4**
- Failure case: a production build with `VITE_SITE_URL` absent fails before a deploy exists, and the previous deploy stays live, verifies **AC-7**, **AC-8**
- Auth and permission: a signed out visitor is sent to sign in from `/account`, and `/admin/skills` refuses a visitor without the admin role, verifies **AC-3**
- Host preservation: a request to the primary address keeps its host through the function layer, so `/robots.txt` allows crawling and no page is marked noindex by mistake, verifies **AC-2**
- Analytics consent: no PostHog request before consent, one pageview after whose current URL carries the production host, verifies **AC-5**

## Build plan

Tracer bullet ordering: task 1 adds the adapter and the config, task 2 proves the whole pipe from a push to a page answering, then each remaining task thickens one layer.

1. [x] The deploy adapter and its config: `@netlify/vite-plugin-tanstack-start` added to `devDependencies` with a caret version and the lockfile committed, registered in `vite.config.ts` after `tanstackStart()`, a `netlify.toml` with `command = "npm run build"`, `publish = "dist/client"`, and the functions region `eu-west-1`, `.nvmrc` with `24`, `@types/node` moved to 24, and the build guard in `vite.config.ts` that fails a production build when `VITE_SITE_URL` is absent. Also change the `DATABASE_URL` error message so it says environment rather than `.env.local`, and give CI a placeholder `VITE_SITE_URL` so its build still passes. Satisfies **AC-8**, **AC-9**
2. The thin thread: create the site (`skild` if free), turn off deploy previews and branch deploys, set the Builds and Functions values, deploy, then confirm the home page answers on the primary address and that the function sees that host in the request URL. Satisfies **AC-1**, **AC-2**
3. The Clerk path on the live host: sign in and sign out, reach `/account`, confirm a guarded server function sees the session, and set `public_metadata.role` to `admin` on the live account so `/admin/skills` opens. Add the site address to the Clerk instance if it refuses the origin. Satisfies **AC-3**
4. The database path on the live host: create the pool explicitly with `max: 3` and a short idle timeout, then open a seeded skill, sign in, publish a skill, and confirm it appears in the catalogue and survives a reload. Satisfies **AC-4**
5. The analytics path on the live host: confirm no request to the PostHog host before consent, accept the notice, and confirm the batch arrives with the production host in its current URL. Satisfies **AC-5**
6. The crawl and secret pass: `/robots.txt` allows, the sitemap and canonicals use the primary address, a private path and a non site host answer with noindex, and a recursive search of the built client assets finds neither the database host nor the Clerk secret. Satisfies **AC-2**, **AC-6**
7. The failure rehearsal away from the live site: run a production build without `VITE_SITE_URL` and confirm it fails with the named error, then run the built app through `netlify dev` without `DATABASE_URL` and confirm the error surface plus the named log line. Then rehearse a dashboard rollback and the environment value recovery that goes with it. Satisfies **AC-7**, **AC-8**
8. [x] The documentation pass: add the four Clerk routing variables and the PostHog pair to `.env.example` with their purpose, and add a deploy section to the README with the variable table and its scopes, the manual migration rule, the rollback steps, and how to restore an environment value. Satisfies **AC-10**

## Consequences

**Positive**:

- Every push to main ships without a local build or an upload step.
- The secrets live in one dashboard, and the deploy log names every variable the build and functions received, while secret values stay hidden.
- A bad deploy is one click away from the last good one.
- The production build exercises the same production path that the crawl rules and the site address validation were written for.

**Negative / tradeoffs**:

- Serverless functions keep a connection pool per instance. An explicit `max: 3` keeps the damage bounded, but cold starts and connection bursts are now real, and the database must stay on the Supabase pooler.
- The Clerk development instance shows its badge on the live site and carries limits, so this site is not ready for real users until a production instance replaces it.
- The same Supabase database serves local development and the live site, so a local test writes live data, and a local schema push can break the live site.
- `VITE_` values are inlined at build time, so changing one needs a redeploy, not just an environment save.
- A rollback restores code, not environment values. A wrong `DATABASE_URL` breaks the restored deploy too, so the recovery steps are part of the rollback rehearsal.
- Migrations stay manual, so a missing migration reaches the live site as a query error rather than a blocked deploy.
- With previews off, a change has no preview host to try before it reaches production. The tradeoff buys a single environment with one set of values and no preview writes to the live database.
- The sitemap caches for an hour, so a newly published skill can take up to that long to appear in it.
- If Netlify's build image does not offer Node 24, the deploy falls back to its newest LTS, and CI plus `@types/node` must move with it.
- The Netlify adapter is one more dependency in the build, and its configuration moves with the TanStack Start release in use.

**Neutral**:

- Functions run in `eu-west-1`, beside the Supabase pooler, which is also in `eu-west-1`, so a query stays in one region.
- Analytics events from the live site and from local development land in the same PostHog project, separated by the host in each event's current URL.
- The existing production guards stay as they are: the design gallery shows its notice outside development, and reading PostHog variables that are absent leaves analytics off rather than failing the page.

## Follow-up

- [ ] Move Clerk to a production instance once a domain exists. Clerk's frontend API needs DNS records on a domain you control, and the keys then swap with no code change.
- [ ] If Netlify's build image does not offer Node 24, take its newest LTS and pin CI and `@types/node` to the same version.
- [ ] Consider a separate database for the live site when its data becomes worth protecting. That changes this spec's migration and seed steps.
- [ ] Reconsider automatic migrations, as a GitHub Actions job with approval, if schema changes start reaching the live site often.
- [ ] Confirm the adapter package and its `dist/client` publish directory against the current Netlify TanStack Start guide during build task 1. If either differs, update build task 1 and the matching verify steps.
- [ ] The TanStack packages resolve `latest`, so a fresh Netlify install can pick a version CI never built. Pin them once this deploy is proven.
- [ ] A custom domain would remove the Clerk development badge and make the site address stable across hosts.
- [ ] Agent skills and MCP servers for Netlify were deferred. A Netlify skill or MCP server would let the agent read deploys and environment variables directly.

## Rationale

Reasoning, options, and the rejected alternatives: see [rationale.md](./rationale.md).

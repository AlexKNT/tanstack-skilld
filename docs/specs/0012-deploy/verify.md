# Verify: deploy · spec 0012 · updated 2026-10-17

_Steps derived from spec 0012 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict: not yet run.** No deploy exists until the build plan lands.

## Deploy and runtime

- [ ] Push a commit to main, watch the Netlify build, then request the primary address → the build succeeds, the deploy log shows Node 24 for the build image and the function runtime, and the address answers 200 with the catalogue in the served HTML, not a blank shell → AC-1, AC-9
- [ ] Open the deploy log → the build command is `npm run build`, and no migration command runs → AC-9
- [ ] Request `/robots.txt` on the primary address → the allow rule applies, which proves the function saw the configured host in the request URL → AC-2
- [ ] Open the site settings → deploy previews and branch deploys are off → AC-1
- [ ] Request `/` → skills from the Supabase database are listed with their owners → AC-4
- [ ] Open a skill card → the detail page renders at `/skills/<slug>` with its metadata → AC-4
- [ ] Sign in with an existing account → the session is accepted and the header shows the user → AC-3
- [ ] Open `/account` signed in, then signed out → the signed in view lists the user's skills, and the signed out request is redirected to sign in → AC-3
- [ ] Open `/admin/skills` without the admin role, then with it → the first is refused and the second lists every skill → AC-3
- [ ] Publish a skill on the live site → it appears in the catalogue, survives a reload, and is readable directly from the database → AC-4

## Analytics

- [ ] In a fresh browser with no consent, browse `/` and a skill page with the network panel open → no request reaches the PostHog host and no analytics storage key is written → AC-5
- [ ] Accept the cookie notice, then open a page → a pageview reaches the PostHog host, and the event in the PostHog project carries the production host in its current URL property, which separates it from a local event → AC-5

## Crawl rules

- [ ] `curl -s https://<site>/robots.txt` → the allow rule applies, the noindex host rule does not, and the sitemap address uses the primary address → AC-2
- [ ] `curl -s https://<site>/sitemap.xml` → entries are absolute addresses on the primary address, and a skill published less than an hour ago may still be missing because the file caches for an hour → AC-2
- [ ] View source of `/` → the canonical is the primary address, with no path or trailing slash beyond the origin → AC-2
- [ ] `curl -sI https://<site>/account` → a redirect to sign in carrying `X-Robots-Tag` with `noindex` → AC-2
- [ ] Run the production build locally with `VITE_SITE_URL` set to the live address, then request `http://localhost:3000/` → `X-Robots-Tag` with `noindex`, because the host does not match the configured site → AC-2

## Secrets

- [ ] Search the built client assets recursively for the Supabase pooler host and for the Clerk secret key prefix → no match → AC-6
- [ ] Confirm no `VITE_` variable holds a database or Clerk secret, and that the two unused `VITE_SUPABASE_*` names are absent from Netlify → AC-6
- [ ] Inspect the served HTML and the browser network panel → neither `DATABASE_URL` nor `CLERK_SECRET_KEY` appears → AC-6
- [ ] Search the repository for the production values → no match, and `.env.local` stays untracked → AC-6

## Failure and rollback

- [ ] Run a production build locally with `VITE_SITE_URL` absent → it fails before any deploy exists, and the message names `VITE_SITE_URL` → AC-8
- [ ] Deploy a commit with `VITE_SITE_URL` removed from the Builds scope → the build fails and the live site keeps serving the previous deploy → AC-7, AC-8
- [ ] Run the built app through `netlify dev` with `DATABASE_URL` absent, then request `/` → the visitor sees the app's error surface and the log names `DATABASE_URL`, with no empty catalogue served → AC-8
- [ ] Restore the previous deploy from the Netlify dashboard → the previous build serves again with no code change → AC-7
- [ ] Rehearse recovering an environment value: change one value, observe the failure, restore it, then confirm a redeploy recovers, and that a rollback alone does not → AC-7

## Documentation

- [ ] Read `.env.example` → all four Clerk routing variables and the PostHog pair are named with their purpose, and no value is real → AC-10
- [ ] Read the README deploy section → it names the host, the Builds and Functions variables, the manual migration rule, the rollback path, and environment value recovery → AC-10

## Commands

- [ ] `npm run check` → no errors
- [ ] `npm run typecheck` → no errors
- [ ] `$env:VITE_SITE_URL="https://<site>"; npm run build` → succeeds, and `dist/client` plus `dist/server` exist
- [ ] `$env:VITE_SITE_URL=""; npm run build` → fails with the named `VITE_SITE_URL` error
- [ ] `Select-String -Path dist/client/**/*.js -Pattern '<supabase-pooler-host>' -Recurse` → no match
- [ ] `Select-String -Path dist/client/**/*.js -Pattern '<clerk-secret-prefix>' -Recurse` → no match
- [ ] `Get-Content .nvmrc` → `24`
- [ ] `netlify.toml` exists and carries `command = "npm run build"`, `publish = "dist/client"`, and the region `dub` (Netlify's airport code for EU Ireland; the spec's `eu-west-1` names the same region)

## Acceptance-criteria coverage

- **AC-1**: the first deploy step and the 200 response with server rendered HTML
- **AC-2**: the robots, sitemap, canonical, private path, and wrong host steps
- **AC-3**: the sign in, account, admin, and sign out steps
- **AC-4**: the catalogue, detail, and publish steps
- **AC-5**: the two analytics steps before and after consent
- **AC-6**: the three secret steps
- **AC-7**: the failed deploy and the dashboard restore
- **AC-8**: the missing `VITE_SITE_URL` build, the `netlify dev` start without `DATABASE_URL`, and the named log line
- **AC-9**: the Node version line in the deploy log, the function runtime, and the build command
- **AC-10**: the `.env.example` and README steps

## Build task 1 results (2026-10-17)

- Confirmed `@netlify/vite-plugin-tanstack-start` (`^1.3.19`) and its `dist/client` publish directory against the current Netlify guide.
- `npm run build` without `VITE_SITE_URL` fails naming the variable; with it the build succeeds and produces `dist/client`, `dist/server`, and `.netlify/v1/functions/server.mjs`.
- Starting without `DATABASE_URL` shows the catalogue error surface and logs the named variable.
- A scan of `dist/client` found neither the Supabase pooler host nor the Clerk secret.
- The Netlify config parser resolves the functions region as `dub`. Netlify names regions by airport code, so read the spec's `eu-west-1` as `dub`.

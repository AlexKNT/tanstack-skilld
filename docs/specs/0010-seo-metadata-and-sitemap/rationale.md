# 0010. Rationale

_Decision record for [index.md](./index.md): the context, the options considered, the reasoning, and the references behind the choice._

## Context

> ⚠️ Premise note: none of this can be verified in the wild until deploy lands (scope feature 10), and this spec assumes a site address that no existing spec fixes. The work is still worth doing now, because it is cheap while the route set is small and every later page shape would otherwise have to be revisited, and because the host rule below is the thing that stops the first preview deployment from being indexed and then competing with the real site. Treat the address as configuration to be set at deploy time rather than something this feature can confirm.

Skild is a public catalogue that anyone may read, and TanStack Start already renders every page to HTML on the server, so a crawler with no JavaScript receives the whole page. What it receives is one shared title, no description, no canonical (the address a page declares as its own, so near duplicates do not split their standing), and no address for a page's own name. Only `src/routes/__root.tsx` and the development only design gallery set a head at all, and a favicon is absent too. A person searching for a named skill therefore has one undifferentiated result to choose from, and two different skills look identical in a result list.

The store is the only source of truth for what is public. Spec 0009 put the published only rule in one place, `publishedOnly()` in `src/db/queries.ts`, and every public read calls it, so a hidden skill is invisible to the catalogue and its detail page answers as if it were never stored. Nothing outside the app knows that, though. A crawler that indexed a skill before it was hidden keeps showing it until something tells it otherwise, and a sitemap is the cheapest such signal.

Every absolute address needed here, a canonical, a sitemap entry, a social URL, depends on a site address the app has nowhere. There is no `public/` folder, no robots file, no sitemap, and no site URL in the environment. Deploy is two features away and has no spec, so the address has to be configuration with a documented fallback for local work rather than a value baked into the source now.

The cost of not deciding is quiet and compounding: every skill competes for one title, a hidden skill can stay in a result page indefinitely, a preview deployment can be indexed and then compete with the real site, and each new page shape built before this lands is one more place to revisit.

## Options considered

### Option 1: A route head per page, and two server routes that read the store

Each route declares its own metadata through the router's `head` function, which the server evaluates while rendering the page, and pulls the values from data the route already loaded. Two server routes, `/sitemap.xml` and `/robots.txt`, render their answers from a store read and a small pure function at request time.

**Pros**:

- The metadata is written where the page is defined and reads the skill the page already loaded, so nothing has to be kept in step across files.
- The sitemap is always current: hiding a skill removes it within the cache window with no deploy and no manual step.
- No new dependency, and the whole surface is four small modules.

**Cons**:

- Every route that should carry metadata declares it, so a new route without a `head` silently inherits the root's.
- The sitemap costs one query per uncached request rather than being a static file a host can serve.

### Option 2: A sitemap written at build time, metadata still in route heads

The same per route `head` work, but the sitemap is a file produced during the build by a Vite plugin or a script that reads the store once.

**Pros**:

- The file is static, so it costs nothing to serve and a host can cache it as long as it likes.
- Nothing reads the database at request time.

**Cons**:

- The list is only as fresh as the last deploy, so a skill hidden for breaking the rules stays advertised until the next one, which is the case this feature exists to prevent.
- It moves a database read into the build, so whatever builds the app needs the connection string, and a build that cannot reach the store either fails or silently writes an empty file.

### Option 3: Add a metadata and sitemap library to the stack

Reach for a package that manages document metadata and generates a sitemap, rather than writing the head fragments and the small XML renderer here.

**Pros**:

- Less code to own, and a maintained package absorbs crawler quirks.

**Cons**:

- The router already has a head API the app uses twice, so a second mechanism for the same job has to be reconciled with the first, and the packages in this space tend to lag the router.
- It is a new dependency for a handful of meta tags, four XML elements, and an escaped string.

## Rationale

The router's head function is already the app's mechanism for this, used by the root route and the design gallery, and the server evaluates it while rendering, so the tags a crawler reads cost nothing extra (basis: `src/routes/__root.tsx`, and the router's document head guide). The values all exist before the head runs: the skill page's loader puts the row, its publisher, its updated timestamp, and its vote count in the query cache, and the head reads that same cache through the router's match context rather than fetching anything again (basis: spec 0004, `skillDetailQueryOptions`, and the loader that only ensures the query). Option 3 would add a dependency that duplicates a mechanism the project already owns, for a handful of tags, and Option 2 breaks on the one requirement that matters most here: a hidden skill has to leave the catalogue's public face quickly, and a build time file cannot do that between deploys (basis: spec 0009, the published only rule, and the moderation requirement that a hidden skill leaves the public catalogue).

The site address had to become configuration rather than a constant, because nothing in the repo knows it and deploy is a later feature with no spec (basis: `docs/scope/scope.md`, features 8 and 10). One value, read through one module and normalized in one place, keeps every absolute address in the app consistent, and the development fallback keeps `npm run dev` working without it. It is read at build time rather than from the process environment, because a route head runs in the browser on an in app navigation too, and a value only the server can see would leave the canonical and the social addresses missing on every client side route change (basis: the router's document head guide, and the `.server.ts` convention in `AGENTS.md`).

Three things here were revised once the answers were checked against the current guidance and against the code, and each is worth naming because a reader will otherwise wonder why the record argues with itself. The filtered catalogue view carries `noindex` alone rather than a canonical pointing at `/`: Google states that a canonical link is its preferred way to consolidate near duplicates and that `noindex` should not be used to select a canonical page, so sending both would be two signals disagreeing about one address, and the filtered view is a distinct page by design rather than a duplicate of the home page (basis: Google's consolidate duplicate URLs page). The home page title leads with the brand, `Skild · Discover and share AI agent skills`, while every skill page leads with the skill's name; the name first pattern needs an entity name and the home page has none. The `noindex` for the private pages moved out of a per route head and into the one middleware rule, because those routes answer a redirect for a signed out visitor and a head never runs for a redirect (basis: the existing `src/routes/account.tsx` guard and the request middleware chain in `src/start.ts`).

Three things were settled here rather than asked, and each is a call worth stating. The sitemap carries `lastmod` and nothing else, because Google ignores `changefreq` and `priority` (basis: Google's build a sitemap page). The publisher written description override was declined, so a description is the stored summary as it stands; the consequence is recorded below and the fix is a follow up. Rate limiting was declined for the two routes, because both responses are cacheable and each read is a single indexed query, and a limiter would be new infrastructure for a problem nobody has measured (basis: the project's own preference for the fewest moving parts, `AGENTS.md`).

## References

**Project sources**

- `AGENTS.md`, for the stack, the conventions, and the preference for the fewest moving parts.
- `src/routes/__root.tsx`, for the existing head and the theme script, and for the analytics rule that keeps a typed search term out of every captured event.
- `src/db/queries.ts`, for `publishedOnly()`, the one place the visibility rule lives.
- `src/features/skills/authors.server.ts` and `skillDetailQueryOptions`, for the values a skill page already has in hand.
- Spec 0004, for how a skill page loads its row. Spec 0009, for the visibility rule this feature reads.
- `docs/scope/scope.md`, features 8 and 10, for the shape of this feature and for the deploy that will set the site address.

**Practices & standards**

- A canonical link is the preferred way to consolidate near duplicate addresses; `noindex` should not be used to select a canonical page.
- `lastmod` is worth sending only while it is accurate; `changefreq` and `priority` are ignored.
- A crawler treats a 5xx as come back later and keeps what it already indexed, so a failing sitemap should fail rather than answer with an empty list.
- Structured data that does not meet a rich result's requirements is still valid and still useful to machines, and should not be padded to chase the result.
- A disallowed URL is never fetched, so a `noindex` on it never takes effect.

**Links**

- TanStack Start, server routes: https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- TanStack Router, document head management: https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management
- Google, build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google, consolidate duplicate URLs: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google, HTTP status codes and network errors: https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- Google, supported meta tags: https://developers.google.com/search/docs/crawling-indexing/special-tags
- Google, software app structured data: https://developers.google.com/search/docs/appearance/structured-data/software-app
- schema.org, InteractionCounter: https://schema.org/InteractionCounter
- OpenAI crawlers and their robots rules: https://platform.openai.com/docs/gptbot

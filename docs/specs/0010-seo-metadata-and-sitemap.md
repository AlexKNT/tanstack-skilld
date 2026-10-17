# 0010. Give every public page its own metadata, and serve a sitemap and a robots file

**Date**: 2026-10-16
**Status**: In Progress

## Summary

Every page in the app currently reaches a search engine with the same single title, `Skild`, because only the root route sets a head (the part of the HTML a crawler reads without running JavaScript). This decision gives the home page and every skill page their own title, description, and canonical, keeps the signed in and admin areas out of the index, and adds the two addresses a crawler looks for: `/sitemap.xml`, built from the store on request, and `/robots.txt`. The site address becomes configuration, since deploy has not happened yet, and only the real production host may be indexed, so a preview deployment never can be.

## Context

> ⚠️ Premise note: none of this can be verified in the wild until deploy lands (scope feature 10), and this spec assumes a site address that no existing spec fixes. The work is still worth doing now, because it is cheap while the route set is small and every later page shape would otherwise have to be revisited, and because the host rule below is the thing that stops the first preview deployment from being indexed and then competing with the real site. Treat the address as configuration to be set at deploy time rather than something this feature can confirm.

Skild is a public catalogue that anyone may read, and TanStack Start already renders every page to HTML on the server, so a crawler with no JavaScript receives the whole page. What it receives is one shared title, no description, no canonical (the address a page declares as its own, so near duplicates do not split their standing), and no address for a page's own name. Only `src/routes/__root.tsx` and the development only design gallery set a head at all, and a favicon is absent too. A person searching for a named skill therefore has one undifferentiated result to choose from, and two different skills look identical in a result list.

The store is the only source of truth for what is public. Spec 0009 put the published only rule in one place, `publishedOnly()` in `src/db/queries.ts`, and every public read calls it, so a hidden skill is invisible to the catalogue and its detail page answers as if it were never stored. Nothing outside the app knows that, though. A crawler that indexed a skill before it was hidden keeps showing it until something tells it otherwise, and a sitemap is the cheapest such signal.

Every absolute address needed here, a canonical, a sitemap entry, a social URL, depends on a site address the app has nowhere. There is no `public/` folder, no robots file, no sitemap, and no site URL in the environment. Deploy is two features away and has no spec, so the address has to be configuration with a documented fallback for local work rather than a value baked into the source now.

The cost of not deciding is quiet and compounding: every skill competes for one title, a hidden skill can stay in a result page indefinitely, a preview deployment can be indexed and then compete with the real site, and each new page shape built before this lands is one more place to revisit.

## Requirements

**User stories**:

- As a visitor who finds Skild through a search engine, I want each result to name the skill it leads to and describe it, so that I can tell two skills apart before clicking.
- As a publisher, I want my skill's own name and summary to be what a search engine shows, so that the result describes my work rather than the site in general.
- As the person who runs the site, I want a machine readable list of the public pages and a clear rule about what may be crawled, so that a new skill becomes findable without any action and a private area never appears in a result.
- As the person who runs the site, I want only the real site indexed, so that a preview deployment never competes with it.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: A request for the home page returns HTML whose head carries exactly one title reading `Skild · Discover and share AI agent skills` and one description meta, both present in the response a crawler sees with JavaScript disabled.
- **AC-2**: A request for `/skills/<slug>` returns HTML whose title reads `<skill name> · Skild` and whose description is that skill's stored summary, both taken from the skill the page's loader has already put in the query cache.
- **AC-3**: A request for a slug that is not stored, one whose skill is hidden, or one whose skill read failed answers with an `X-Robots-Tag: noindex, nofollow` header, and emits no social tags and no structured data, so the one page this feature exists to keep out is never left indexable by a quiet 200.
- **AC-4**: Every response for a path under `/account/...`, `/admin/...`, `/skills/new`, `/sign-in/...`, `/sign-up/...`, or `/design` carries an `X-Robots-Tag: noindex, nofollow` header, whatever the response turns out to be, including the redirect a signed out visitor receives.
- **AC-5**: The home page emits a self referencing `rel="canonical"` built from the configured site address. When the address carries a filter (`q`, `tag`, or both) the page emits no canonical and carries `noindex, nofollow` instead, while still rendering the filtered view.
- **AC-6**: `GET /sitemap.xml` answers 200 with `Content-Type: application/xml; charset=utf-8` and a `<urlset>` carrying the absolute home address plus one address per published skill, each entry with a `<loc>` and each skill entry with a `<lastmod>` in `YYYY-MM-DD` form taken from that row's updated timestamp. The home entry carries a location alone, because nothing supplies a timestamp for it, and no entry carries `changefreq` or `priority`. No session is required.
- **AC-7**: A hidden skill never appears in `/sitemap.xml`, and hiding a listed skill removes it from the next response that is not served from cache.
- **AC-8**: When the store read behind `/sitemap.xml` fails, the route answers 503 with `Cache-Control: no-store` and no `<urlset>` body, so a crawler returns later instead of recording an empty site.
- **AC-9**: On success, `/sitemap.xml` carries `Cache-Control: public, max-age=3600` and no `Set-Cookie` header, so a shared cache can store it rather than refusing it because it carries a session cookie.
- **AC-10**: On the host that matches the site address, `GET /robots.txt` answers 200 with `Content-Type: text/plain; charset=utf-8`, a `User-agent: *` group, one `Disallow` line per private path (`/account`, `/admin`, `/skills/new$`, `/sign-in`, `/sign-up`, `/design`), and a `Sitemap:` line carrying the absolute sitemap address. It never disallows `/` or `/skills/`, and its answer is cacheable with a short lifetime and `Vary: Host`, so a shared cache cannot hand one host's answer to another. It carries no `Set-Cookie` either.
- **AC-11**: On any other host, every response carries an `X-Robots-Tag: noindex, nofollow` header and `/robots.txt` answers a `Disallow: /` group with no `Sitemap:` line and `Cache-Control: no-store`, so a cached copy can never follow the site to a different address.
- **AC-12**: Each skill page emits `og:title`, `og:description`, `og:type` of `website`, `og:url`, `og:site_name` of `Skild`, and a `twitter:card` of `summary`, with the social title and description repeating that page's own title and description, with absolute addresses built from the configured site address, and with no `og:image`, since no image ships.
- **AC-13**: Each skill page emits exactly one `<script type="application/ld+json">` holding a `SoftwareApplication` with the skill's name, its summary as the description, the absolute address, the publisher's name when there is one, the row's updated timestamp as `dateModified`, `DeveloperApplication` as its `applicationCategory`, `Any` as its `operatingSystem`, and the upvote count as an `interactionStatistic` `InteractionCounter` whose `interactionType` is the `LikeAction` identifier and whose `userInteractionCount` is that count. The JSON parses, and a page that could not load its skill emits none.
- **AC-14**: `VITE_SITE_URL` is read through one module and validated. An absent value falls back to `http://localhost:3000` in development, so the app still boots there, and an absent or malformed value in a production build names the variable in a failure raised as the server starts rather than on the first request.

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

## Decision

**Chosen option**: Option 1: A route head per page, and two server routes that read the store

Each route declares its own metadata through the router's `head` function, fed by the data that route already loaded, `/sitemap.xml` and `/robots.txt` are server routes that render their answers from the store and the configured site address at request time, and one rule in the existing request middleware carries every `noindex` this feature adds.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`)

## Rationale

The router's head function is already the app's mechanism for this, used by the root route and the design gallery, and the server evaluates it while rendering, so the tags a crawler reads cost nothing extra (basis: `src/routes/__root.tsx`, and the router's document head guide). The values all exist before the head runs: the skill page's loader puts the row, its publisher, its updated timestamp, and its vote count in the query cache, and the head reads that same cache through the router's match context rather than fetching anything again (basis: spec 0004, `skillDetailQueryOptions`, and the loader that only ensures the query). Option 3 would add a dependency that duplicates a mechanism the project already owns, for a handful of tags, and Option 2 breaks on the one requirement that matters most here: a hidden skill has to leave the catalogue's public face quickly, and a build time file cannot do that between deploys (basis: spec 0009, the published only rule, and the moderation requirement that a hidden skill leaves the public catalogue).

The site address had to become configuration rather than a constant, because nothing in the repo knows it and deploy is a later feature with no spec (basis: `docs/scope/scope.md`, features 8 and 10). One value, read through one module and normalized in one place, keeps every absolute address in the app consistent, and the development fallback keeps `npm run dev` working without it. It is read at build time rather than from the process environment, because a route head runs in the browser on an in app navigation too, and a value only the server can see would leave the canonical and the social addresses missing on every client side route change (basis: the router's document head guide, and the `.server.ts` convention in `AGENTS.md`).

Three things here were revised once the answers were checked against the current guidance and against the code, and each is worth naming because a reader will otherwise wonder why the record argues with itself. The filtered catalogue view carries `noindex` alone rather than a canonical pointing at `/`: Google states that a canonical link is its preferred way to consolidate near duplicates and that `noindex` should not be used to select a canonical page, so sending both would be two signals disagreeing about one address, and the filtered view is a distinct page by design rather than a duplicate of the home page (basis: Google's consolidate duplicate URLs page). The home page title leads with the brand, `Skild · Discover and share AI agent skills`, while every skill page leads with the skill's name; the name first pattern needs an entity name and the home page has none. The `noindex` for the private pages moved out of a per route head and into the one middleware rule, because those routes answer a redirect for a signed out visitor and a head never runs for a redirect (basis: the existing `src/routes/account.tsx` guard and the request middleware chain in `src/start.ts`).

Three things were settled here rather than asked, and each is a call worth stating. The sitemap carries `lastmod` and nothing else, because Google ignores `changefreq` and `priority` (basis: Google's build a sitemap page). The publisher written description override was declined, so a description is the stored summary as it stands; the consequence is recorded below and the fix is a follow up. Rate limiting was declined for the two routes, because both responses are cacheable and each read is a single indexed query, and a limiter would be new infrastructure for a problem nobody has measured (basis: the project's own preference for the fewest moving parts, `AGENTS.md`).

## Feature design

**Data model sketch**:

No new table and no new column. Every value already sits on the row the app reads:

| Value | Comes from |
|---|---|
| Title of a skill page | `skills.name`, up to 80 characters |
| Description of a skill page | `skills.summary`, up to 200 characters |
| Sitemap membership | `skills.visibility`, through the existing `publishedOnly()` rule |
| Sitemap entry | `skills.slug` |
| `lastmod` | `skills.updated_at`, reduced to a date in UTC |
| Publisher name in structured data | `skills.author_id`, resolved by the existing batched Clerk read in `src/features/skills/authors.server.ts` |
| Vote count in structured data | the `upvoteCount` the detail read already carries |

**Page copy and literals** (decided here, so nobody has to invent them while building):

| Value | Literal |
|---|---|
| Home title | `Skild · Discover and share AI agent skills` |
| Home description | `Discover, share, and upvote community built AI agent skills, then install them with one command.` |
| A skill page title | `<skill name> · Skild` |
| `og:type` | `website` |
| `og:site_name` | `Skild` |
| `twitter:card` | `summary` (no image ships, so the small card is the honest one) |
| `applicationCategory` | `DeveloperApplication` |
| `operatingSystem` | `Any` |
| Brand used in a title | `Skild` |
| Title when a page has no subject of its own | none, so the root's `Skild` stands alone |

The surfaces this adds are code rather than data:

- `src/features/seo/site.ts`: the site address, normalized once and validated, plus the absolute address builder and the host comparison. It is an ordinary module and not a server only one, because a route head also runs in the browser on an in app navigation, and a route file cannot import a server only module at all.
- `src/features/seo/meta.ts`: the pure head fragment builders, holding the copy above.
- `src/features/seo/indexing.ts`: the private path list, read by both the middleware rule and the robots file, so the two can never disagree.
- `src/features/seo/sitemap.ts`: the pure XML renderer.
- `src/db/queries.ts` gains one read, a list of published skill slugs with their updated timestamps, calling the existing `publishedOnly()` helper rather than repeating that filter. The existing `listSkillSlugs()` deliberately returns every skill whatever its visibility, because the seed uses it, so it is not reused here.

**State transitions**: none. Nothing in this feature changes a skill's state; hiding and restoring already exist in spec 0009, and this feature only reads the result.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/sitemap.xml` | GET | none | `application/xml` `<urlset>`, one `<url>` per published skill with `<loc>` and `<lastmod>` | public, no session | 503 when the store read fails |
| `/robots.txt` | GET | the request host | `text/plain`, the `User-agent` group, the `Disallow` lines, the `Sitemap:` line | public, no session | none; an unknown host answers the disallow everything group |
| every page's head | GET | the route's own loaded data | `title`, `description`, `canonical`, the social tags, the structured data script | public, except the private routes which need a session to render at all | a page whose read failed emits no subject specific tag |
| every response | GET, HEAD | the request path, the response status, the request host | an `X-Robots-Tag` header on the private paths, on a page that was not found, and on any host that is not the site address | public | none |

**Value sourcing** (every value each action produces, computes, or displays names where it comes from):

| Action | Value produced / displayed | Source |
|---|---|---|
| Every route head | the site address every absolute address is built from | `VITE_SITE_URL`, normalized once in `src/features/seo/site.ts` |
| The home page head | the title and the description | the copy list above, held in `meta.ts` |
| The home page head | the canonical absolute address | the site address joined with the route's own path |
| The home page head | whether the filtered view is `noindex` | the route's own validated search, from `src/features/skills/filter.ts` |
| A skill page head | the skill it describes | the detail query's cached result in the router match context, the same query the route's loader ensures, guarded for the case where nothing is there |
| A skill page head | the title | the `name` on that skill |
| A skill page head | the description | the `summary` on that skill |
| A skill page head | `og:url` and the structured data address | the site address joined with `/skills/<slug>` from the route params |
| A skill page's structured data | the publisher's name | `skills.author_id`, resolved by the batched Clerk read the detail result already carries |
| A skill page's structured data | `dateModified` | `updated_at` on the detail result, as an ISO timestamp |
| A skill page's structured data | the vote count | the `upvoteCount` on the detail result |
| `/sitemap.xml` | the addresses listed | the `slug` column, filtered by `publishedOnly()` |
| `/sitemap.xml` | each `lastmod` | `updated_at` on the same read, reduced to a date in UTC |
| `/sitemap.xml` and `/robots.txt` | the absolute file addresses | the site address |
| `/robots.txt` | the paths it disallows | `src/features/seo/indexing.ts`, the same list the header rule reads |
| Every response | whether it carries the noindex header | the request path and the response status in the middleware, and the host comparison in `site.ts` |

**Key invariants**:

- The sitemap lists only addresses the public catalogue would also show. The published only rule is called, never reimplemented, so a hidden skill cannot leak by a second filter drifting from the first.
- No output of this feature contains a hidden skill's name, summary, or slug, in any file or any tag.
- One title per page. The router keeps the deepest match's title and drops the root's, so every route that sets a title replaces `Skild` rather than adding a second one.
- Every absolute address in the app comes from the one site address module, so changing host is one value change in one place.
- Both crawl files answer without a session and never read the viewer, so their output is identical for every anonymous visitor, and neither carries a session cookie.
- The private path list exists once. The middleware rule and the robots file read the same list, so a path added to one cannot be missing from the other.
- A head invents nothing. When the skill a page should describe is not in the cache, the page emits no subject specific tag at all, so a missing or failed read can never publish a name nobody read.
- The head runs on the server for the same data the page renders, so the tags a crawler reads and the page a person sees cannot disagree.

**Security model**:

Nothing new is written and no new authority exists. Both crawl files are public reads of data the catalogue already shows to anonymous visitors, and neither takes an input.

The one place a mistake leaks content in bulk is the sitemap, so it calls the shared published only query rather than carrying its own filter, and the verification pass asserts a hidden skill's slug is absent by name. The robots file lists paths only, never content.

No personal data reaches any tag: a description is the stored summary, never an email address or a viewer identifier, and the analytics rule that keeps a typed search term out of every captured event (the `$current_url` scrub in `src/routes/__root.tsx`) is unaffected, since this feature adds no event.

One interaction is worth stating plainly. A URL disallowed in robots.txt is never fetched, so a `noindex` on that same URL never takes effect. The private paths carry both, and they are not belt and braces: the disallow list stops crawl effort being spent on pages nobody should index, and the response header is what tells a crawler that already holds one of those pages to drop it. Neither is a substitute for the route's own guard, which is what actually keeps the content from a signed out visitor.

The noindex rule lives in exactly one place, the request middleware, reading one shared path list (basis: the request middleware chain that already shapes responses in `src/start.ts`). A route head per private page was the earlier plan and was dropped, because those routes answer a redirect rather than a page when nobody is signed in, and a rule that only exists in a head never runs for a redirect.

Clerk's middleware sits first in that chain and adds its own cookies to whatever the chain returns, so both crawl responses have to be left without a session cookie or a shared cache will refuse to store them however good the cache header is. Clerk's middleware offers no way to skip a path, so the header is dealt with where the response is shaped. This is one of the two places where the mechanism is not the obvious one, the other being the host comparison, which reads host names alone so a preview on another port is not mistaken for the real site.

Rate limiting is consciously not added, for the reason in `## Rationale`. Revisit if a crawler is ever observed costing real load.

**Configuration required**:

- `VITE_SITE_URL`: the absolute address of the site, used for canonicals, sitemap entries, the `Sitemap:` line, the social addresses, the structured data address, and the decision about which host may be indexed. Absent in development, where it falls back to `http://localhost:3000`. Documented in `.env.example`. It is read through the build, so a host that changes its address is rebuilt rather than reconfigured, and the format is checked once as the server starts.

**Critical test scenarios** (each maps to an acceptance criterion in `## Requirements`):

- Happy path: request the home page and a skill page with JavaScript disabled and find one title each, one description, the canonical on the home page, and the skill's own name in the skill page's title with its summary as the description, verifies **AC-1**, **AC-2**, **AC-5**
- Happy path: request `/sitemap.xml` and find the home entry with a location alone, one entry per published skill each with a date only `lastmod`, the cache header, and no `Set-Cookie`, verifies **AC-6**, **AC-9**
- Failure case: force the store read behind the sitemap to fail and confirm a 503 with no `<urlset>` and no caching, verifies **AC-8**
- Failure case: hide a skill the sitemap lists, request it again, and confirm the entry is gone, verifies **AC-7**
- Failure case: force a skill page's read to fail and confirm the response carries the noindex header and emits no social tags and no structured data, verifies **AC-3**
- Permission: as a signed in user, an admin for the admin area, request `/account/`, `/admin/skills`, `/skills/new`, a slug that is not stored, and a hidden skill's slug, and confirm each response carries the noindex header, verifies **AC-3**, **AC-4**
- Permission: as a signed out visitor, request `/account/` and confirm the redirect itself carries the noindex header, verifies **AC-4**
- Permission: request the app on another host, including the site's own host name on a different port, and confirm every response carries the noindex header and `/robots.txt` disallows everything with no `Sitemap:` line, verifies **AC-11**
- Edge case: request `/robots.txt` and confirm the private paths are disallowed, `/` and `/skills/` are not, and the answer carries the cache directives and `Vary: Host`, verifies **AC-10**
- Edge case: start the app with `VITE_SITE_URL` absent in development and confirm it boots on the fallback, then with a malformed value confirm the failure names the variable as the server starts, verifies **AC-14**

## Build plan

1. [x] Prove the server route pipe: add `src/routes/sitemap[.]xml.ts` and `src/routes/robots[.]txt.ts` with a `GET` handler each, answering the right content type, the sitemap carrying the home address alone, built from the development fallback address for now, and the robots file carrying the disallow group and a `Sitemap:` line, then run `npm run generate-routes` and confirm both by request, satisfies **AC-6**, **AC-10**
2. [x] Add `src/features/seo/site.ts`: the site address normalized and validated, the absolute address builder, and the host comparison, with the startup check and the `.env.example` line, satisfies **AC-14**
3. [x] Add `src/features/seo/meta.ts`: the pure head fragment builders and the copy list above, satisfies **AC-1**, **AC-5**, **AC-12**, **AC-13**
4. [x] Put the home page's title and description end to end through the real request path and confirm both in the server rendered HTML, satisfies **AC-1**
5. [x] Give `/skills/$slug` a head fed from the detail query's cached result in the match context, with the guard for a skill that is not there and the social tags, satisfies **AC-2**, **AC-12**
6. [x] Finish the home page's canonical rule: a self referencing canonical with no filter set, and no canonical plus `noindex` while a filter is set, satisfies **AC-5**
7. [x] Thicken the sitemap: the published entries read through the shared visibility rule, the date only `lastmod` on skill entries, the cache header, and the 503 path when the read fails, satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**
8. [x] Add `src/features/seo/indexing.ts` and the one middleware rule that reads it: the noindex header on the private paths and on a page that was not found, including the redirect those routes answer with, satisfies **AC-3**, **AC-4**
9. [x] Emit the structured data on skill pages from the loaded skill, satisfies **AC-13**
10. [x] Finish the robots file against the shared path list, with the cache directives and `Vary: Host`, satisfies **AC-10**
11. [x] Add the host rule: the noindex header on a host that is not the site, the disallow everything branch, and keeping a session cookie off both crawl responses, satisfies **AC-9**, **AC-11**
12. [x] The crawl and quality pass: run `npm run generate-routes`, `npm run check`, and `npm run typecheck`, build and preview, then walk the scenarios above on both a production host and a local one, including the empty catalogue case, satisfies **AC-1** through **AC-14**

## Consequences

**Positive**:

- A search result names the skill it leads to and describes it in the publisher's own words, so two skills are distinguishable before a click.
- A new skill becomes findable within the cache window with no deploy and no manual step.
- A hidden or removed skill leaves the index, which is the piece spec 0009's visibility rule could not reach on its own.
- A preview deployment can never be indexed and compete with the real site, whatever address it is given.
- Every absolute address in the app now comes from one value, so pointing the app at its real address is a rebuild with one setting changed.

**Negative / tradeoffs**:

- A stored summary runs to 200 characters and Google publishes no length rule, so a long one will often be cut short in a result. A publisher written description was declined for this pass, so the fix is a follow up.
- The sitemap is rendered from the store on each uncached request, so the store is in the path of a crawl. That is one indexed query at this scale, but a catalogue of a hundred thousand skills would want the list paged into a sitemap index.
- The noindex signal is a response header rather than a tag in the page, so it does not show up in the source anyone inspects when a private page looks wrong. Whoever adds a private route has to know that the rule is a path list in one module rather than something the route declares about itself.
- The structured data will not earn a Google rich result. Google's Software app result expects an offer and a rating or review, and a skill has neither, so the value here is machine readability only, at the cost of one more thing that has to stay in step with the page it describes.
- A private path is both disallowed and marked `noindex`, and the first of those wins, since a crawler never fetches a disallowed URL and so never sees the header. The two are kept for different jobs, one to save crawl effort and one to retire a page that is already known, and anyone editing one while expecting the other to behave the way it reads will be surprised.
- Indexability now depends on the host name a request arrives on matching the site address. Behind a proxy that rewrites the host, or on a host serving both a preview and the real site, the rule fails closed and nothing is indexed at all. A failure here is invisible except in the header, so the verification pass checks the production case from outside rather than trusting the app.
- The address is read at build time, so a host cannot be pointed at a new address by changing a setting alone; it takes a rebuild. That is the ordinary Vite arrangement, and it does mean the deploy step (scope feature 10) owns the rebuild when the address is first known.
- Both crawl responses have to be left without Clerk's session cookie, which takes a deliberate step because that middleware offers no way to skip a path. Without it the cache header is there and a shared cache still refuses the response.

**Neutral**:

- Two new route files mean `npm run generate-routes` becomes part of the change, and the generated tree is committed with it.
- `VITE_SITE_URL` has to be set on the host and the app rebuilt there before the first crawl, which is deploy's job (scope feature 10), so this feature is inert in production until that lands.
- No image ships, so the social card is the small `summary` card and `og:image` is absent until one exists.
- The design gallery keeps its dev only guard, so its noindex rule only matters in development.
- No existing route's rendered output changes for a person; only the head of each page does.

## Follow-up

- [ ] Set `VITE_SITE_URL` on the host and rebuild when deploy lands (scope feature 10), then confirm from outside the app that only the production host is indexed and that the sitemap is reachable.
- [ ] Add a share image and an `og:image` tag when one exists, and move `twitter:card` to the large card at the same time.
- [ ] Consider a publisher written search description if the stored summary proves too long for a snippet in practice.
- [ ] The deferred tag landing page (from spec 0008) would add a second shape of public page that wants its own metadata if it is ever built.
- [ ] Rate limit the two crawl routes if a crawler is ever seen costing real load.

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

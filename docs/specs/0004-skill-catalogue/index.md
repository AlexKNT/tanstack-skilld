# 0004. Read the skill catalogue on the home page and on a detail page

**Date**: 2026-10-02
**Status**: Accepted

## Summary

Skild's store now holds skills (spec 0003), but nothing in the interface shows them. This decision turns the home page into the catalogue: an intro band and a grid of skill cards, newest first, plus a detail page for each skill at its own URL. It also settles the two things the data model left open: how a publisher's name and picture reach a card (one batched Clerk read on the server) and how the stored markdown description is shown (rendered and sanitized). Both pages are public and server rendered, with the loading, empty and error states the design system already provides.

## Requirements

**User stories**:
- As a visitor, I want to browse the newest skills so that I can find one worth installing.
- As a visitor, I want each skill to have its own page so that I can read the full description before I install it.
- As the engineer, I want the list to survive a slow or failing reader so that the front page is never blank.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The home page at `/` is the catalogue: one intro band (a kicker line, a single `h1`, one supporting line) followed by a responsive grid of skill cards read from the store, newest first, and the first page of skills is present in the server rendered HTML.
- **AC-2**: Each card shows the skill's name and summary, the author's avatar and name when the skill has one (the avatar falling back to the author's initials when there is no image), and the date it was added, and the card opens the skill's detail page.
- **AC-3**: A card and a detail page for a skill with an `install_url` show an install control that opens the URL in a new tab with `rel="noopener noreferrer"`, and a skill without one shows a disabled install button.
- **AC-4**: `/skills/<slug>` shows the skill's identity header (name, summary, author when present, added date), the install action, and the markdown description divided by `Separator`s.
- **AC-5**: The description renders from untrusted markdown through a sanitizer, unsafe markup (scripts, frames, event handlers, images) is stripped, links are limited to the http, https and mailto protocols and open in a new tab with `rel="noopener noreferrer"`, and the rendered body never emits a second `h1` because markdown headings are shifted down one level.
- **AC-6**: A slug that does not exist produces a real not found response (`SKILL_NOT_FOUND` mapped to the router's `notFound()` in the loader, so the HTTP status is 404 and the not found surface renders), and a detail read failure shows an `Alert` with a retry action.
- **AC-7**: The list carries its states: a `Skeleton` grid while a client side load or retry is in flight (the server rendered first paint already carries the skills), the `Empty` surface with copy only when the store has no skills, and an `Alert` with a retry action when the read fails, the retry disabled with a `Spinner` while it runs.
- **AC-8**: The list shows the first 20 skills and a "Load more" control that appends the next 20, is disabled with a `Spinner` while loading, and hides once a page returns fewer than 20 rows.
- **AC-9**: Authors are read from Clerk on the server in one batched call per page, a skill with no `author_id` renders no author block, and a failed author lookup leaves the skills rendered without authors and is logged rather than failing the page.
- **AC-10**: `listSkillCards` and `getSkillDetail` return explicit failures carrying a code rather than throwing, and `listSkillCards` reuses spec 0003's `limit` (default 20, ceiling 100) and `offset` (default 0) rules.
- **AC-11**: Each page has one `h1` and no skipped heading level (the card title is an `h2`, and the markdown body starts at `h2`), the card is clickable without nesting one interactive control inside another, every control is keyboard reachable with a visible focus ring, and the grid is usable at the smallest supported width (one column at 320px, growing to more columns as the width allows).
- **AC-12**: The client caches the list for a short stale time (about 30 seconds) and revalidates on revisit, so a newly published skill appears without a full reload.
- **AC-13**: This feature adds no database column and no migration, and tags, upvotes, search and filter, moderation, SEO metadata and the sitemap, and image upload stay out.

## Decision

**Chosen option**: Option 1, read the catalogue from the existing store, show it on the home page, give each skill a detail page, read publishers from Clerk on the server, and render the markdown description sanitized.

The home page becomes the catalogue, server rendered through a route loader so the first paint already carries the skills. Two public server functions, `listSkillCards` and `getSkillDetail`, read the existing `skills` table through the query layer spec 0003 built, and enrich each row with its publisher from one batched Clerk call. Every card shows the name, the summary, the publisher when there is one, the added date and an install control, and links to `/skills/<slug>`, which shows the identity header, the install action and the sanitized markdown body. A publisherless skill (every seeded row today) simply shows no author block.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**: Reuse the existing `skills` table (spec 0003) with no change and no migration. The reads add two shapes on top of the stored row:
- A card row: `{ id, slug, name, summary, installUrl?, createdAt, author?: { id, name, imageUrl? } }`.
- A detail row: the same plus `description`. The `updated_at` column is not read or shown by this feature.

The `author_id` column stays nullable, so `author` is optional on both. Spec 0003's null to undefined mapping at the query boundary remains the one place that conversion happens.

**State transitions**: No stored entity gains a state. Each page has a UI state instead: the list moves from loading to loaded, empty or error, and the detail page from loading to loaded, not found or error. Nothing persists these.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listSkillCards` | read (server function, GET) | `limit?: number` (opt, default 20, ceiling 100), `offset?: number` (opt, default 0) | `{ items: card[], hasMore: boolean }`, newest first | public | `VALIDATION_FAILED`, `SKILLS_QUERY_FAILED` |
| `getSkillDetail` | read (server function, GET) | `slug: string` (req) | one detail row with its author | public | `VALIDATION_FAILED`, `SKILL_NOT_FOUND`, `SKILLS_QUERY_FAILED` |

`SKILL_NOT_FOUND` is a new read failure code, added beside spec 0003's codes, so the detail page can tell a missing skill from a broken read. Both functions keep the explicit failure style spec 0003 established, so a failure is a returned value handled at the page boundary rather than a thrown error. `SKILL_NOT_FOUND` is the one exception the boundary turns into a thrown `notFound()`, because the router is what produces a real 404 status.

`listSkillCards` is added beside spec 0003's `listSkills`, which stays as it is (the raw read that spec 0003 documents); this feature does not supersede it. The detail read reuses the existing `findSkillBySlug` query, which already returns the full row, so no new query is introduced.

**Value sourcing** (every value each action produces, computes or displays names where it comes from; a required value with no named source is an undecided input, resolved here rather than left for the build):

| Action | Value produced / displayed | Source |
|---|---|---|
| `listSkillCards` | the card name, summary and install link | the `name`, `summary` and `install_url` columns |
| `listSkillCards` | the link target for a card | the `slug` column, joined to `/skills/` |
| `listSkillCards` | the added date | the `created_at` column, formatted with `Intl.DateTimeFormat` at a fixed locale (`en-GB`) and `timeZone: "UTC"`, giving one deterministic string such as `2 Oct 2026` on the server and in the browser |
| `listSkillCards` | the publisher name and picture | the Author record from Clerk, fetched by the `author_id` column |
| `listSkillCards` | `hasMore` | derived by reading `limit + 1` rows and reporting true when the extra row is present, so an exact multiple of the page size does not show a Load more control that would fetch an empty page |
| the client query | the next page to request | `initialPageParam: 0` plus `getNextPageParam` derived from the page's `hasMore` (the next offset is the current offset plus the page's row count, or `undefined` at the end) |
| `getSkillDetail` | the body shown on the page | the `description` column, rendered as sanitized markdown with headings shifted down one level |
| `getSkillDetail` | whether the page is a 404 or an error | the failure code the function returns (`SKILL_NOT_FOUND` against `SKILLS_QUERY_FAILED`), mapped to `notFound()` at the loader |
| the home intro band | the kicker, `h1` and supporting line | hand written copy decided here: kicker `Skill catalogue`, `h1` `Discover and share AI agent skills` (the current hero heading), supporting line `Browse the newest skills the community has shared, or open one to read how it works.` |
| the empty, error and not found surfaces | their headings, bodies and action labels | hand written copy decided here: empty `No skills yet` with the body `Skills will appear here once someone publishes one.`; error title `The catalogue could not be loaded` with the returned message and a `Try again` action; not found `Skill not found` with the body `That skill does not exist or has been removed.` and a `Back to the catalogue` action |
| the install control | enabled or disabled | derived from `install_url` being present or absent |
| the skeleton grid | how many placeholder cards | a constant decided here (6), not a value from the data |
| the author block | shown or hidden | derived from whether `author_id` resolved to a Clerk user |

**Key invariants**:
- The card is one clickable surface without nested interactive elements: the title carries the link and the install control is layered above it (the stretched link pattern), so there is never an anchor inside an anchor.
- The list is always bounded. No read ever asks for every row.
- The added date renders identically on the server and in the browser: one `Intl.DateTimeFormat` at the pinned locale and UTC, so hydration stays clean.
- The card summary is clamped to a fixed number of lines so cards stay even.
- Markdown is always sanitized. Raw HTML from an author is never rendered, images in a description are stripped, and link protocols are limited to http, https and mailto, so an author cannot embed remote tracking content or a script protocol.
- The rendered body never emits a second `h1`: a rehype pass shifts every markdown heading down one level, so the body starts at `h2`.
- Publisher data is best effort: its absence or failure never blocks the skill content. The page's distinct author ids are de duplicated and requested in one call with a `limit` equal to the page size, and a failure (including a single unknown id) drops the author blocks rather than the page.
- The loader and the client share one query key, so the first page is not fetched twice. `SKILL_NOT_FOUND` is the one failure the loader turns into a thrown `notFound()`, so the response carries a real 404 status.

**Security model**:
- Both reads are public, matching the catalogue's public nature. There is no write path, no new credential and no change to any auth rule.
- Publisher names and pictures from Clerk are shown publicly, which is intended for a public catalogue. Only the fields a card needs (id, name, image URL) are read; nothing else about the user is fetched or stored.
- The Clerk secret key stays server side. The batched user lookup runs only inside the server functions, never in the browser.
- The sanitizer drops images and limits link protocols, so an author cannot embed remote content for tracking, or a script protocol, inside a description.
- No compliance scope applies: no payment, health or regulated data, and the only personal data is a Clerk user's public profile fields.

**Configuration required**:
- `CLERK_SECRET_KEY`: already present in `.env.local` and `.env.example`, and now required at runtime for the server side publisher lookup. If it is missing the lookup fails and authors simply do not render, which is the documented degraded path.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: the home page renders the seeded skills newest first with their publishers, a card opens its detail page, and the detail page shows the sanitized markdown body and the install control, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-9**
- Empty and error: pointed at a store with no rows the page shows the `Empty` surface, and with the store broken it shows the `Alert` with a working retry, verifies **AC-7**
- Paging: with more than 20 skills, Load more appends the next page and hides at the end, verifies **AC-8**
- Missing and unsafe content: an unknown slug returns the 404 page, and a description carrying a script tag renders with the tag stripped, verifies **AC-6**, **AC-5**
- Degraded publisher: with the Clerk lookup forced to fail, the cards still render without author blocks and the failure is logged, verifies **AC-9**
- Accessibility: a keyboard walk of both pages, one `h1` each and visible focus rings, verifies **AC-11**

## Build plan

Ordered for the project's Tracer Bullet approach: prove one thin thread from the page through the server function to the store first, then thicken it with cards, publishers, markdown, paging and the states. Every step leaves the app runnable.

1. Add the read support: reuse the existing `findSkillBySlug` in `src/db/queries.ts` for the detail page (it already returns the full row) and add a shared read failure type carrying spec 0003's codes plus the new `SKILL_NOT_FOUND`, satisfies **AC-10**, **AC-6**
2. Add the two public server functions to `src/features/skills/data.ts`: `listSkillCards({ limit, offset })` composing the existing bounded list read with a `hasMore` flag read from `limit + 1` rows, and `getSkillDetail({ slug })` returning the skill or `SKILL_NOT_FOUND`. Both return explicit failures, satisfies **AC-10**
3. Thin thread end to end: point the home route at `listSkillCards` through a route loader with TanStack Query, rendering a plain list of names, and add the detail route `src/routes/skills.$slug.tsx` rendering the raw name, summary and description from `getSkillDetail`, then confirm the whole pipe works before styling, satisfies **AC-1**, **AC-4**
4. Build `SkillCard` and the grid: name, summary, install control and added date mapped to design tokens, with the linked title and the stretched link pattern so the card opens the detail page, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-11**
5. Add the publisher read: one batched `clerkClient().users.getUserList({ userId })` per page inside both server functions, de duplicating the ids and passing a `limit` equal to the page size, returning only `{ id, name, imageUrl }` (with an initials fallback when there is no image), treated as best effort and logged when it fails, satisfies **AC-9**, **AC-2**
6. Render the description as markdown: `react-markdown` with `remark-gfm` and `rehype-sanitize`, each element mapped to token classes rather than a plugin palette, headings shifted down one level, images stripped, link protocols limited to http, https and mailto, and links opening in a new tab, satisfies **AC-4**, **AC-5**
7. Add paging with `useInfiniteQuery`, seeded from the loader with `initialPageParam` and a `getNextPageParam` driven by `hasMore`, with the Load more control that appends, disables with a `Spinner` while loading and hides at the end, satisfies **AC-8**, **AC-12**
8. Add the states: the skeleton grid and the detail skeleton, the `Empty` surface for a store with no skills, and the `Alert` with a retry action for a read failure, satisfies **AC-7**
9. Finish the failure paths: a detail read error shows the `Alert` with retry, and an unknown slug maps `SKILL_NOT_FOUND` to the router's `notFound()` in the loader so the response carries a real 404 status and the not found surface renders, satisfies **AC-6**
10. Accessibility and responsive pass, in both themes where they are reachable: one `h1` per page, heading order, focus rings, the card at the smallest width, and the deterministic date format, satisfies **AC-11**
11. Confirm the boundaries: no schema change or migration, and tags, upvotes, search, moderation, SEO and image upload untouched, satisfies **AC-13**

## Consequences

**Positive**:
- The home page becomes the product, showing real skills instead of a placeholder hero.
- This is the first complete thread through UI, server and store, which retires the risk that the layers do not connect and gives later slices a read layer to build on.
- Publishers stay in Clerk, so there is still no second copy of a person to keep in sync.
- The design system's loading, empty and error surfaces get their first real use, which proves spec 0002 beyond the gallery.

**Negative / tradeoffs**:
- The list read now depends on Clerk as well as the store, so a slow Clerk slows the first paint. Degrading to no authors keeps the page up, but the wait is real.
- A Clerk call sits on the hot path of a public page. If the catalogue grows, this is the first thing to cache or mirror, which spec 0003's Follow-up already flags.
- Markdown rendering adds three dependencies (`react-markdown`, `remark-gfm`, `rehype-sanitize`) to review and keep patched, and it renders untrusted author content, so the sanitizer is a security surface.
- The home page loses its current marketing hero, and its copy shifts to a catalogue intro. The hero's Create an account control and its `sign_up_started` analytics event are removed this slice, because the header already carries the sign in and sign up controls; that home hero funnel is gone.
- The client cache means a newly published skill can take about 30 seconds to appear.

**Neutral**:
- No schema change, so there is no migration and no data rollback risk.
- The project gains its first markdown renderer, a pattern later features will reuse.
- The `updated_at` refresh gap spec 0003's verify found stays unfixed and invisible here, because this feature does not show that value.

## Follow-up

- [ ] The Agent Skills and MCP discovery offer was declined for this feature, so record the decline in `AGENTS.md` so a later stage does not offer the same tools again.
- [ ] `react-markdown`, `remark-gfm` and `rehype-sanitize` conventions (always sanitize, map elements to tokens) are not in `AGENTS.md`; a root Rule line would help the next feature that renders markdown.
- [ ] Decide later whether the added date becomes a relative format ("2 days ago"); a relative value must be computed in the browser to avoid a hydration mismatch.
- [ ] If the list ever renders many cards per page, cache or mirror the Clerk publisher lookup, as spec 0003's Follow-up also notes.
- [ ] Per skill SEO metadata and the sitemap stay with scope feature 8, which is where the detail page's title and description will land.
- [ ] Consider a community skill for the markdown stack if one exists when the next rendering feature lands.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

# Verify: skill catalogue · spec 0004 · updated 2026-10-02

_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Visit `/` → an intro band (kicker, one `h1`, one supporting line) sits above a responsive grid of skill cards, newest first → AC-1
- [x] View the page source for `/` (`curl -s http://localhost:3000/`) → a seeded skill name and its card `h2` are in the HTML before hydration → AC-1
- [x] On a card, read the name, the summary, the added date and the install control; a skill with an author shows the avatar and name, a skill with no author shows no author block → AC-2, AC-9
- [x] A skill with an install URL (PDF Reader) shows an Install control that opens the URL in a new tab; inspect it for `rel="noopener noreferrer"` → AC-3
- [x] A skill with no install URL (Meeting Notes Summariser) shows a disabled Install button → AC-3
- [x] Open `/skills/pdf-reader` → identity header (name, summary, author when present, added date), the install action, a `Separator`, then the markdown body → AC-4
- [x] On the detail page the body shows no `img` and no `script`; a `javascript:` link has no `href`; a `/skills` link with a valid URL gets `target="_blank"` and `rel="noopener noreferrer"` → AC-5
- [x] Inspect the rendered body headings: a markdown `#` renders as `h2`, a markdown `##` as `h3`, and the page has exactly one `h1` → AC-5, AC-11
- [x] Visit `/skills/nope-not-real` → the response status is 404 and the `Skill not found` surface renders with `Back to the catalogue` → AC-6
- [x] Point the store at an empty table → the `No skills yet` Empty surface renders with its copy → AC-7
- [x] Break the read (point `DATABASE_URL` at an unreachable host) → the catalogue shows the `The catalogue could not be loaded` Alert with `Try again` → AC-7
- [x] Seed more than 20 skills → `Load more` appends the next 20 and hides once a page returns fewer than 20 rows → AC-8
- [ ] Force the Clerk lookup to fail (set a bad `CLERK_SECRET_KEY`) → the cards still render with no author blocks, and the server logs `[skills] publisher lookup failed` rather than failing the page → AC-9
- [x] Keyboard walk both pages: Tab reaches every link and button in order with a visible focus ring; the install control is reachable above the card link → AC-11
- [x] Publish a skill, wait about 30 seconds, then revisit `/` → the new skill appears without a full page reload → AC-12
- [x] Confirm no new migration or column exists (`git status` shows no `drizzle/` change) and tags, upvotes, search, moderation, SEO and image upload are untouched → AC-13
- [x] Known gap to note in the report (not a failure): the author block cannot be exercised with a seeded row, because every seeded row has a null `author_id`; it was proven by temporarily assigning a real Clerk user, then reverted. The positive path with real data needs the publish feature (scope feature 3).

## Siblings checked

- The detail page query (`skillDetailQueryOptions`) carries the same no refetch on revisit behaviour as the list did. AC-12 scopes only the list, so it is left as is and noted here rather than fixed, to keep the fix minimal.

## Commands

- [x] `npm run generate-routes` → `src/routeTree.gen.ts` includes the `/skills/$slug` route → AC-1
- [x] `npm run typecheck` → exit 0 → AC-10, AC-13
- [x] `npm run build` → exit 0 → AC-1, AC-13
- [x] `npm run check` → exit 0 → AC-11

## Value sources

- [x] Added date: the page source and the hydrated text both read the same string (e.g. `20 Sept 2026`), formatted `en-GB` at `timeZone: "UTC"` → value sourcing (added date)
- [x] `hasMore` boundary: seed exactly 20 skills → no `Load more` (an exact multiple does not offer a page that would come back empty); seed 21 → `Load more` shows → value sourcing (`hasMore`), AC-8
- [x] Link target: a skill named `PDF Reader` links to `/skills/pdf-reader` (the stored slug, not the name) → value sourcing (link target), AC-2
- [x] Install control: its enabled/disabled state follows `install_url` being present or absent → value sourcing (install control), AC-3
- [x] Author block: shown only when `author_id` resolves to a Clerk user, hidden when it is null → value sourcing (author block), AC-9
- [ ] Skeleton grid: a client side load shows six placeholder cards, a fixed constant and not a value from the data → value sourcing (skeleton grid), AC-7

## Acceptance-criteria coverage

- AC-1 covered by the intro band and grid step, the view source step, and the `generate-routes` and `build` commands
- AC-2 covered by the card contents step and the link target value source
- AC-3 covered by the install control steps and the install control value source
- AC-4 covered by the detail page step
- AC-5 covered by the sanitizer step and the heading order step
- AC-6 covered by the 404 step
- AC-7 covered by the empty state step, the error and retry step, and the skeleton value source
- AC-8 covered by the Load more step and the `hasMore` value source
- AC-9 covered by the author block step and the degraded publisher step
- AC-10 covered by the `typecheck` command
- AC-11 covered by the keyboard walk step and the heading order step
- AC-12 covered by the revisit step
- AC-13 covered by the boundary check step and the `typecheck` and `build` commands

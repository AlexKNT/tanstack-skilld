# Rationale: skill catalogue (spec 0004)

## Context

Skild's store exists (spec 0003) and holds skills, but nothing in the interface reads it. The home page is still the scaffold's marketing hero, as though the product were not built yet. The catalogue is the first feature that turns stored data into something a visitor can use, and the first real thread through UI, server and store.

The forces that shaped this decision:

- The read layer and the query layer already exist (spec 0003), so this feature should reuse them rather than introduce a second way to read a skill.
- Clerk is the one identity source (spec 0003 stored only a Clerk user id), so a publisher's name and picture are not held locally.
- The design system (spec 0002) already ships Card, Badge, Avatar, Separator, Skeleton, Empty, Alert and Spinner, and `design.md` calls the catalogue "the first real test" of the loading, empty and error surfaces.
- The project is built by Tracer Bullet, so the plan proves one thin thread before thickening it.
- The pages are public and will be indexed later (scope feature 8), so server rendering and stable URLs matter.
- The accessibility baseline in `AGENTS.md` and the measured contrast rules in spec 0002 apply to every control.
- This is a learning build with one engineer, so the surface stays small and each new dependency has to earn its place.

> ⚠️ Premise note: showing publishers means a Clerk call on the hot path of a public page, and every seeded skill is currently publisherless (spec 0003 left `author_id` empty), so the author path cannot be fully exercised with real data until the publish feature (scope feature 3) exists. The design handles this by making the author best effort and optional, so the catalogue works with or without a publisher. Deferring authors until publish would also be reasonable; this spec keeps them because a card is bland without its publisher and the lookup is cheap at this size.

## Options considered

### Decision A: Where the catalogue lives

**Option 1: The home page becomes the catalogue (chosen).**
The current hero copy becomes a compact intro band, and the skill grid sits below it at `/`.

- Pros: the product's front page is the product; one obvious place for a visitor to land; the existing hero copy survives as the intro.
- Cons: the home page loses its marketing character and gains a data dependency, so a broken store affects the front page; the hero's Create an account control and its `sign_up_started` capture have no place in the intro band, so they move to the header or are dropped.

**Option 2: The catalogue lives on its own `/skills` route.**
The home page keeps its hero and links across to the list.

- Pros: the marketing page stays independent of the store.
- Cons: a visitor has to take a second step to see the product, and two pages carry the "catalogue" idea.

**Option 3: The home page is the catalogue only, the hero removed.**
The list is the whole page with a small heading.

- Pros: the least code, nothing to reconcile.
- Cons: loses the product's framing and any chance to introduce what the site is.

Decision A chose Option 1 because the scope's intent is that the home page lists skills, and because a first time visitor should meet the product rather than a placeholder. The hero copy is reused as the intro band, so the framing is kept without a separate route.

### Decision B: How a card gets its publisher

**Option 1: Read publishers from Clerk on the server, batched (chosen).**
One `clerkClient().users.getUserList({ userId })` call per page, run inside the server function, returning only the id, name and image URL.

- Pros: no second copy of a person to keep in sync; always current; only the fields the card needs are read.
- Cons: an external call on the hot path of a public page; a slow or failing Clerk can slow or partly degrade the page; cost grows with page size.

**Option 2: Store a cached owner copy in Postgres.**
Add owner columns or a table, kept current by a Clerk webhook.

- Pros: fast local reads, one query for the whole page, no external call on the read path.
- Cons: a second copy of a person to keep in sync; a webhook to build and operate; changes spec 0003's deliberate model, which chose to hold only the Clerk id.

**Option 3: No publisher at all for now.**
Show the skill without any author credit.

- Pros: nothing to fetch, nothing to fail, honest while every seeded row is publisherless; it removes the whole Clerk call and the entire AC-9 surface, which is a larger simplification than it first looks.
- Cons: a bare card; the publish feature would then add the author later, and the detail page would look unfinished.

Decision B chose Option 1 because spec 0003 deliberately kept Clerk the only place a person lives and flagged this exact question for the catalogue, and because caching (Option 2) is a real feature with its own sync cost that this thin slice should not carry. The failure mode is contained: the lookup is best effort, so Option 1 degrades gracefully rather than breaking the page.

### Decision C: How the markdown description is rendered

**Option 1: `react-markdown` with `remark-gfm` and `rehype-sanitize` (chosen).**
The description column is rendered as markdown, with a sanitizer in the pipeline.

- Pros: the standard, well maintained pair for untrusted markdown; GitHub flavoured tables and lists come from `remark-gfm`; sanitizing in the pipeline is the safe default.
- Cons: three dependencies to review and keep patched; a rendering step that is a security surface, so images must be stripped and link protocols limited; a small bundle cost.

**Option 2: Render the description as plain text with preserved line breaks.**
No markdown parsing at all.

- Pros: no dependencies, no injection surface, trivial.
- Cons: the stored markdown shows as literal text; spec 0003 stored markdown on purpose, so this wastes the format and looks unfinished.

**Option 3: A lighter markdown parser with a hand written sanitizer.**
A smaller parser chosen at build time.

- Pros: smaller bundle than `react-markdown`.
- Cons: a hand written sanitizer is easy to get wrong, and the saving does not matter at this size.

Decision C chose Option 1 because the content is author supplied and untrusted, and a well used renderer with a dedicated sanitizer is safer and less work than assembling one. Option 2 stays available as a fallback if the dependencies ever become a burden.

### Decision D: How the list loads and pages

**Option 1: A route loader through TanStack Query, paged with `useInfiniteQuery` (chosen).**
The loader fetches the first page on the server so it is in the HTML; the client takes over and `fetchNextPage` drives Load more.

- Pros: fast first paint and SEO friendly; one query key shared by loader and client; paging comes from the library rather than hand rolled state.
- Cons: a little more wiring than a plain query; the loader must not double fetch with the client.

**Option 2: A client side query with a skeleton.**
The page renders a skeleton and the browser fetches the list.

- Pros: simpler, no server rendering concerns.
- Cons: weak first paint, nothing for the later SEO feature to index, a visible skeleton on every visit.

**Option 3: A route loader only, no client query, numbered pages.**
Each page is a fresh server render.

- Pros: simple, fully server rendered, bookmarkable pages.
- Cons: a full navigation per page, no shared cache, and page numbers on a growing list are a poorer fit than append for a catalogue.

Decision D chose Option 1 for the server rendered first paint (which the later SEO feature needs), the shared cache, and Load more being the gentler fit for browsing a growing list. Numbered pages were kept as the alternative if a shareable page number later matters more than append.

## Rationale

The decision follows from the forces in Context, not from a preference for any one tool. The read layer and the design system already exist, so the feature is mostly composition: two server functions over the existing query layer, eight primitives over a new card, and one external read (Clerk) kept best effort so it can never take the page down. That shape is what Tracer Bullet asks for, a thin thread through every layer that later slices can lean on.

Server rendering through the loader is the load bearing technical choice. It makes the first paint carry real skills, which serves both the current visitor and the SEO feature that scope feature 8 owns, and it keeps one query key shared between server and client so the data is fetched once. The cost is the extra wiring in Decision D, which is small compared with hand rolling the same behaviour.

Reading publishers from Clerk rather than caching them is the deliberate conservative choice. Spec 0003 declined an owner table for a reason, and a webhook fed cache is a feature in its own right, not a detail of this one. Keeping the lookup best effort is what makes that choice safe: because the author is optional and its failure is logged rather than thrown, the catalogue renders with or without Clerk, which is also exactly the state the seeded, publisherless data is in today.

Sanitized markdown is chosen on safety grounds. The description is author supplied, so the pipeline must strip anything executable, and using a maintained renderer and sanitizer is safer than writing one. The sanitizer is also configured deliberately: images are stripped and link protocols limited, so a description cannot smuggle remote tracking content, and markdown headings are shifted down one level so a body can never emit a second `h1`. Mapping the rendered elements onto the existing tokens, rather than adding a typography plugin, keeps the design system's rule that no colour is written directly and avoids a plugin palette that would have to be overridden everywhere.

The explicit failure style and the router's `notFound()` meet at one named boundary. Every other failure is a returned value handled in the component, but a missing skill has to become a thrown `notFound()` so the response carries a real 404 status rather than a 200 with a not found surface, which the later SEO feature depends on.

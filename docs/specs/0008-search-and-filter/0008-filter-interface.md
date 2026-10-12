# 0008 filter interface. The filter in the URL, the search box, the chip row, and the surfaces a filter needs

Child spec of [0008 search and filter](index.md), where the acceptance criteria (AC-1 to AC-16) and the cross child contract live. This file owns everything a person touches and everything the address bar holds: the URL contract, the pacing of as you type filtering, the controls, the empty surface, the announcement and the event. What a tag is belongs to [skill tags](0008-skill-tags.md); how the searching works belongs to [catalogue search](0008-catalogue-search.md).

## Summary

A filter is only useful here if the address bar is the one place it lives: that is what makes a narrowed catalogue shareable, bookmarkable and reloadable, and it is what lets the server render the filtered first page instead of flashing the full catalogue first. This decides that the catalogue route declares two optional search params, a term and a single tag, validates them and lets the router re run the page's loader when either settles. It also decides the interface that feeds them: a labelled search box that settles about a quarter of a second after typing stops and writes the URL by replacing the current history entry, a wrapping row of tag chips read from the tags in use, an empty surface that names what was filtered and clears it in one action, and one polite announcement so a screen reader user learns the result changed.

## Decision

**Chosen option**: Option 1 in Decision C of [the umbrella rationale](rationale.md). The filter lives in the router's own search params, validated by a small function on the route, with the route's loader depending on them so the filtered first page is server rendered. The search box holds the typing locally, a small hook of ours settles it after about 250ms, and the settled value is written back by replacing the current history entry. The chips come from the tag read in [skill tags](0008-skill-tags.md), the results region keeps the previous results visible while the next read is in flight, and the filtered empty surface is its own surface with its own copy.

The component inventory is deliberately small and mostly existing: the shadcn `Button` for the chips and the clear action, the `Badge` for the tags on a card (child 1), the existing `Empty`, `Skeleton`, `Alert` and `Spinner` surfaces from spec 0002, and two new pieces of our own, the search box and the chip row. Nothing about the page's frame changes: the filter band sits above the grid inside the frame spec 0004 built.

**Implementation skills**: `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`)

## Feature design

**Data model sketch**: nothing is stored. The filter's shape is the URL's shape:

| Param | Type | Present when | Validated by |
|---|---|---|---|
| `q` | string | a term is active | trimmed; only kept when it holds something other than whitespace; truncated to 100 characters |
| `tag` | string | one tag is active | put through the normalizing function from [skill tags](0008-skill-tags.md); only kept when the result matches the tag shape, otherwise the param is dropped |

Both params are optional and independent. A value that fails validation is dropped rather than refused, because an address is not a form: a stale or hand edited link still renders a page (AC-10).

**State transitions**:

The filter moves through states a person can see, and the URL moves through a small lifecycle behind them.

| The filter's state | What is shown | How it starts |
|---|---|---|
| idle, no filter | the full catalogue, newest first | neither param present |
| typing | the previous results, region marked busy | the box's local value differs from the settled value |
| settled, filtering | the filtered results, chips row still present | a settled value written to the URL, loader re runs |
| settled, matched nothing | the filtered empty surface with its clear action | a filtered read returns an empty page |
| failed | the existing error surface with its retry | the read returns a failure |

| The URL's lifecycle | What happens |
|---|---|
| typing | the local value changes; the URL is untouched, so no read runs and no history entry is written |
| settled (about 250ms after the last keystroke) | the value is written with the router's replace option, so it replaces the current entry rather than adding one |
| cleared | the param is removed rather than set to empty, so the address stays clean |
| a chip is chosen | the tag is written with replace, and choosing the active tag again removes it |
| a change the input did not cause (a badge link, a shared link, Back) | the input's local value is set from the URL, so the box and the address always agree after a settle |

**API surface**: this child adds no server function. It consumes `listSkillCards` with the two filter inputs ([catalogue search](0008-catalogue-search.md)) and `listSkillTags` ([skill tags](0008-skill-tags.md)), and it owns the route contract:

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| the catalogue route (`/`) | route with a loader | `q?: string`, `tag?: string` from the URL, plus the loader's own filter dependency so the loader re runs when either settles | the filtered first page seeded into the shared cache key, so it is in the server rendered HTML | public | a read failure renders the existing error surface; a dropped param simply does not filter |

The query options builder gains the filter: `skillCardsQueryOptions(filter)` builds the key as the existing cards key, then spec 0007's viewer segment when it exists, then the filter, so the unfiltered key is a different key from a filtered one and the home page's cached page survives a filter being applied and cleared. The filter goes last precisely so this works whether or not spec 0007 has landed. The builder keeps spec 0004's freshness (about 30 seconds) and its revalidate on revisit, and it keeps the previous page set as placeholder data so settling the filter does not blank the grid.

**Value sourcing** (this child's rows only):

| Action | Value produced / displayed | Source |
|---|---|---|
| the route | the term and the tag that filter the page | the URL's `q` and `tag`, validated on the way in by the route's own function |
| the search box | what is in the box while typing | the box's own local state; it never writes the URL until the value settles |
| the settled value | the value written back to the URL | the local value after the debounce hook settles it, decided here at about 250ms |
| the chip row | which tags are offered | `listSkillTags` (child 1), each chip's label derived from the tag at render |
| the chip row | which chip reads as selected | derived: the chip's tag equals the URL's `tag` |
| the filtered empty surface | the heading, the body and the action label | hand written copy decided here: heading `No skills match that filter`; body built from what is active (a term only: `Nothing in the catalogue matches the word "<term>".`; a tag only: `Nothing in the catalogue matches the tag "<label>".`; both: `Nothing in the catalogue matches the word "<term>" with the tag "<label>".`); action `Clear filters`, which removes both params |
| the results announcement | how many skills are shown and whether more remain | derived from the loaded pages' item count plus `hasMore`, announced through one polite live region when the filtered data for the settled filter arrives rather than when the address is written, so the number can never describe the results a previous filter left on screen; when nothing matched it announces the empty surface's heading instead |
| the results region | whether a newer read is in flight | derived: the read for the settled filter is fetching while the previous results are still shown |
| the analytics event | its name and its two fields | decided here: one event named `catalogue_filtered`, carrying the URL's `tag` and whether `q` was present as `has_query`, matching the `snake_case` names the other features use. The typed words are never sent |

**Key invariants**:
- The URL is the single source of truth. No component holds a filter value that the URL does not, and the box is the only thing that holds a value ahead of the URL, for the duration of one debounce.
- A filter change is one read per settled value, never one per keystroke, and the read is never run from the input's own value.
- The URL is written by replacing the entry, so Back leaves the catalogue. Nothing about a filter is pushed onto the history stack.
- Clearing removes params rather than emptying them, so a filtered address and an unfiltered one are plainly different.
- Changing one filter never drops the other: settling a term keeps the active tag and picking a tag keeps the term.
- Results never blank while a filter settles. The previous results stay, and the region is marked busy, so the page does not flicker on every settle.
- Every state the catalogue already had is preserved under a filter: the first load skeleton, the error surface with its retry, and Load more.
- One polite live region announces the outcome. The count is derived from what is loaded, so it never claims a total the read did not produce.
- The announcement describes what is on screen: it is updated when the filtered data for the settled filter arrives, never at the moment the address is written, so it can never describe the results a previous filter left visible.
- The address repairs and the read refuses, on purpose. A value that fails validation is dropped or normalized here, so a stale link still renders a page, while the same value sent straight to the read is refused with a named field (see [catalogue search](0008-catalogue-search.md)). One shared sanitizer sits behind both.
- A tag chip can only be offered for a tag some skill carries, because the row is read from the store rather than written into the app.
- The page's frame, its one `h1`, its heading order and its intro copy are unchanged from spec 0004.

**Security model**: no new credential, identity or permission. The read the filter drives stays public ([catalogue search](0008-catalogue-search.md)). The filter's validation is the first check on anything arriving in an address, so it runs before a value reaches the read. The analytics event carries the chosen tag (public data) and whether a term was present, never the typed words, so nothing a person wrote leaves the app for an analytics service. No compliance scope applies.

**Critical test scenarios** (each maps to an acceptance criterion in the umbrella):
- Typing: with the box focused, a phrase typed quickly settles once, one read runs, and the grid never blanks, verifies **AC-11**
- The address: a settled term and a tag both appear in the URL, a reload shows the same filtered view, a shared link with both shows the same view in the server rendered HTML, a malformed `tag` is dropped without an error, and Back leaves the catalogue, verifies **AC-10**, **AC-11**
- Nothing matched: a filter matching nothing shows the filtered empty surface, its copy names what was active, and its clear action empties both params and restores the full catalogue, verifies **AC-12**
- The other surfaces: the first load still shows the skeleton grid, a broken read still shows the error surface with a working retry, and Load more under a filter appends the next filtered page, disables itself while loading and disappears at the end, verifies **AC-12**, **AC-15**
- Chips: the row shows only tags in use, most used first, the active chip reads as selected, choosing it again clears the tag, and a chip click keeps any typed term, verifies **AC-9**, **AC-13**
- Keyboard and width: every control is reachable in a sensible order with a visible focus ring, the announcement fires once the filtered results arrive and describes them, and the whole filter wraps inside 320px, verifies **AC-13**
- Analytics: a settled filter change captures exactly one `catalogue_filtered` event carrying the tag and whether a term was present, clearing captures none, and no typed words appear, verifies **AC-14**

## Build plan

Ordered for the project's Tracer Bullet approach: the URL contract and the read it drives come first, so the filter is real end to end before any of the new chrome exists, then the controls and the surfaces are added one at a time.

1. The URL contract: the route gains its validating function and its loader dependency, and the query options builder takes the filter and appends it to the key after whatever the key already carries (the viewer segment, once spec 0007 lands). The page then filters from a hand typed address alone, satisfies **AC-10**, **AC-5**
2. Confirming the thin thread: `?q=` and `?tag=` in the address narrow the grid through the existing cards, paging and states, with no new chrome yet, satisfies **AC-10**, **AC-6**, **AC-8**
3. The pacing hook: `src/hooks/use-debounced-value.ts`, about fifteen lines with the delay as a named constant, plus the navigation that replaces the entry and preserves the other filter, satisfies **AC-11**
4. The search box: a labelled input that shows what is in the address, settles into it, and never blanks the results while settling, satisfies **AC-11**, **AC-13**
5. The chip row: the tag read rendered as buttons with a selected state, wrapping under the box, choosing the active tag clears it, satisfies **AC-9**, **AC-13**
6. The filtered empty surface and the clear action, told apart from the catalogue's "no skills yet" surface, with Load more and the error surface still working underneath, satisfies **AC-12**, **AC-15**
7. The announcement: one polite live region reporting how many skills are shown and whether more remain, and the empty heading when nothing matched, satisfies **AC-13**
8. The event: one `catalogue_filtered` capture per settled filter change, carrying the tag and whether a term was present, satisfied **AC-14**
9. The pass: a keyboard walk, the selected state, the focus rings, the whole filter at 320px, and a boundary check that the shared header and the other routes are untouched, then `/check verify search and filter`, satisfies **AC-13**, **AC-16**

## Consequences

**Positive**:
- A filtered view is shareable, bookmarkable and reloadable for free, because it is just an address, and the filtered first page is server rendered rather than fetched after paint.
- Back behaves the way a visitor expects, because the filter replaces history instead of filling it with half typed words.
- The chips come from real data, so the filter can never offer a tag that leads to nothing.
- The interface adds two components and reuses every state the design system already provides, so there is one look to keep rather than a second set of surfaces.
- The controls are small and self contained, which keeps them readable next to the rest of the catalogue page.

**Negative / tradeoffs**:
- Two ways to be filtered (a term and a tag) mean two ways to reach an empty result, so the empty copy has to name whichever is active without sounding like an error.
- Typing feels slightly behind the keyboard, by design, because the read runs on the settled value rather than on every keystroke; the previous results staying visible is what keeps that from reading as lag.
- Keeping the previous results visible while a filter settles means there is a brief moment where the visible list does not match the address. The busy marker on the region is the honest signal for it.
- The count in the announcement is what is loaded, not a total, so a filtered set with further pages announces "more available" rather than an exact number.
- A hand edited or stale link is silently repaired rather than refused, which is friendlier in a browser and slightly less strict than a form.
- The page's size grows by a filter band, so the catalogue page has one more region to keep accessible and one more state to render in the design's language.

**Neutral**:
- The route now re runs its loader when the filter changes, which is a new pattern in this codebase (the account skills route validates a search param but does not depend on it), so the loader dependency is the part worth reading carefully.
- The query key gains a filter segment, so each distinct filter is its own cached page set. Bounded by the query cache's own limits, and the unfiltered key stays untouched.
- Holding the previous results while the next filter loads sits on top of the existing revalidate on revisit behaviour, so the number of reads for one settled value is worth watching in the verification pass. The acceptance criterion is one read per settled value, and the check is on the network, not on the code's intention.
- `src/hooks/` arrives as a shared folder for the first time, alongside the folders `AGENTS.md` already describes.

## Rationale

The scope row asks for the choice to be in the URL, and the router's own search params deliver exactly that with no dependency, which is also why the small URL state library was rejected: two libraries owning the address is one more thing to keep in step for behaviour the router already has. The pacing decision follows from the shape of the filter rather than from taste: a read per keystroke against a store read is wasteful and makes the results jump around, so the box holds the typing, the settled value goes to the URL, and the read runs once. Replace rather than push was chosen because Back is a navigation tool, not an undo stack for typing, and because a shared link does not care how the address was written. The chips are buttons with a selected state rather than links, because the chip is an action on this page (choose, or choose again to clear) while the badge on a card (child 1) is the link that carries a tag into a new address, and that split gives a keyboard user a clear pressed state without a second navigation model. Finally, the filtered empty surface is its own surface because the catalogue already has a "no skills yet" surface, and telling a visitor that the catalogue is empty when it was their filter that matched nothing would be a small lie told by the interface.

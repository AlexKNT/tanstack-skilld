# 0008. Narrow the skill catalogue by text and by tag, with the filter in the URL

**Date**: 2026-10-12
**Status**: Accepted

## Summary

The catalogue can only be browsed newest first, so a visitor with something particular in mind has to read every card. This decides how they narrow it: a skill gains tags (short labels its author types), a search box looks across the name, the summary and the description, and a row of tag chips offers the tags actually in use. Both choices live in the URL, so a filtered view can be shared and reloaded and looks the same. The searching is done by the Postgres database the project already runs, so no new service, dependency or environment variable arrives, and the work is written as three child specs (the tags, the search itself, and the filter's interface) because each can be built and shipped on its own.

## Structure

- [skill tags](0008-skill-tags.md): the tag list stored on a skill, the one rule that shapes a tag, the two forms that collect it, and where a tag is shown. It supports the decision to filter the catalogue by tag, and it is the only part of this feature that changes the store.
- [catalogue search](0008-catalogue-search.md): the stored search document built from a skill's name, summary and description, the word prefix rule, the way untrusted text is turned into a safe query, and the new optional inputs on the catalogue read. It supports the decision to narrow the catalogue by text.
- [filter interface](0008-filter-interface.md): the URL contract, the search box, the chip row read from the tags in use, the pacing of as you type filtering, and the surfaces and announcement a filter needs. It supports the decision to keep the choice in the URL so the view is shareable.

## Requirements

**User stories**:
- As a visitor, I want to type what I am looking for and see the catalogue narrow as I type, so that I do not have to read every card.
- As a visitor, I want to pick a tag that interests me, so that I can browse a topic rather than guess at words.
- As a visitor, I want the filter to be part of the address I am looking at, so that I can share it, bookmark it and reload it and see the same view.
- As a visitor whose filter matched nothing, I want to be told it was my filter and to clear it in one action, so that I stop wondering whether the catalogue is broken.
- As an author, I want to label my skill with a few tags, so that people browsing by topic can find it.
- As the engineer, I want the searching done by the database already in place, so that this feature adds nothing new to run.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The `skills` table gains a required `tags` column holding a list of tag strings, with a database default of an empty list, and the same migration adds the stored search document described in AC-6. Existing rows are left untouched and keep their ids, a row written before the migration reads as having no tags, and running the migration twice changes nothing.
- **AC-2**: One shared tag rule is used by the store, the publish form and the edit form: a tag is trimmed, lowercased, inner spaces collapsed into single dashes, must be 1 to 24 characters of lowercase letters and digits joined by single dashes, a skill may carry at most 5 tags, duplicates collapse, and the stored list is kept in alphabetical order. A value that still breaks the rule after that treatment is refused with a failure naming the field, and an empty tag list is a valid skill.
- **AC-3**: The publish form and the edit form each collect tags through a labelled control that states the rule, shows the field level message the server returns when a tag is refused, and accepts the same values, so a skill published with tags reads back with the same tags after an edit.
- **AC-4**: A skill's tags are shown as badges on its catalogue card and on its detail page, each badge is a link that applies that tag as the filter, and no badge becomes an interactive control nested inside another one.
- **AC-5**: The catalogue read accepts an optional search term and an optional tag and keeps everything else about itself: the page size of 20, the offset paging, the newest first order, the "one extra row read" rule that decides whether more pages follow, the card shape, the batched publisher read, and public access. With neither input present the read returns exactly what it returns today.
- **AC-6**: A search term matches whole words and word beginnings across a skill's name, summary and description, with the usual word endings handled, so typing `react` finds `React`, `reacts` and `reacting`, and typing `reac` also finds `React`. A term that matches nothing produces an empty page rather than a failure.
- **AC-7**: No term reaches the store as live query syntax. The term is trimmed, limited to 100 characters and at most 8 words of up to 40 characters each, split into words on anything that is not a letter or digit so each word holds only letters and digits, and passed as a bound value rather than pasted into a statement, so a value carrying quotation marks, `&`, `|`, `!`, `:`, `(`, `)` or a very long string can never cause a store error, and a dashed term such as `machine-learning` is searched as its two words rather than as one word run together. A term that is only whitespace, only punctuation, or empty counts as no term at all.
- **AC-8**: A tag filter returns the skills carrying that tag, compared against the stored form after the incoming value is normalized the way a stored tag is, so a tag written with capitals in an address filters exactly as the lower case one does, and a tag filter combined with a term returns the skills matching both.
- **AC-9**: The tags offered as chips are read from the store as the tags actually in use, each with the number of skills carrying it, ordered by that number descending and then by the tag itself so the order is stable, so a chip can only exist for a tag that some skill carries.
- **AC-10**: The filter lives in the URL as an optional search term (`q`) and an optional single tag (`tag`), validated where the URL is read: a value that fails validation is dropped rather than reaching the read. The catalogue renders from the URL alone, so a shared or reloaded filtered link shows the same filtered first page in the server rendered HTML.
- **AC-11**: Typing in the search box narrows the catalogue as the visitor types, settling about 250ms after typing stops, so a fast typist causes one read per settled value rather than one per keystroke; while the next filtered read is in flight the previous results stay visible instead of flashing a skeleton. The settled value is written into the URL by replacing the current history entry, so Back leaves the catalogue rather than walking back through half typed words.
- **AC-12**: A filter that matches nothing shows its own empty surface, distinct from the catalogue's "no skills yet" surface, naming what was filtered and offering one action that clears the filter from the URL. The filtered list keeps every state the catalogue already has: the loading placeholder, the error surface with its retry action, and Load more.
- **AC-13**: The search box and the tag chips are labelled, keyboard reachable, and show a visible focus ring; the active tag is exposed as selected rather than only coloured; a filter change announces the number of skills shown and whether more remain through a polite live region (a container assistive technology reads out when its text changes); and the whole filter works at 320px, where the chip row wraps rather than scrolling sideways.
- **AC-14**: A settled filter change captures exactly one PostHog event, named `catalogue_filtered`, carrying the chosen tag and whether a term was present (`has_query`), never the typed words, in the same shape the other features capture their events, and a read that changes nothing captures nothing.
- **AC-15**: Load more works under a filter: it appends the next page of the filtered set, shows the spinner and is disabled while loading, and disappears when the filtered set is exhausted, using the same page size as the unfiltered catalogue.
- **AC-16**: The scope boundary holds: the search box and the chips live on the catalogue page only (the shared site header is untouched), and ranking by relevance, typo tolerance, synonyms, filtering by several tags at once, tag moderation or merging, a tag page, and indexing rules for filtered URLs all stay out. No new dependency, service, database extension or environment variable is added, and no auth rule changes: the reads stay public and tags are written only through the publish and edit flows that already take the author from the signed in session.

## Decision

**Chosen option**: Option 1 in each of the three child specs: free text tags typed by the author and stored as a list on the skill row, the catalogue read extended with an optional term and tag served by Postgres's own full text search, and the filter held in the router's own search params with the chips read from the tags in use.

Tags are values on the skill, not a vocabulary to maintain: the column holds a normalized list, the rule lives in one shared module and in a database check, and a badge label is derived at render rather than stored. Searching is a stored search document generated by Postgres from the name, the summary and the description, one index on it, one index on the tag list, and a query built from the term inside a server function so untrusted text can only ever be data. The filter is the router's search params, so the URL is the single source of truth and a filtered view is shareable by construction, with a small hook of our own pacing the typing and the navigation replacing rather than pushing history.

**Implementation skills**: `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`)

## Cross child contract

The three children meet on four things, decided here so neither has to invent them:

1. **The filter's shape.** Two optional values travel together everywhere: `term` (what the visitor typed) and `tag` (the single chosen tag). In the URL they are `q` and `tag`; on the read they are `term` and `tag`. The term is the sanitized form described in AC-7; the tag is the stored tag value. The URL is the only place a filter is held, so no component owns filter state. Child 3 owns the URL side, child 2 owns the read side, child 1 owns what a tag value *is*. A value that fails validation is repaired at the address (dropped or normalized, because an address is not a form) and refused at the read (because the read is a public entry point anything can call), and one shared sanitizer sits behind both so the two cannot drift into two different ideas of a term.
2. **The card shape.** A card gains `tags: string[]` (child 1). Spec 0007 already adds `upvoteCount` and the viewer's own vote state to the same card; this feature adds to that shape and does not change it. The card is built in one place, so both features' fields arrive from one read.
3. **The cache key.** The catalogue's query key becomes the existing `skillKeys.cards()` with the validated filter added after spec 0007's viewer segment, so the shapes are `["skills", "cards", viewer, filter]`. The filter goes last on purpose: the builder appends it to whatever the key already carries, so this shape holds whether or not spec 0007's viewer segment has landed yet, and when both are present the order is viewer, then filter. The key is built by the shared `skillCardsQueryOptions(filter)` helper, so the route loader and the client always ask for the same page, which is what keeps the server rendered first page from being fetched a second time (spec 0004's rule). The unfiltered case stays a distinct key, so the home page's cached first page is not thrown away when a filter is applied and cleared.
4. **One migration, one read.** The store change is a single migration (child 1), and both filtered reads and the tag chips read from the read layer this feature extends; there is no second source of truth for a tag.

5. **When the cache is invalidated.** A successful write to a skill (publishing, editing or deleting) invalidates the whole `skills` key family rather than one key, so a newly used or renamed tag reaches the chips and a page cached under an old tag cannot keep serving the cards that no longer match. A write by somebody else is not broadcast; it is picked up by the existing freshness window and the revalidate on revisit, which is the behaviour the catalogue already has today.

## Feature design

**Data model sketch** (the detail lives in [skill tags](0008-skill-tags.md)):

One existing table is extended, nothing is created except indexes.

| Entity | Change |
|---|---|
| `skills` (spec 0003) | gains `tags` (`text[]`, required, default `'{}'`, at most 5 entries, each entry normalized by the shared rule) and `search_document` (`tsvector`, always generated by the store from `name`, `summary` and `description`, never written by the application), a GIN index on each, and a check constraint expressing the tag rule |

There is no new relationship and no new entity, so there is nothing to model as a foreign key and no cardinality to settle. The publisher stays outside the store (a Clerk user id on the row), and the tag list stays inside it.

**State transitions**: No stored entity gains a state. A skill's tag list is replaced wholesale on each save, so there is no per tag lifecycle to model, and the filter's own states are interface states, not stored ones: the list is idle, loading, loaded, empty because nothing matched, or failed.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listSkillCards` (extended) | read (server function, GET) | `limit?` (default 20, ceiling 100), `offset?` (default 0), `term?` (optional, trimmed, capped as AC-7), `tag?` (optional, a stored tag value) | `{ items: card[], hasMore }` where a card now carries `tags`, newest first | public | `VALIDATION_FAILED`, `SKILLS_QUERY_FAILED` |
| `listSkillTags` (new) | read (server function, GET) | none | `{ items: [{ tag: string, count: number }] }`, most used first, ties by tag text | public | `SKILLS_QUERY_FAILED` |
| `getSkillDetail` (extended) | read (server function, GET) | `slug: string` (required) | the detail row, now carrying `tags` | public | `VALIDATION_FAILED`, `SKILL_NOT_FOUND`, `SKILLS_QUERY_FAILED` |
| `createSkill` (extended) | write (server function, POST) | the existing fields plus `tags?: string[]` (optional) | the created skill, carrying its stored tags | signed in | `UNAUTHENTICATED`, `VALIDATION_FAILED`, `SKILLS_WRITE_FAILED` |
| `updateSkill` (extended) | write (server function, POST) | the existing fields plus `slug` and `tags?: string[]` | the updated skill, carrying its stored tags | signed in, owner only | `UNAUTHENTICATED`, `SKILL_NOT_FOUND`, `VALIDATION_FAILED`, `SKILLS_WRITE_FAILED` |

Two new failure shapes are deliberately not invented: a term with no matches and a tag with no matches are both a successful empty page, not failures, because an empty result is a normal answer the interface must render (AC-12) rather than an error. The existing failure codes cover everything else, so no new code is added.

**Value sourcing** (name the source of every value an action produces, computes or displays; a value with no named source is an undecided input):

| Action | Value produced / displayed | Source |
|---|---|---|
| the migration | the tag list and the search document of each existing skill | the `tags` column default (an empty list) and the store's generated `search_document` column; nothing is copied and no backfill script exists |
| `createSkill`, `updateSkill` | the normalized tag list stored with the skill | the author's input, put through the shared tag rule (child 1) |
| `listSkillCards`, `getSkillDetail` | the tags shown on a card and on a detail page | the `tags` column, returned as stored (child 1) |
| `listSkillCards` | the term and the tag that narrow the page | the URL's `q` and `tag`, validated by the route's `validateSearch` (child 3), passed as read inputs |
| `listSkillCards` | whether a skill matches the term | the store's `search_document` column, matched against the query built from the sanitized term (child 2) |
| `listSkillCards` | whether a skill carries the filtered tag | the `tags` column (child 1) |
| `listSkillCards` | `hasMore` under a filter | spec 0004's existing rule, one extra row read, unchanged |
| `listSkillCards` | the order of a filtered page | the `created_at` and `id` columns, descending, unchanged from spec 0004 |
| `listSkillTags` | the tag values offered as chips | the `tags` column, grouped, one row per tag (child 1) |
| `listSkillTags` | the number shown beside a chip | `count(*)` over the skills carrying that tag, computed at read time |
| `listSkillTags` | the order of the chips | derived: count descending, then the tag's own text ascending, so the order is stable |
| a badge and a chip | the words a person reads for a tag | derived at render from the stored tag value (dashes become spaces, the first letter is capitalized). No second stored field, so a label can never drift from its tag |
| the filter's current state | which term and which tag are active | the URL only, through the route's validated search params (child 3). Nothing else holds a filter value |
| the URL value written while typing | the settled term and the settled tag | the search box's own local value and the chip click, paced by the debounce hook decided here (about 250ms), then written by replacing the history entry |
| the filtered empty surface | its heading, body and clear action label | hand written copy decided in child 3 |
| the announcement | how many skills are shown and whether more remain | derived from the loaded pages' item count plus `hasMore` |
| the analytics event | its name and its two fields | decided here: one event named `catalogue_filtered`, carrying the URL's `tag` and whether `q` was present, so the typed words are never sent |
| the read's validation limits | the longest term, the most words, the longest word | decided here: 100 characters for the term, 8 words, 40 characters per word (AC-7) |

**Key invariants**:
- The URL is the single source of truth for the filter. No component holds a filter value the URL does not.
- Every read of the cards stays bounded. No card read asks for every row, filtered or not. The one exception is the tag read behind the chips, which aggregates the whole tag column: it is bounded by the number of distinct tags rather than by the number of skills, and it is stated plainly here rather than dressed up as a bounded read.
- A filter never changes the order. Newest first everywhere, first page and later pages, and the upvote count never reorders anything (spec 0007).
- A stored tag is always the normalized form; a label a person reads is always derived at render.
- Both forms validate tags with the same shared function, and the store's check is the second line of defence, so a future import obeys the same rule.
- A term can only ever be a value, never query syntax, and it reaches the store as a bound parameter.
- A write to a skill invalidates the whole `skills` key family, so a new or renamed tag reaches the chips and a filtered page cannot keep serving cards that no longer match.
- An empty result is a success. Only a broken read is a failure.
- The card stays one clickable surface with no interactive control nested inside another: the tag badges, the install control and the vote control are each layered above the stretched title link (spec 0004's pattern).
- A shared filtered link is server rendered, so the filtered first page is in the HTML rather than fetched after paint.
- The unfiltered catalogue behaves exactly as it does today, including its page size, its order, its states and its cached first page.
- Filtering never reveals anything: the reads stay public and return the same rows a visitor could reach by browsing.

**Security model**:
- Both new or changed reads are public, matching the catalogue (spec 0004). No read takes an identity and none changes its answer based on one, apart from spec 0007's existing viewer segment on the card shape.
- Tags are written only through `createSkill` and `updateSkill`, which already require a signed in session and enforce ownership (specs 0005 and 0006). No new role, no new permission, no way for one person to change another person's tags.
- The term is untrusted input that would otherwise reach a query language, so it is split into words of letters and digits, capped, and passed as a bound parameter. It can never reshape a statement.
- A tag is user generated public text. The shape rule keeps it to lowercase letters, digits and dashes, and it is always rendered as text rather than markup, so it cannot carry anything executable or styled.
- The analytics event carries the chosen tag (already public data) and whether a term was present, never the typed words, so nothing a person wrote leaves the app.
- No compliance scope applies: no payment, health or regulated data is involved, and the only personal data remains a Clerk user's public profile fields.
- Known and accepted: the search read is public and unthrottled, exactly like the catalogue read beside it. A rate limit is a cross cutting hardening decision, not one this feature should invent (a follow-up records it).

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: publish a skill with two tags, see the badges on its card and its detail page, type a word into the box and watch the list narrow, then click a badge and see the tag filter applied in the URL, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-8**
- Nothing matched: a term that matches nothing shows the filtered empty surface, and its clear action returns the catalogue to its unfiltered state with the filter gone from the URL, verifies **AC-12**, **AC-10**
- Shared and reloaded: a link carrying `q` and `tag` renders the same filtered first page on the server, a reload is the same view, a malformed `tag` is dropped without a failure, and Back leaves the catalogue, verifies **AC-10**, **AC-11**
- Store level: the migration runs on a database that already holds skills with every id unchanged, a sixth tag and a malformed tag are both refused by the store, and a row written before the migration reads as having no tags, verifies **AC-1**, **AC-2**
- Query safety: terms carrying quotation marks, `&`, `|`, `!`, `:`, parentheses, only whitespace, only punctuation, and a 500 character string each end in a normal answer rather than a store error, verifies **AC-7**
- Paging under a filter: with more filtered skills than one page, Load more appends the next filtered page, disables itself while loading, and disappears at the end, verifies **AC-15**
- Degraded read: with the store broken, the filtered list shows the existing error surface with a working retry, verifies **AC-12**
- Permission: a signed out visitor can search and filter and receives the same rows a signed in visitor does, and a signed out call to change a skill's tags is refused and writes nothing, verifies **AC-16**, **AC-3**
- Accessibility: a keyboard walk of the search box, the chips and the badges with a visible focus ring, the selected state exposed on the active chip, the announcement on a filter change, and the whole filter at 320px, verifies **AC-13**

## Build plan

Ordered for the project's Tracer Bullet approach: get one thin thread working from the URL through the read to the store and back before thickening any layer. That means the filter works with plain chrome first and the store change lands early only because everything else needs it, while the tags, the query safety and the interface arrive in the order that keeps the app runnable and honest at each step. The detail for each step lives in the child spec named in it.

1. Store and rule: one migration adds the tag list and the search document with their two indexes, and the shared tag rule lands beside spec 0003's field rules so both forms and the store can use it, satisfies **AC-1**, **AC-2**
2. Thin thread: the catalogue read gains the optional `term` and `tag`, the store filters, and the home route reads both from the URL and renders the narrowed grid with the cards, the paging and the states it already has, before any new chrome exists, satisfies **AC-5**, **AC-6**, **AC-8**, **AC-10**
3. Tags end to end: the publish form and the edit form collect tags, the card and the detail page show them, and a badge applies its own tag as the filter, satisfies **AC-3**, **AC-4**
4. Query safety: the term is split into words of letters and digits, capped, and turned into a store query that can only read it as data, satisfies **AC-7**
5. The filter's interface: the search box, the chip row read from the tags in use, the pacing hook, the navigation that replaces history, the filtered empty surface that clears the filter, the announcement, and Load more under a filter, satisfies **AC-9**, **AC-11**, **AC-12**, **AC-13**, **AC-15**
6. Analytics and the pass: the one event per settled change, then the keyboard and 320px walk, and a boundary check that nothing else moved (the shared header, the other routes, the dependency list and the environment), satisfies **AC-14**, **AC-13**, **AC-16**
7. Verify the feature: `/check verify search and filter`

## Consequences

**Positive**:
- A visitor can find a skill by what it says or by what it is about, and can share exactly the view they are looking at, because the address carries the filter.
- Nothing new is added to run: no service, no dependency, no extension, no environment variable and no secret. The searching is a column, two indexes and a query inside the database the project already pays for.
- The tags are a list on the skill row, so there is no vocabulary to curate and no second table to keep in step, and a skill's tags travel with it through every existing read.
- Because the filter is validated at the URL, the whole filtered view is server rendered and shareable by construction rather than by a later fix.
- The shared tag rule means a tag means the same thing to the store, the publish form and the edit form, so the three cannot drift apart.

**Negative / tradeoffs**:
- No typo tolerance and no synonyms: a visitor who mistypes a word sees the empty surface. The chosen matching rule (word beginnings with endings handled) is what makes that possible to index cheaply, and it is the trade accepted for having no external search service.
- A term made only of very common words (the kind of word the `english` dictionary treats as noise) matches nothing rather than everything. Honest, but it will surprise someone once.
- Tags are free text, so the same topic can arrive as several near duplicates (`react`, `reactjs`, `react-js`) and the chip row will slowly fill with them. Normalization removes the easy cases only, and merging tags later is a data migration because tags are stored on the rows.
- Every tag is a value on the skill, so renaming a tag means writing every row that carries it. A curated vocabulary would have made that one row, at the cost of two tables and a picker.
- The search document is maintained by the store on every write, so a skill insert or update now also maintains a second index. That is a small write cost accepted for a fast read.
- The filtered empty surface and the tag chip row are new interface pieces, so the catalogue page grows: one more state to build, and one more surface to keep accessible.
- Two ways to narrow the catalogue (words and tags) mean two ways to reach an empty result, so the copy has to explain both without blaming the visitor.

**Neutral**:
- A migration is needed, and it is the one this feature adds. It rewrites the `skills` table to add a generated column, so it takes a lock for its duration; on a database this size that is a moment, and it is worth knowing before running it against a live database.
- The migration generated from the schema has to be hand edited once, because a database check that validates each tag needs a small immutable helper function, and the schema alone cannot express "create this function". The generated SQL is edited to create the function before the constraint that uses it.
- Untrusted text now reaches a query builder, which is a new pattern in this codebase: the sanitizing step and the caps are the whole defence, so they must stay in one place with a test beside them.
- The catalogue's cache key gains a filter segment, so each distinct filter is cached separately. Bounded by the query cache's limits, and the unfiltered key keeps its own cached page.
- Filtered URLs are ordinary URLs and are not marked as non indexable here; whether a filtered view should be indexed belongs to spec for SEO metadata and the sitemap (a follow-up records it).

## Follow-up

- [ ] A premise worth watching: free text tags drift into near duplicates as the catalogue grows. A cheap mitigation later is to suggest the tags already in use while the author types in the tag control (the chip read already returns them, so no new read is needed), and a heavier one is a merge pass, which is a data migration because tags live on the rows. Worth revisiting when the chip row starts showing near twins.
- [ ] Spec 0007 (upvotes) is in progress and touches the same catalogue read, the same card shape and the same query key. Land it first if you can, or land the two together. The key is specified so the filter segment appends to whatever the key already carries, so building this first needs no rework of the key, only a re-check of the order once spec 0007 lands.
- [ ] The search read is public and unthrottled, like the catalogue read beside it and the detail read. A rate limit for public reads is a cross cutting decision; it is recorded here rather than invented, and it belongs with the hardening work.
- [ ] Filtered URLs are not marked as non indexable, and a filtered view is thin and duplicative content for a crawler. Leave it to the SEO metadata and sitemap spec, which owns titles, descriptions, canonicals and the sitemap.
- [ ] A tag page per tag (a landing page listing the skills carrying it) would give each tag a URL worth ranking, and would reuse the filtered read this feature builds. Out of scope here, and a candidate for the hardening or a later slice.
- [ ] Spec 0005 (publish a skill) and spec 0006 (signed in area) each describe their forms in detail; both forms now carry a tag control that this feature decides. If those specs are still read as the contract for the forms, `/sync` should note the added field there.
- [ ] The `src/features/skills` area has no nested `AGENTS.md` while the theme and account areas do. When the area's conventions (the tag rule, the read's failure style, the query key shape) stabilise, a nested file is the right home for them.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

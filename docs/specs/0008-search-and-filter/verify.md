# Verify: search and filter · spec 0008 · updated 2026 10 14

_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open `/` → a filter band sits above the grid, holding a labelled "Search skills" box with its hint and a "Tags in use" row whose chips carry a count and only name tags some skill carries, most used first and ties in alphabetical order → AC-9, AC-13
- [ ] Type `reac` in the box and pause → the address becomes `/?q=reac`, the grid narrows to skills matching that word beginning (it finds `react`, `reachable` and `reaching`), and the results already on screen stay there while the next read runs rather than being replaced by a skeleton → AC-6, AC-11
- [ ] Type five or more characters quickly → exactly one read runs once typing stops, and the browser's history still holds one entry, so Back leaves the catalogue rather than walking back through half typed words → AC-11
- [ ] Open a shared link to `/?q=react&tag=writing` in a fresh tab → View source shows the filtered first page in the served HTML rather than an empty list that fills in after paint → AC-10
- [ ] Open `/?tag=GIT` → the same two skills as `/?tag=git`; open `/?tag=!!` → the parameter is dropped and the full catalogue renders with no error → AC-8, AC-10
- [ ] Open `/?q=zzzz` → the "No skills match that filter" surface, naming the word that was searched, told apart from the catalogue's "No skills yet" surface; activate "Clear filters" → the address is empty again and the full catalogue returns → AC-12
- [ ] With a term typed, activate a tag chip, then activate the same chip again → the tag is added and kept alongside the term, and choosing it again clears only the tag → AC-9, AC-13
- [ ] In the catalogue, activate a badge on a card (for example "Git") → the address carries that tag, the term still active is kept, and the grid narrows to the skills carrying it; open the same badge in a new tab → it works as an ordinary link → AC-4
- [ ] On a skill's page, activate a badge → the catalogue opens filtered by that tag → AC-4
- [ ] Keyboard walk of the filter: Tab to the box, to each chip and to the badges → each takes focus with the visible ring in both themes, the active chip reads as selected rather than only coloured, and the badges are separate stops from the card's title link → AC-4, AC-13
- [ ] With a screen reader or the accessibility tree inspector, settle a filter change → one polite live region announces the number of skills shown and whether more remain, and the empty heading when nothing matched, and it fires once the filtered results arrive rather than when the address changes → AC-13
- [ ] Narrow the window to 320px with a filter applied → nothing overflows sideways and the chip row wraps instead of scrolling → AC-13
- [ ] Apply a filter that leaves more than one page of matches and activate "Load more" → the next page of the filtered set is appended, the control shows the spinner and is disabled while loading, and it disappears when the filtered set is exhausted → AC-15
- [ ] With a filter applied, stop the database and settle a filter change → the existing error surface with a working retry appears instead of the grid, and the retry recovers once the store answers again → AC-12
- [ ] Signed in, publish a skill with the tags `React, machine learning` → it saves, and its card and its page show the two badges as `Machine learning` and `React` with the address `/?tag=machine-learning` and `/?tag=react` → AC-2, AC-3, AC-4
- [ ] Signed in, open that skill's edit form → the tag control holds `machine-learning, react`; save without changing them → the same two tags come back, in the same order → AC-3
- [ ] In either form, enter a 25 character tag, then a tag of only dashes, then six tags → each is refused with the message beside the tag control naming the tags field and nothing is written → AC-2, AC-3

## Commands

- [ ] `npm run db:migrate` against a database that already holds skills, then run it a second time → both runs succeed, the second changes nothing, and `drizzle/meta/_journal.json` records `0003` once → AC-1
- [ ] Introspect `skills` in `npm run db:studio` → a `tags` column (`text[]`, not null, default `'{}'`), a `search_document` column (`tsvector`, generated always from name, summary and description), a check constraint calling `skills_tags_valid`, and a GIN index on each of the two columns → AC-1
- [ ] Read a skill row written before the migration → it keeps its id, reads with an empty tag list, and is found by a term search (the generated document covers it) → AC-1
- [ ] Insert a skill directly with a malformed tag, then with six tags → both are refused by the store (`23514`), and a skill with no tags is accepted → AC-1, AC-2
- [ ] `npm run db:seed` → the same eight sample skills are reported as already present and nothing is replaced → AC-1
- [ ] `npm run typecheck` → passes → build guard
- [ ] `npx biome check src` on a Linux checkout or CI → passes; on a Windows checkout the files this feature touched are LF, so `npx biome check --staged` passes while untouched files report line ending differences that predate this change → build guard
- [ ] `npm run build` → passes → build guard
- [ ] `/test`: `buildSearchQuery` over `'; drop table skills; --`, `a & | ! : ( ) <script>`, `!!!`, a 500 character string, 50 words, `machine-learning` and `   ` → words hold only letters and digits, each capped at 100 characters for the term, 8 words and 40 characters per word, and each result is a query of prefix terms or nothing at all → AC-7
- [ ] `/test`: `validateListSkillsInput` with `tag: 'GIT '` → `git`; with `tag: '!!'` → `VALIDATION_FAILED` naming `tag`; with `term: '  '` → no term at all; with a 500 character term → accepted and capped → AC-8, AC-7
- [ ] `/test`: `validateTags(['React', 'react ', 'machine learning', 'react'])` → `['machine-learning', 'react']`; with six tags → `VALIDATION_FAILED` naming `tags` → AC-2

## Acceptance criteria coverage

- AC-1 → the migration command, the schema introspection, the pre migration row, the store refusals and the seed run
- AC-2 → the store refusals, the publish step, the form refusals and the tag rule unit step
- AC-3 → the publish step, the edit step and the form refusal step
- AC-4 → the badge steps in the catalogue and on the skill page, and the keyboard walk
- AC-5 → the unfiltered and filtered catalogue steps, where the page size, the order and the extra row rule are unchanged; plus the shared link step
- AC-6 → the `reac` step and the shared link step
- AC-7 → the unit step over hostile terms, and the malformed tag address step
- AC-8 → the `/?tag=GIT` step, the chip combined with a term step, and the validation unit step
- AC-9 → the chips step in the band and the chip toggle step
- AC-10 → the shared link step, the malformed address step and the empty address step
- AC-11 → the typing step, the fast typing step and the serving step, watched on the network
- AC-12 → the nothing matched step and the store outage step
- AC-13 → the keyboard walk, the announcement step and the 320px step
- AC-14 → the analytics step: one `catalogue_filtered` per settled change carrying `tag` and `has_query`, none when the filter is cleared, and no typed words in the properties or in `$current_url`
- AC-15 → the Load more under a filter step
- AC-16 → the boundary check: the shared header, the other routes, the dependency list and the environment are untouched, and the reads stay public

## Value sourcing coverage

Each row of the spec's value sourcing table, with the step that exercises it:

- the tag list of each existing skill after the migration, taken from the column default rather than copied → the migration command and the pre migration row
- the stored tag list on a write, taken from the author's input through the shared rule, normalized, deduplicated, alphabetized and capped → the publish step and the tag rule unit step
- the tags shown on a card and on a skill page, returned as stored → the badge steps
- the term and the tag that narrow the page, taken from the address's `q` and `tag` → the shared link step and the typing step
- whether a skill matches the term, decided by the stored search document against the query built from the term → the `reac` step and the unfiltered parity check
- whether a skill carries the filtered tag, decided by the stored tag list → the `/?tag=GIT` step and the chip step
- `hasMore` under a filter, from spec 0004's one extra row rule → the Load more step
- the order of a filtered page, from `created_at` and `id` descending → the Load more step and the unfiltered catalogue
- the tag values offered as chips, from the stored tag list grouped, and only for tags some skill carries → the chips step and the publish step, which adds a tag to the row
- the number beside a chip, from a count over the skills carrying it → the chips step
- the chip order, from the count descending and then the tag text ascending → the chips step
- the words a person reads for a tag, derived at render with dashes as spaces and the first letter capitalized → the publish step, where `machine-learning` reads as `Machine learning`
- the filter's current state, taken from the address alone → the shared link step, the chip step and the Back check in the fast typing step
- the value written to the address while typing, from the box's own value settled by the pacing hook, written by replacing the entry → the typing step and the fast typing step
- the filtered empty surface's copy, naming whichever of the term and the tag is active → the `/?q=zzzz` step
- the announcement's number and whether more remain, derived from the loaded pages → the announcement step
- the analytics event's name and its two fields, `tag` and `has_query` → the analytics step in AC-14
- the read's validation limits, 100 characters, 8 words and 40 characters per word → the hostile term unit step

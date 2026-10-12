# 0008 catalogue search. A stored search document, a word prefix rule, and two new inputs on the catalogue read

Child spec of [0008 search and filter](index.md), where the acceptance criteria (AC-1 to AC-16) and the cross child contract live. This file owns the searching: the document the store keeps, how a typed term becomes a query, how untrusted text is kept from ever being syntax, and the optional inputs the catalogue read grows. The tags themselves are [skill tags](0008-skill-tags.md); the URL and the controls that feed these inputs are [the filter interface](0008-filter-interface.md).

## Summary

Searching the catalogue means matching what a visitor typed against a skill's name, summary and description, and doing it from the database already in place rather than from a service. This decides that the store keeps a search document generated from those three fields with one index on it, and that each typed word becomes a prefix term (so `reac` finds `React` and `react` finds `reacts`) with several words all required. It also decides the shape of the safety: a term is trimmed, capped and split into words of letters and digits before the query is built, and it reaches the store as a bound value, so no typing can reshape a statement or raise a store error.

## Decision

**Chosen option**: Option 1 in Decision B of [the umbrella rationale](rationale.md). The store generates a `search_document` from `name`, `summary` and `description`, one GIN index serves it, and the catalogue read gains two optional inputs, `term` and `tag`. A term is turned into a store query by one pure function that splits it into words on anything that is not a letter or digit, keeps only letters and digits inside each word, applies the caps, and joins the words as prefix terms; the result is passed as a bound parameter.

The matching rule is the one an ordinary search box has: whole words and word beginnings, with word endings handled by the store's `english` dictionary. Because the store normalizes both the document and each prefix term through that same dictionary, a whole word and a half typed one land on the same stem, which is what makes both `react` and `reac` find `React`, and what makes a dashed term work when it is searched as its separate words. Relevance ranking is deliberately absent: the results stay newest first, so one order holds everywhere and the existing paging stays honest (AC-5, and spec 0007's rule that nothing reorders the catalogue). A term with no matches and a tag with no matches are both an empty page rather than a failure, so the interface decides what to show rather than a failure code deciding for it.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`)

## Feature design

**Data model sketch**: no schema change of its own. The single migration described in [skill tags](0008-skill-tags.md) also adds the column and index this child reads:

| Object | Definition | Serves |
|---|---|---|
| `skills.search_document` | `tsvector`, generated always as `to_tsvector('english', name || ' ' || summary || ' ' || description)`, stored, never written by the application | the searchable text of a skill, kept in step by the store itself |
| `skills_search_idx` | GIN on `search_document` | the term match |

The generation expression names the dictionary as a literal (`'english'`), which is what makes it immutable and therefore allowed in a generated column. All three source columns are required (spec 0003), so the expression needs no null handling. The column is declared with a custom column type, because the ORM has no built in type for a stored search document, and the index on it is a plain index call. That is real build friction and is written down here rather than discovered while writing the migration.

**State transitions**: none stored. A search document is recomputed by the store whenever a row is written, so it has no lifecycle of its own and cannot fall behind the row it describes.

**API surface** (this child's rows only):

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listSkillCards` (extended) | read (server function, GET) | existing `limit` (default 20, ceiling 100) and `offset` (default 0), plus `term?: string` (optional) and `tag?: string` (optional) | `{ items: card[], hasMore }`, newest first, where the filter is applied if present | public | `VALIDATION_FAILED`, `SKILLS_QUERY_FAILED` (unchanged codes) |

Both new inputs are optional and both are validated before use: a term is trimmed, capped and reduced to its safe form, and a tag is put through the same normalizing function the forms use (child 1), so a URL value is compared against the stored form. A value that fails validation is refused with `VALIDATION_FAILED` naming the field rather than silently corrected, which is the same behaviour spec 0003's `limit` and `offset` already have. A term that reduces to nothing is treated as no term at all rather than as a failure.

The two entry points treat a bad value differently on purpose, and this spec says so rather than leaving the builder to decide: the address repairs (child 3 drops or normalizes, because an address is not a form and a stale link should still render a page), and this read refuses with a named field (because a public server function can be called by anything, and a caller that did not come through the address deserves a straight answer). Both run the same sanitizer, so the two can never disagree about what a safe term is.

The query layer keeps one bounded read builder: `listSkillRows` in `src/db/queries.ts` gains an optional filter argument and composes the conditions that are present, so there is one place that decides the order, the bound and the extra row. Its existing callers pass no filter and are unaffected.

**Value sourcing** (this child's rows only):

| Action | Value produced / displayed | Source |
|---|---|---|
| the store's write path | the search document of a skill | the store's own generated column over the `name`, `summary` and `description` columns |
| `listSkillCards` | whether a skill matches the term | the `search_document` column matched against the built query |
| `listSkillCards` | the store query built from the typed term | derived by one pure function from the term: trimmed, capped at 100 characters, split into words on anything that is not a letter or digit so each word holds only letters and digits and is capped at 40 characters, at most 8 words kept, each joined as a prefix term with ` & ` between them |
| `listSkillCards` | whether a skill carries the filtered tag | the `tags` column (child 1), compared by containment |
| `listSkillCards` | the filtering inputs themselves | the URL's `q` and `tag`, validated where the URL is read (child 3), passed to this read |
| `listSkillCards` | `hasMore` under a filter | spec 0004's existing rule: one row beyond the page is read from the filtered set, unchanged |
| `listSkillCards` | the order under a filter | the `created_at` and `id` columns, descending, unchanged from spec 0004 |

**Key invariants**:
- A term can only ever be a value. Its words are reduced to letters and digits before the query is built and it reaches the store as a bound parameter, so no input can add an operator, end a statement, or raise a syntax error.
- A dashed term is searched as its separate words rather than as one word run together, so a term copied from a tag behaves like that tag's words.
- The caps are applied before the query is built, so a 500 character term costs what a 100 character one costs and can never be used to make the store work harder.
- The read stays bounded and stays newest first, filtered or not: page size, offset paging, the extra row rule, and the order all belong to spec 0004 and are untouched.
- An empty result is a success. Neither a term that matches nothing nor a tag that matches nothing produces a failure code.
- Filtering composes: a term and a tag present together must both hold (`and`), and neither present leaves the query exactly as spec 0004 wrote it.
- Unfiltered behaviour is identical to today, byte for byte: the same rows, the same order, the same page size, the same failures.

**Security model**: the read stays public (the catalogue is public, spec 0004), takes no identity and returns the same rows a visitor could reach by browsing. The term is untrusted input that would otherwise reach a query language, which is the one new risk this feature introduces: the sanitizing function and the caps are the entire defence, they live in one module, and they are unit tested. Nothing about the term is logged, and the term never reaches analytics. No compliance scope applies.

**Critical test scenarios** (each maps to an acceptance criterion in the umbrella):
- Narrowing: with a term matching some skills, only those skills come back, in the existing newest first order, with the existing paging, verifies **AC-5**, **AC-6**
- Word behaviour: `react` finds `React`, `reacts` and `reacting`; `reac` finds `React`; a two word term requires both words in a skill, verifies **AC-6**
- Combination: a term plus a tag returns only the skills matching both, and a tag alone returns the skills carrying it, verifies **AC-8**
- Hostile input: terms carrying `'`, `;`, `--`, `&`, `|`, `!`, `:`, `(`, `)`, `<script>`, only whitespace, only punctuation, a 500 character string and a term of 50 words each produce a normal answer rather than a store error, verifies **AC-7**
- Unfiltered parity: with neither input, the read returns exactly what it returned before this feature, including `hasMore` at an exact multiple of the page size, verifies **AC-5**
- Nothing matched: a term that matches nothing returns a successful empty page with `hasMore` false, verifies **AC-6**, **AC-12**

## Build plan

Ordered for the project's Tracer Bullet approach: the two inputs and the store conditions first, proven against the store, and the URL wiring handed to [the filter interface](0008-filter-interface.md) so the thread closes end to end there.

1. The migration already carries the search document and its index (step 1 of [skill tags](0008-skill-tags.md)); this child adds no migration. Confirm the generated column is present and its index is used, satisfies **AC-1**
2. The pure search module `src/features/skills/search.ts`: normalize a term, split it into words on anything that is not a letter or digit, apply the caps, and build the store query text. Nothing else in the feature is allowed to build a query, satisfies **AC-7**, **AC-6**
3. The read grows the filter: `listSkillRows` takes an optional filter and composes the present conditions, keeping the order, the bound and the extra row read, satisfies **AC-5**, **AC-8**, **AC-6**
4. Validation: `validateListSkillsInput` accepts and caps `term` and `tag`, refusing an impossible value with `VALIDATION_FAILED` naming the field and treating a term that reduces to nothing as absent. The address repairs and this refuses, which is the policy stated in the API surface above, satisfies **AC-7**
5. The server function passes both inputs through to the read, keeping its failure style and its card shape, satisfies **AC-5**
6. Prove it against the store: a term and a tag narrow the results, a hostile term returns an answer rather than an error, and an empty result is a success, satisfies **AC-6**, **AC-7**, **AC-8**
7. Hand the filter to [the filter interface](0008-filter-interface.md) for the URL wiring, and verify this slice with `/check verify search and filter`

## Consequences

**Positive**:
- Finding a skill by what it says becomes possible with no new service, no dependency and no extension: one generated column, one index and one query.
- The matching rule is the one a search box is expected to have, including word endings and partial words, without a second copy of the text anywhere.
- Because the document is generated by the store, it can never disagree with the row, and no write path has to remember to maintain it.
- The safety is one pure function, which makes it the easiest part of the feature to test and the hardest to bypass accidentally.

**Negative / tradeoffs**:
- A term whose every word is one the `english` dictionary treats as noise (a word such as `the`) matches nothing rather than everything, so a visitor can type something reasonable and see the empty surface.
- No typo tolerance: `recat` finds nothing, and there is no "did you mean".
- No synonyms: a skill that says `library` is not found by `package`.
- Every insert and update now maintains a second index, so a write costs a little more.
- The generated column stores a copy of the searchable text inside the table, which grows the row; the index on it adds more. Acceptable at this size, and it is the price of an indexed search that needs no second service.
- The dictionary is pinned to `english`, so only English word endings are handled. A tag or a name in another language is matched literally, which is a behaviour worth knowing before the catalogue grows in another direction.

**Neutral**:
- `ILIKE` no longer appears in the feature's read path, so anyone reaching for a substring match has to know the rule is prefix based rather than contains.
- The read's validation now has two more fields to carry through, and the query layer's optional filter argument is the first in the codebase whose presence changes the statement's where clause.

## Rationale

The engineer chose the word prefix rule, and that choice decides this child almost entirely: a word beginning with endings handled is what the store's own full text search does natively, from an index, with no extension and no second service, so the cheapest option and the matching rule point the same way. The rejected alternative (a contains match with the trigram extension) would have used the store too, but it changes the rule to match inside words and it needs an extension enabled on the hosted database, which is a new operational fact for a build that otherwise adds nothing to run. The hosted service option was rejected as the textbook premature optimisation: a paid dependency and a sync pipeline for a catalogue of a few dozen rows, with a second source of truth that can disagree with the store. Relevance ranking is left out on purpose: it is a tuning job with no measured problem behind it, and it would put a second order in a catalogue that spec 0007 is careful to keep in exactly one. The safety design is not negotiable: a typed term is the first untrusted value in this codebase to land in a query language, so it is split into words of nothing but letters and digits and passed as a bound value, and that decision is worth more than any convenience it costs.

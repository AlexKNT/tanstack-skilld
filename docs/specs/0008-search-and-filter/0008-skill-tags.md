# 0008 skill tags. A tag list on the skill, one rule, and the two forms that collect it

Child spec of [0008 search and filter](index.md), where the acceptance criteria (AC-1 to AC-16) and the cross child contract live. This file owns the tag list itself: what is stored, what a tag may look like, who writes it, where it is shown, and the read that offers the tags in use. The text search and the filter's interface are the other two children.

## Summary

A skill needs short labels before it can be filtered by one. This decides that the labels are a list of values stored on the skill row itself, typed by the author, shaped by one shared rule (lowercased, dash joined, 1 to 24 characters, at most five per skill) that both the store and the two forms enforce. The tags show as badges on the card and on the skill's page, each badge a link that applies its own tag as the filter, and the words a person reads for a tag are worked out at render rather than stored beside it.

## Decision

**Chosen option**: Option 1 in Decision A of [the umbrella rationale](rationale.md). The `skills` table gains a required `tags` column holding a list of normalized tag strings, with a check constraint that mirrors the shared rule, and one GIN index on it. Both forms collect tags through the same validation, the reads that already exist return the tags they store, and a badge label is derived at render.

The tag rule lives in one module beside spec 0003's field rules and is reused by the store's check, the publish form and the edit form, so the three cannot disagree. A tag is normalized rather than rejected where it can be (trimming, lowercasing, joining inner spaces with dashes) and refused only when it still breaks the shape or when the sixth tag arrives. A tag list belongs to the skill and is written wholesale on save, so there is no per tag state to manage.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**:

Two columns are added to the existing `skills` table (spec 0003), one check constraint, one helper function, and two indexes. The other column, the stored search document, is added by the same migration but belongs to [catalogue search](0008-catalogue-search.md).

| Column | Type | Rules |
|---|---|---|
| `tags` | `text[]` | required, database default of an empty list, at most 5 entries, no empty entry, each entry matching lowercase letters and digits joined by single dashes and 1 to 24 characters long |

| Object | Definition | Serves |
|---|---|---|
| `skills_tags_valid(tags text[])` function | immutable, created with `create or replace` so a re run cannot fail on it, validating each entry of the list against the shape and length rule and the "no empty entry" rule and answering true or false | the check constraint, because a check constraint cannot walk a list directly |
| `skills_tags_check` constraint | `cardinality(tags) <= 5 and skills_tags_valid(tags)` | the store's half of the shared rule |
| `skills_tags_idx` | GIN on `tags`, default operator class for a list of text | the tag filter, meaning the "carries this tag" test |

The count shown beside a chip is deliberately not served by that index. Counting the skills that carry each tag reads the whole column and groups it, which is a scan of a small table rather than an index lookup. That is acceptable at this size and is written down rather than implied: a catalogue in the thousands of skills would need the counts served another way (a kept tally, or a capped "most used" read) rather than this aggregate.

The rule itself is one module in the feature (`src/features/skills/tags.ts`): a normalizing function that turns what an author typed into the stored form, a validating function that refuses what normalization cannot save, and the three constants (longest tag, most tags per skill, the allowed shape) that the message text and the database check both come from.

**State transitions**: none. A skill's tag list is replaced wholesale on each save, so there is no per tag lifecycle and no state machine to draw.

**API surface** (this child's rows only):

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createSkill` (extended) | write (server function, POST) | the existing fields plus `tags?: string[]` (optional, array of strings, normalized before storing) | the created skill, carrying its stored tags | signed in | `UNAUTHENTICATED`, `VALIDATION_FAILED` naming `tags`, `SKILLS_WRITE_FAILED` |
| `updateSkill` (extended) | write (server function, POST) | the existing fields plus `slug` and `tags?: string[]` | the updated skill, carrying its stored tags | signed in, owner only | `UNAUTHENTICATED`, `SKILL_NOT_FOUND`, `VALIDATION_FAILED` naming `tags`, `SKILLS_WRITE_FAILED` |
| `listSkillCards` (extended) | read | unchanged inputs | each card now carries `tags: string[]` as stored | public | unchanged |
| `getSkillDetail` (extended) | read | `slug` | the detail row now carries `tags: string[]` | public | unchanged |
| `listSkillTags` (new) | read (server function, GET) | none | `{ items: [{ tag: string, count: number }] }`, most used first, ties by tag text | public | `SKILLS_QUERY_FAILED` |

A tag list that is too long or wrongly shaped is a `VALIDATION_FAILED` carrying the field name `tags`, the way the existing field failures carry `name` or `summary`, so a form can put the message beside the control. An empty list is a valid skill, not a failure.

**Value sourcing** (this child's rows only):

| Action | Value produced / displayed | Source |
|---|---|---|
| the migration | each existing skill's tag list | the `tags` column default (an empty list); nothing is copied and no backfill exists |
| `createSkill`, `updateSkill` | the stored tag list | the author's input, put through the shared rule (normalized, deduplicated, alphabetized, capped) |
| `createSkill`, `updateSkill` | the field level message when a tag is refused | decided here: one message per failure kind (a tag that is too long or wrongly shaped; one too many tags), worded for the control beside it |
| `listSkillCards`, `getSkillDetail` | the tags shown on a card and on a detail page | the `tags` column, returned as stored |
| a badge, a chip | the words a person reads for a tag | derived at render from the stored value: dashes become spaces and the first letter is capitalized. Never stored |
| `listSkillTags` | the tag values offered | the `tags` column, one row per distinct tag after grouping |
| `listSkillTags` | the number beside a chip | `count(*)` over the skills carrying that tag, computed at read time (an aggregate over the whole column, not an index lookup) |
| `listSkillTags` | the chip order | derived: count descending, then the tag's own text ascending, so the order is stable across reads |

**Key invariants**:
- A stored tag is always the normalized form. Nothing writes the column except the shared rule, and the check constraint refuses anything else, including a future import.
- A label a person reads is always derived. There is no stored label, so a label can never drift from its tag.
- The tag list is bounded (at most 5) and free of duplicates, so a badge row cannot grow unbounded on a card.
- The existing reads keep their shapes and only gain a field, so a card built before this feature reads as a card with no tags.
- `tags` is never missing: an absent list is an empty list, not a null. This follows spec 0003's rule that a nullable column becomes `undefined` at the query boundary, and here the column is not nullable at all.
- A chip can only exist for a stored tag, because `listSkillTags` reads the column rather than a list written into the app.
- A successful write to a skill invalidates the whole `skills` key family, so a newly used or renamed tag reaches the chips and a page cached under an old tag stops serving cards that no longer match.
- The card stays one clickable surface: a badge link is layered above the stretched title link (spec 0004's pattern) rather than nested inside it.

**Security model**: tags are written only through `createSkill` and `updateSkill`, which already require a signed in session and take the author from that session (specs 0005 and 0006), so nobody can change another person's tags. Reading tags is public, exactly like the rest of the catalogue. A tag is user generated public text, kept by the rule to lowercase letters, digits and dashes and always rendered as text, so it can carry nothing executable. No compliance scope applies.

**Critical test scenarios** (each maps to an acceptance criterion in the umbrella):
- Round trip: publish a skill with two tags, read it back, and see the same two tags on its card and its detail page, verifies **AC-3**, **AC-4**, **AC-1**
- Normalization: `React`, `react `, `machine learning` and a repeated `react` arrive as `machine-learning` and `react`, in that alphabetical order, verifies **AC-2**
- Refusals: a 25 character tag, a tag of only dashes, an empty tag, and a sixth tag are each refused with a message naming `tags` and nothing is written, verifies **AC-2**, **AC-3**
- Store level: a direct insert with a malformed tag or six tags is refused by the constraint, and a database that already holds skills keeps every row and id and reads with an empty list, verifies **AC-1**, **AC-2**
- Chips: the tag read returns each tag in use with its count, most used first, and no tag that no skill carries, verifies **AC-9**
- Card interaction: a keyboard walk reaches the title link, the badge links and the install control as separate stops, with no anchor inside an anchor, verifies **AC-4**, **AC-13**
- Anonymous write: a signed out call to change a skill's tags is refused and writes nothing, verifies **AC-16**

## Build plan

Ordered for the project's Tracer Bullet approach: the store change lands first because everything else leans on it, then a tag travels the whole way through one form to one badge before the second form and the chip read are added.

1. The one migration: create the helper function with `create or replace`, add `tags` and the search document with their two indexes, and add the check constraint that calls the helper. The generated SQL is hand edited to create the function before the constraint that uses it, and the search column is declared with a custom column type because the ORM has no built in one (see [catalogue search](0008-catalogue-search.md)), satisfies **AC-1**, **AC-2**
2. The shared rule: `src/features/skills/tags.ts` with the normalizing function, the validating function, the three constants and the messages, plus the query layer's write and read of the column, satisfies **AC-2**
3. Thin thread: the publish form collects tags, the server stores them, and the card renders them as plain text, proving the whole path before the control is styled, satisfies **AC-3**, **AC-1**
4. The publish form's tag control: a labelled input that states the rule, takes a comma separated value, and shows the server's field message, and a successful publish invalidates the whole `skills` key family so the chips and any cached filtered page are fresh, satisfies **AC-3**, **AC-13**
5. The edit form's tag control: the same control and the same rule, so a typo can be corrected later, and a successful edit invalidates the same key family, satisfies **AC-3**
6. Badges on the card and on the detail page, each a link that applies its own tag as the filter and each layered above the card's stretched title link, satisfies **AC-4**
7. The tag read `listSkillTags`: the distinct tags with their counts, ordered for a stable chip row, satisfies **AC-9**
8. Verify this slice: the round trip, the normalization, the refusals and the store's own refusal, then hand the filter wiring to [the filter interface](0008-filter-interface.md)

## Consequences

**Positive**:
- One migration and one extra field, and every existing read and write keeps working for a skill with no tags.
- The store refuses a malformed tag, so the rule holds even for a script or an import that never ran the form.
- No vocabulary to maintain, and a tag's meaning cannot drift from what the author typed beyond normalization.
- The chip row is derived from real data, so a chip can never lead to an empty result.

**Negative / tradeoffs**:
- Renaming or merging a tag means writing every row that carries it, because tags are values on the rows.
- Nothing prevents two authors inventing two spellings of one idea, so the chip row drifts over time (see the premise note in [the umbrella rationale](rationale.md)).
- The migration carries a helper function and a check that needs the function to exist first, so the generated SQL has one manual step and the next person to read it needs to know why.
- A generated column is added in the same migration, so the table is rewritten once; small here, worth knowing before running it somewhere live.
- Both forms gain a control, so both grow a little, and the rule's messages have to make sense beside a control that holds several values rather than one.

**Neutral**:
- The tag rule introduces the project's first list valued column, so the query layer's casting and mapping now has one more shape to carry.
- `src/features/skills/tags.ts` becomes the second module that owns field rules, beside the existing validation in `src/features/skills/schema.ts`; the two should stay neighbours.

## Rationale

The engineer chose free text tags typed by the author, and the smallest honest way to store them is on the row: one column, one index, no join on any read, and a tag that travels with its skill through every read that already exists. A vocabulary table would buy a rename that this feature does not need and could not use without a moderator, at the cost of two tables and a join on every filtered read. The store's check is kept because spec 0003 set that precedent deliberately (a rule the forms enforce but the store does not is a rule an import can break), and the one small immutable helper function is the price of a rule that walks a list, which a check constraint cannot do on its own. The label is derived rather than stored because a second copy of a tag is a thing that can drift, and the design system already treats the badge as a presentation of a value the caller passes.

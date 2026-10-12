# 0008 rationale. Why the catalogue filters the way it does

This file is the decision record for the [search and filter spec](index.md). `/develop` does not need it; it exists so the reasoning, and the options that lost, are not forgotten.

## Context

Skild's catalogue shows every skill newest first, twenty at a time, and nothing else. That is the right default for a small catalogue and the wrong answer as soon as the catalogue has thirty skills in it: a visitor looking for something specific has only the order of publication to work with. The scope's feature 6 asks for the catalogue to be narrowable by text and by tag, with the choice kept in the URL so a filtered view can be shared, and with a helpful state when a filter matches nothing.

> ⚠️ Premise note: two things about this feature deserve a straight answer before it is built.
>
> First, the tags are free text typed by authors, so near duplicates are inevitable (`react`, `reactjs` and `react-js` can all arrive for the same topic) and the chip row will slowly fill with twins. Normalization removes the easy cases and nothing else. The mitigations that fit this build are cheap (suggest tags already in use while typing, and show a count per chip so a duplicate is visible) while the real fix (merging tags) is a data migration, because tags are stored on the rows rather than in a vocabulary. This is accepted knowingly, and recorded as a follow-up to revisit when the chip row starts showing doubles.
>
> Second, the topic spans three related decisions: what a tag is, how the search is served, and where the filter lives. Each can be built, shipped and verified on its own, so it is written as an umbrella with three child specs rather than one flat spec. The contract (the acceptance criteria and the cross child contract where the three meet) stays in [index.md](index.md).

Three forces shape every decision below. **The catalogue is small and public**: a few dozen rows today, read by anyone, with no identity in the read. **Nothing new should be added to run**: this build already carries Clerk, Postgres and a handful of integrations, and a learning build goes wrong fastest by adding infrastructure it does not operate well. **The workflow is Tracer Bullet at Alpha rigor**: the value is a working thread through every layer early, verified with `/check verify`, not a suite of layers each complete in isolation.

One constraint is inherited and worth stating plainly: spec 0004 built the catalogue read as a paged, bounded, public read with an explicit failure style, an `hasMore` rule and a shared query key between the loader and the client. This feature extends that read rather than replacing it, and spec 0007 (in progress) extends the same read, card shape and query key with the viewer's own vote. That is why the cross child contract in [index.md](index.md) pins the filter's shape, the card shape and the key shape in one place.

## Options considered

### Decision A: how a skill carries tags

**Option 1 (chosen): a normalized tag list stored on the skill row, typed by the author.**

The `skills` table gains a `tags` column holding a list of strings. One shared rule trims, lowercases, dash joins and validates each tag; the same rule is mirrored by a database check, the way spec 0003 already mirrors the slug and length rules.

**Pros**:
- One migration, no new table, no join on any read, and a tag travels with its skill through every read that already exists.
- The filter becomes a containment test against an indexed column, which is a single operator rather than a join.
- The rules a tag must obey live in one place and the store enforces them, so a future import cannot write a tag the forms would have refused.
- It needs no vocabulary for anyone to maintain, which matters because there is no moderator yet.

**Cons**:
- Renaming a tag means writing every row carrying it, and merging two near duplicate tags is a data migration.
- Nothing stops two authors inventing two spellings of the same idea, so the chip row can drift.
- A list column is slightly more awkward to read and write than a scalar, and the validation cannot be expressed as a plain check on one value.

**Option 2: a `tags` table plus a `skill_tags` link table.**

A tag becomes an entity with an id and a stored label, and a skill relates to tags many to many.

**Pros**:
- A tag is renamed or merged in one row, and the vocabulary could later be curated, described or ordered.
- It is the shape most people reach for first, and it keeps labels and slugs separable.

**Cons**:
- Two new tables, two writes on every save, and a join on every filtered read and every facet count, for a feature with no vocabulary owner yet.
- Nothing in this build needs a tag to exist before a skill uses it, so the extra entity is capacity nobody asked for.
- Merging near duplicate tags is still a migration (the link rows must be repointed), so the main promise of this option does not hold here.

**Option 3: a single delimited text value on the skill.**

Tags as one string, split on read.

**Pros**:
- The smallest possible store change: one text column, no list type to learn.

**Cons**:
- Cannot be indexed for containment, so every filter would be a text match that also matches inside other tags.
- Every read and write has to split and join by hand, and a stray separator corrupts the count.

**Option 4: no tags at all, text search only.**

Ship the search box, and defer tag filtering.

**Pros**:
- The smallest feature that still improves finding things, with no store change at all.
- Nothing to sprawl.

**Cons**:
- Dropping the tag filter drops half of what the scope row asks for, and browsing a topic is the more natural way to explore a catalogue than guessing at words.
- The design system already reserved the Badge primitive for skill tags, so the tag idea is in the project's direction regardless.

**On the database check**: a Postgres check constraint cannot walk a list directly, so the chosen option pairs the check with one small immutable helper function that validates each entry. The alternatives were a check over the list joined into a string, which expresses the shape but not the length rule exactly, and application only validation, which would let an import write a tag the forms refuse. One extra object in the migration, hand edited into the generated SQL, buys a rule the store genuinely holds.

### Decision B: how the text search is served

**Option 1 (chosen): Postgres's own full text search, over a stored search document.**

The store keeps a document generated from a skill's name, summary and description, with one index on it. A typed word becomes a prefix term, so `reac` finds `React` and `react` finds `reacts` and `reacting`, and several words must all be present.

**Pros**:
- No new service, no extension, no cost and no second copy of the truth: the search runs in the database the project already pays for.
- It natively speaks the matching rule a visitor expects from a search box, including word endings, and it does so from an index rather than a scan.
- The document is maintained by the store on write, so it can never disagree with the row.

**Cons**:
- No typo tolerance, no synonyms and no relevance tuning for free.
- A term made only of very common words matches nothing.
- Writing a skill now maintains a second index, and the query has to be built carefully so untrusted text cannot become syntax.

**Option 2: a contains match with the trigram extension.**

A substring match over the same three fields, indexed with `pg_trgm`.

**Pros**:
- Typo tolerance and matching inside a word (`act` finds `React`) come almost free, and the query is trivially simple.
- It behaves closest to a naive `contains` mental model, which is easy to explain.

**Cons**:
- It changes the matching rule the engineer chose, in a way that gets noticeably noisier as the catalogue grows.
- It needs an extension enabled on the hosted database, which is a new operational fact for a learning build.
- Trigram indexes are larger and slower to maintain than the full text index for this kind of text.

**Option 3: a hosted search service.**

Meilisearch, Typesense or Algolia, fed by a sync from Postgres.

**Pros**:
- Typo tolerance, ranking, filtering and facet counts are the product it sells, and facets would come nearly free.
- It would scale far past anything this project will ever hold.

**Cons**:
- A paid dependency, a sync pipeline to build and watch, and a second place the truth lives and can disagree.
- It is the textbook premature optimisation: infrastructure added for a few dozen rows, run by one person learning, with no measured problem to fix.
- The read would stop being a single server function over one database, which is the shape the rest of the catalogue rests on.

### Decision C: where the filter lives

**Option 1 (chosen): the router's own search params.**

Two optional values, validated by a function on the route and read back from the URL by every consumer.

**Pros**:
- The URL becomes the single source of truth, so sharing, bookmarking, reloading and the Back button all work by construction rather than by extra code.
- It reuses a pattern the codebase already has (the account skills route validates one search param today) and adds no dependency.
- A filter held in the URL is server renderable, so the filtered first page can be in the HTML.

**Cons**:
- Every keystroke that settles means a navigation, so the pacing hook and the replace rather than push decision are load bearing.
- Search params are strings, so validation has to decide what an invalid value becomes.

**Option 2: a small URL state library such as nuqs.**

**Pros**:
- A tidy hook API for reading and writing a typed value, with debouncing built in.
- Less code in the route.

**Cons**:
- It overlaps with what the router already does, so two libraries own the URL.
- Another dependency to keep in step for a behaviour the router already provides.

**Option 3: local component state only, with no URL.**

**Pros**:
- Simplest to build, and the fastest possible interaction.

**Cons**:
- A filtered view cannot be shared, reloaded or gone back to, which is exactly what the scope row asks for.
- The filtered list cannot be server rendered, so a shared filter would flash the unfiltered catalogue first.

### Decision D: the order, the chips and the pacing

- **Order**: newest first, chosen over relevance ranking and most upvoted first. One order everywhere keeps the existing paging, the existing index and spec 0007's "the count never reorders anything" invariant honest, and relevance ranking is a tuning job with no measured problem behind it here.
- **Chips**: read from the store as the tags actually in use with a count each, chosen over a fixed list written into the app and over typing a tag into a field. A chip that exists always has skills behind it, and the count makes a near duplicate visible, which is the cheap half of the tag sprawl mitigation. A fixed list would need an edit for every new topic and could offer a chip with nothing behind it.
- **Pacing**: a small hook of our own, chosen over a dependency and over search on submit. Search on submit stops feeling like filtering as you type; a dependency is one more package for fifteen lines we control.

## Rationale

The three decisions point the same way: **use what the project already runs, and keep the truth in one place**. Postgres serves the search, the router owns the URL, the tags live on the row, and the read that already exists grows two optional inputs rather than gaining a rival. Every alternative that lost did so for the same reason: it bought a capability this feature does not need (a curated vocabulary, typo tolerance, relevance ranking, a second service) with a cost this build would feel immediately: two more tables, a paid dependency, or a second source of truth that can disagree with the store. The engineer's two choices that narrow the matching (word beginnings with endings handled) and the tag filter (one tag at a time) are what make the cheap path the honest one, since a rule a visitor can predict is also a rule an index can serve.

The accepted costs are recorded rather than hidden. Typing a word that is misspelled, or only a very common word, produces the empty surface; tags drift into near duplicates as authors invent spellings; and renaming a tag touches every row that carries it. Each is a real trade against a build that adds nothing new to operate, and each has a next step recorded in the spec's Follow-up: suggest tags in use while typing, show counts so a duplicate is visible, and treat merging as the migration it is. The migration's own wrinkle (the helper function hand edited into the generated SQL) is called out because the store's enforcement of the tag rule is worth one manual step, and because a generated migration that a person has edited is exactly the kind of thing that surprises the next reader.

Finally, the shape of this spec follows the shape of the decision. Tags, the search and the interface can be built and verified separately, so they are three child specs with the contract held above them; and the filter's own key, card and read shapes are pinned in one place, because the sibling work in flight (spec 0007) touches the same three.

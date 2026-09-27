# 0003. Skill data model, the reasoning

Decision record for [spec 0003](index.md). `/develop` does not need this file; it explains why the decision in `index.md` took the shape it did.

## Context

Skild has no database. Everything on the current pages is hardcoded, and `package.json` lists no database client, no ORM, and no migration tool. Slice 1 is where that ends, and this is its first feature: the storage decision, and the minimum read and write path over it that every later slice builds on.

The feature sits at an awkward but deliberate moment in the build. Slice 1 is about reading a catalogue on real data, while the thing that creates data, publishing a skill, is slice 2. So the model must be usable for reads today and must be the right shape when a form writes to it tomorrow. That is why several small tempting conveniences, a real owner table, tags, a hidden flag, are not built here. Each one has an owning feature later, and guessing its shape now would mean redoing it.

The scope names this feature as the costliest thing to redo (basis: your `docs/scope/scope.md`, the foundations before features practice). That is a fair reading: a page can be rewritten in an afternoon, while a schema that other queries have grown around is expensive to change once there is data in it. So the design conversation spent its effort on the storage shape rather than on the two functions built on top of it, and this spec was given the directory shape so its reasoning survives separate from its build steps.

Two constraints come from outside this feature. The first is that Clerk already owns people. It stores sign up, sessions, the profile, and the avatar. A local copy of any of that would be a synchronisation problem bought for nothing. The second is that the host is still undecided, so the storage code must not depend on which provider wins that decision. Both push in the same direction: a plain Postgres reachable over a connection string, and no second identity store.

## Options considered

### Option 1: Postgres with Drizzle ORM

A single Postgres database holds the skills. Drizzle defines the table in TypeScript, generates SQL migrations from that definition, and infers the row types from the same file, so the database shape and the app's types cannot drift apart. The client runs on the server only, behind TanStack Start server functions.

**Pros**:
- One definition for the table and the types. A schema change and its type consequence are the same edit, which is the strongest argument for a typed query layer on a small team.
- Plain Postgres underneath, so the provider choice stays open and the data is portable. Nothing about the storage code changes if the host changes.
- Migrations are real SQL files kept in the repository, so the schema has a reviewable history rather than being a state someone pressed into the database.
- The rules can live in the database (unique slug, name length, required content), which is the only layer a seed script and a future import also pass through.

**Cons**:
- A new runtime dependency and a new failure mode. The app can now fail because a store is unreachable, which it could not before.
- Drizzle's error messages sit between you and Postgres, so the first time a query misbehaves there is an extra layer to read through.
- Migrations must be generated and run deliberately. That is a habit to learn, not a thing that just works.

### Option 2: Postgres with raw SQL and a thin client

The same database, reached with statements written by hand through a small client. No ORM, no generator, no inference.

**Pros**:
- Fewer moving parts and nothing between you and the database. What you write is what runs.
- Complete freedom on any query, which matters when a query gets genuinely awkward.

**Cons**:
- Types become hand written and hand maintained, which is the most common source of drift between a table and an app.
- Migrations become a convention the team follows rather than something a tool generates and tracks, and that convention is the first thing to slip under deadline.
- With two TypeScript files today, most of the freedom is unused. Its advantage is real at a different scale than this project.

### Option 3: SQLite with Drizzle, a local file

The same typed layer on a single file database. Fastest path to a running query, no service to provision or pay for.

**Pros**:
- No account, no connection string, and a query that runs about as fast as a query can.
- Ideal for the kind of local only prototype that never leaves a laptop.

**Cons**:
- The file system on the eventual host is the problem. A serverless or container host rebuilds or multiplies its instances, and each copy would have its own separate database. That is the wrong failure to discover at deploy time.
- It would put the schema decision and the host decision on a collision course: migrate to Postgres later and the schema, the migrations, and the query code all get rewritten.
- It does not satisfy the scope's own requirement that the data reach a real deployed app, which is a later feature but a known one.

### Option 4: A hosted backend with its own client

A provider such as Supabase or Convex brings storage and its own client, and in some cases its own authentication, realtime, and file storage with it.

**Pros**:
- Less assembly: storage, and usually much more, arrive configured together.
- Its client is built for the browser, so some reads become very short to write.
- A generous free tier and a dashboard for looking at the data.

**Cons**:
- The auth overlap is the real cost. Clerk is already the identity source here, so a second one either duplicates it or duplicates the effort of removing it.
- The storage code becomes provider specific, which trades away the portability that the connection string choice preserves.
- It invites client side data access, which is the opposite of this project's server boundary discipline and would put a credential in the browser.

## Rationale

Option 1 wins on a small team's most valuable property: one definition instead of two. The table, its types, and its migration come from the same file, so a change to the schema cannot quietly leave the app's types behind. Option 2 keeps complete control and pays for it with hand written types, which is exactly the drift the project's strict types rule exists to avoid, and with a migration habit that has nothing enforcing it. Option 3 is faster today and creates a rewrite for the deploy feature, which is a bad trade for a difference measured in minutes. Option 4 is the strongest alternative and loses on overlap: it duplicates an identity system this project already has, and it trades away the provider independence that keeps the deploy decision open.

Postgres specifically, rather than any store, because the domain is genuinely relational even when small. A skill has an author, later an author has many skills, later still a skill has tags and votes. A relational database expresses those as columns and constraints and is the boring, proven answer to exactly this shape (basis: the relational structure of the domain, and the preference for boring technology with known failure modes). A document store would push the same relationships out into application code and lose the constraints with them.

The owner decision is the one worth defending explicitly, because it looks like a shortcut and is not. Storing only a Clerk user id means the app cannot render an author name without asking Clerk. The alternative, a mirrored owner row, buys a faster join and a catalogue that renders while Clerk is unreachable. This spec declines that trade deliberately: it is a synchronisation path to build, monitor, and explain, and the thing it buys is not yet slow. If the catalogue ever renders enough cards for the per card lookup to hurt, the mirrored row is the answer, and it is additive rather than a rewrite. That condition is recorded as a follow up so the decision is revisited on evidence rather than by accident.

Because identity stays in Clerk, the read path has to hand the catalogue the author id and no more. That makes `author_id` part of the read result, and it makes the publisherless case a real one rather than a corner: nothing stores an author until slice 2 exists, so every seeded skill arrives with no publisher and the card has to render without one. Both facts are written into the spec rather than left to be discovered, because a first draft of this design returned neither and would have stranded the catalogue between a card that wants to credit someone and a read result that could not say who.

Markdown for the description was the engineer's call over plain text, with rendering deferred to the detail page in slice 2. That is reasonable, and the cost is named rather than hidden: a renderer and a sanitiser arrive with the detail page, and until then the column is stored and not displayed. Keeping it out of this slice is correct, since rendering is a presentation decision and this spec is about storage.

Two smaller calls worth recording. First, the slug is derived on the server and de-duplicated by appending a numeric suffix. Deriving on the client would let two clients disagree about what a skill's URL is, and rejecting a clash would hand the author a rename chore the app can do itself. The cost is that `pdf-reader` and `pdf-reader-2` can belong to unrelated skills, which is cosmetic and reversible. Second, reads and writes return explicit failures rather than throwing. That follows the project's rule that expected errors are returned and handled at one boundary, and it is what lets the catalogue render an honest error state instead of an empty list when the database is down.

What this spec deliberately does not decide: the hosting provider (both candidates fit the connection string choice, so the deploy feature can pick), whether publisher details are read live from Clerk or cached (the catalogue feature owns the read path), and whether hidden skills are a column or a separate table (moderation owns that). None of them block this build, and each has a feature that will ask the question with better information than is available now.

## References

**Project sources** (verifiable, in this repo):
- `AGENTS.md`: the stack, strict types with no `any` and no non null assertions, explicit failures handled at one boundary, folder by feature, kebab case files, environment validation at startup.
- `docs/scope/scope.md`: feature 1, *Skill data model*, and the Tracer Bullet build approach in the header.
- `docs/scope/scope.md`: the Deferred list, which is where tags, comments, and image upload already live, so declining them here is consistent rather than new.
- `docs/specs/0002-design-system/index.md`: the Card, Badge, Avatar, Skeleton, Empty, and Alert primitives this feature's read path will be displayed with.
- Installed community skills: `tanstack-start-best-practices` (server functions, server only boundaries), `clerk-tanstack-patterns` (reading the session inside a server function), `tanstack-query-best-practices` (the caching layer the catalogue will add).

**Practices & standards**:
- Boring technology over novel, with known failure modes and a large community.
- Relational data belongs in a relational store, with constraints enforced where they cannot be bypassed.
- One source of truth per fact: identity stays in Clerk, storage rules stay in the schema.
- Storage lives at the layer that depends on it rather than the layer that uses it.
- Migrations are versioned artifacts reviewed like code, not manual steps.
- Least privilege: no database credential ever reaches the browser bundle.

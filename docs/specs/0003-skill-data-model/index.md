# 0003. Store skills and their publisher in Postgres, read and written through Drizzle

**Date**: 2026-09-27
**Status**: Accepted

## Summary

Skild has no database yet, so this is the decision that gives it one. Skills move into a Postgres table accessed through Drizzle, a typed query layer that keeps the database shape and the TypeScript types in step. The app keeps only the Clerk user id of whoever published a skill, so Clerk stays the one place a person's name and photo live, and there is no second copy to keep in sync. Two server functions finish the slice: one reads the list, one writes a skill, and the write refuses anyone who is not signed in. Tags, upvotes, and moderation stay out, because later slices own them.

## Requirements

**User stories**:
- As the engineer building the catalogue, I want skills stored in a real database with types that reach the UI, so that the list page reads live data instead of a hardcoded array.
- As a later feature builder, I want one place that knows how to read and write a skill, so that publish, the signed in area, upvotes, and search all build on the same access layer.
- As the person running the project, I want the schema and the sample data to be commands I run, so that setting up a fresh machine is repeatable instead of hand typed.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A `skills` table exists in Postgres (the project's database), created by a migration that can be applied, and the app connects using a `DATABASE_URL` read from the environment.
- **AC-2**: The skill type is inferred from the schema once and imported everywhere, so a column that changes the schema is a type error in the UI rather than a runtime surprise.
- **AC-3**: A server function reads the catalogue list and returns skills with `id`, `slug`, `name`, `summary`, `authorId`, `installUrl`, and `createdAt`, newest first, and the list is bounded rather than unbounded: it defaults to 20 rows, accepts a caller supplied limit up to a ceiling of 100, and a request below zero is refused rather than silently corrected.
- **AC-4**: A server function writes a skill from a name, a summary, a markdown description, and an optional install URL, and returns the created record including the slug the server derived.
- **AC-5**: Slugs are unique and url safe, derived from the name, and a clash resolves by adding a numeric suffix instead of failing, so the second skill called "PDF Reader" is stored as `pdf-reader-2`. A name whose characters cannot appear in a URL still yields a usable slug rather than an empty one, the slug is capped at 60 characters, and the clash retry survives two writers asking for the same slug at the same moment.
- **AC-6**: The write function reads the Clerk session and refuses an anonymous caller with a clear failure, and stores the signed in user id as `author_id`.
- **AC-7**: Rows that break the rules are rejected at the database, not only in the form: a missing `name` or `slug`, a duplicate slug, or a `name` longer than 80 characters all fail.
- **AC-8**: A caller with a malformed payload receives a validation failure naming the offending field, and a database failure is returned as a failure rather than thrown raw at the UI. A name or a summary that is empty once whitespace is trimmed is refused, the summary is capped at 200 characters and the description at 100000, and an install link that is not a well formed web address is refused.
- **AC-9**: `npm run db:migrate` applies migrations and is safe to run twice, and `npm run db:seed` loads a small set of believable sample skills and is safe to run twice without changing an existing row's id or its original creation time, so the catalogue has content before the publish form exists.
- **AC-10**: The database is reachable from a hosted Postgres over a connection string, and the live connection details are not committed to the repository.

## Decision

**Chosen option**: Option 1, Postgres with Drizzle ORM, one `skills` table, the publisher held as a Clerk user id, and two server functions behind a shared query layer (basis: your `AGENTS.md`, the folder by feature and strict types conventions, plus the project's lack of any data layer).

A single `skills` table holds the skill. Its identity is a generated uuid primary key plus a unique `slug` derived from the name, so every skill has a stable internal handle and a readable public URL. The publisher is one nullable `author_id` text column holding a Clerk user id, so no second copy of a person is stored and there is nothing to keep in sync. Storage lives in `src/db` (the client, the schema, and the query functions) because later slices share it, while the two server functions that expose it live with the feature in `src/features/skills/data.ts`, matching the folder by feature rule. TanStack Start server functions are the only way in: the browser never holds a database credential.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`)

## Feature design

**Data model sketch**:

One table, `skills`. No foreign keys: owners live in Clerk, not in this database, so there is nothing local to reference yet.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | primary key, generated by the database |
| `slug` | text | required, unique, lowercase, url safe, derived from `name` |
| `name` | text | required, 1 to 80 characters |
| `summary` | text | required, the one line pitch on a card |
| `description` | text | required, markdown, rendered by the detail page in slice 2 |
| `install_url` | text | optional, where the skill can be fetched from |
| `author_id` | text | optional now, holds a Clerk user id, becomes required in slice 2 |
| `created_at` | timestamp with time zone | required, database default of now, the sort key for newest first |
| `updated_at` | timestamp with time zone | required, database default of now, updated when a row changes |

**State transitions**: none. A skill has no lifecycle states in this feature. Hidden or restored arrives with moderation, and that state belongs to that feature's own spec.

**API surface**:

Both entries are TanStack Start server functions (typed server side functions the client calls as if they were local), not HTTP routes.

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listSkills` | read | `limit?: number (opt, default 20, ceiling 100)`, `offset?: number (opt, default 0)` | array of `{ id, slug, name, summary, authorId, installUrl, createdAt }`, newest first by `created_at` then `id` | public | `VALIDATION_FAILED` for a limit above the ceiling or a negative limit or offset, `SKILLS_QUERY_FAILED` when the read fails |
| `createSkill` | write | `name: string (req)`, `summary: string (req)`, `description: string (req)`, `installUrl?: string (opt)` | the created skill including its derived `slug` and `id` | Clerk session required | `UNAUTHENTICATED`, `VALIDATION_FAILED` naming the field, `SKILLS_WRITE_FAILED` |

Both return explicit failures rather than throwing, per the project's rule that expected errors are returned and handled at one documented boundary (basis: your `AGENTS.md`, the explicit failures and single boundary rule). A failure type carries a code and a short message, so the catalogue can render an error state without guessing.

**Value sourcing** (every value each action produces, computes, or displays names where it comes from; a required value with no named source is an undecided input, resolved here rather than left for the build):

| Action | Value produced / displayed | Source |
|---|---|---|
| `listSkills` | the skill id | the `id` column, generated on insert |
| `listSkills` | the skill name, summary and install link | the `name`, `summary` and `install_url` columns |
| `listSkills` | the slug shown in the card's link | the `slug` column, derived at write time from the `name` input |
| `listSkills` | the publisher the card credits | the `author_id` column, returned as `authorId` so the catalogue can look the person up in Clerk. Slice 2 stores it; before then seeded rows have none, so a card must render without a publisher |
| `listSkills` | the "added" date on a card | the `created_at` column, set by the database default |
| `listSkills` | how many rows come back and which page | derived from the `limit` and `offset` inputs, application defaults of 20 and 0 |
| `listSkills` | the tie break when two skills share a timestamp | the `id` column, added as a second sort key so the order is stable |
| `createSkill` | the slug | derived from the `name` input by a pure slugify function, then de-duplicated against the `slug` column, falling back to a `skill-` prefix and a short digest when the name carries no characters a URL can use |
| `createSkill` | `author_id` | the Clerk user id read from the request session in the function, never an input parameter |
| `createSkill` | `created_at` and `updated_at` | the database column defaults, not the application clock |
| `createSkill` | the failure code a caller branches on | the function's own return type, decided by the validation and error rules below |
| `db:seed` | the sample skills' slug, name, summary and description | the seed file, hand written |
| `db:seed` | the sample skills' `author_id` | left empty on purpose, so no fake Clerk user id is invented |
| `db:seed` | whether a sample row is inserted or skipped | the `slug` column, since the seed skips a slug that already exists rather than replacing the row |

Nullable columns come back from the driver as `null`. The query layer is the one boundary that turns that into `undefined`, so the rest of the app uses `undefined` unions as the conventions require and the UI never has to check for both.

The slug derivation is the one value worth restating: the server derives it, never the client, so two clients cannot disagree about a URL.

**Key invariants**:
- Every skill has a `slug` that is unique across the table. Enforced by a unique constraint, not only by the application check.
- `slug` is lowercase and contains only letters, digits, and single separators, so it is safe in a URL, and it is never empty and never more than 60 characters.
- `name` is at most 80 characters and never empty once whitespace is trimmed, enforced by a database check so the seed and any future import obey it too.
- `summary` is at most 200 characters and `description` at most 100000, both never empty once whitespace is trimmed. `summary` and the length rule on `name` are enforced in the database; the description ceiling is enforced at the function boundary, since a check on a large text column is cheaper to state once than to police in a schema.
- `install_url`, when present, is a well formed web address. Validated at the function boundary, not stored as a constraint, because the rule is about what an author may submit rather than about what the database may hold.
- `author_id` is either empty or a Clerk user id. This is deliberately not a format check in the schema: the id format belongs to Clerk, and a local copy of it would break the day Clerk changes it.
- `created_at` never changes after insert, and `updated_at` is never earlier than `created_at`. The first is guaranteed by never writing the column again; the second is a database check alongside a column rule that refreshes `updated_at` on every update.

**Security model**:
- `listSkills` is public: the catalogue is the front page and anyone may read it.
- `createSkill` requires a signed in Clerk session. Anonymous callers receive `UNAUTHENTICATED` and nothing is written.
- The author id is taken from the session, never from an argument, so a caller cannot publish under someone else's name.
- The database credential is server only. It is read from `DATABASE_URL` in the server environment and never exposed through a `VITE_` prefix, so it cannot reach the browser bundle.
- No compliance scope applies. Skills hold no personal data beyond a Clerk user id that is already held by Clerk, and there is no payment, health, or regulated data in this feature.

**Configuration required**:
- `DATABASE_URL`: the Postgres connection string, used by the app at runtime and by the migration, check, and seed scripts. Local value in `.env.local`, production value in the host's environment.
- No third party account is needed to write the code. A hosted Postgres instance must exist before AC-10 can be verified, which is the one prerequisite. Any provider will do for that check, so the choice can be a throwaway or a free tier instance and does not force the deploy feature's decision.

One consequence of validating the connection at startup, which the conventions require: until `DATABASE_URL` exists in your local `.env.local`, `npm run dev` will stop with a clear message naming the missing variable rather than booting with a broken data layer. The existing sign in and design pages will not load until you add it.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: apply the migration, seed the sample skills, call `listSkills` and receive them newest first, then call `createSkill` with a valid payload while signed in and see the new skill appear in the next read, verifies **AC-1**, **AC-3**, **AC-4**
- Failure case: two skills submitted with the same name produce `pdf-reader` and `pdf-reader-2` rather than a duplicate key error, and a name over 80 characters is rejected, verifies **AC-5**, **AC-7**
- Auth/permission: an anonymous call to `createSkill` returns `UNAUTHENTICATED` and writes nothing, verifies **AC-6**
- Round trip: run both commands twice and confirm nothing duplicates or breaks, verifies **AC-9**

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Build plan

Ordered for the project's Tracer Bullet approach (prove the whole pipe end to end before thickening any one part). So the plan stands the thinnest thread first: one table, a migration, one real read through a server function, then one real write that reads the session, and only then the rules, the seed, and the hosted connection. Every step leaves something runnable.

1. Install the data layer and configure the connection: add Drizzle with its Postgres client and its migration tooling, add the `db:migrate`, `db:seed`, and `db:studio` scripts, and read `DATABASE_URL` from the environment through one validated module that fails loudly, naming the variable, when it is missing, satisfies **AC-1**, **AC-10**
2. Define the schema in `src/db/schema.ts` with every rule that belongs in the database included from the start: the unique constraint on `slug`, the length and not empty checks on `name` and `summary`, the ordering check on the timestamps, and the column rule that refreshes `updated_at`. Generate one migration for the whole confirmed model in step 8 (a single migration, because this is a thin thread) and apply it, satisfies **AC-1**, **AC-7**
3. Export the inferred types (`Skill`, `NewSkill`) from `src/db/schema.ts` and the shared type module, so the UI imports the database's own shape, satisfies **AC-2**
4. Add the read path end to end before anything writes: a `listSkills` query in `src/db/queries.ts` ordering by `created_at` then `id` descending, with the default and ceiling on the limit and the `null` to `undefined` mapping at this boundary, plus a public `listSkills` server function in `src/features/skills/data.ts` returning the bounded list, satisfies **AC-3**
5. Add the seed script with six to eight believable skills, built as an insert that skips a slug that already exists rather than replacing the row, with staggered creation times so the newest first order is real, satisfies **AC-9**
6. Prove the read thread: apply the migration against a fresh database, seed it, call `listSkills`, and confirm the seeded rows come back in the expected order, that the row count is bounded, and that running both commands twice changes nothing, satisfies **AC-1**, **AC-3**, **AC-9**
7. Write the slug function as a pure, tested helper: lowercase, strip what a URL cannot carry, collapse separators, cap at 60 characters, and fall back to a `skill-` prefix with a short digest when the name yields nothing usable, satisfies **AC-5**
8. Add the write path: a `createSkill` server function that validates the payload, reads the Clerk session and refuses anonymous callers, derives the slug, inserts the row, and on a unique violation retries with a numeric suffix rather than checking first, so two writers asking for the same slug at once both succeed, satisfies **AC-4**, **AC-5**, **AC-6**
9. Return explicit failures: a small result type with the code and message for each failure case, a validation failure that names the offending field and covers the trimmed empty cases, the summary and description ceilings, and the install link format, and a boundary that turns an unexpected database error into `SKILLS_QUERY_FAILED` or `SKILLS_WRITE_FAILED` instead of throwing at the UI, satisfies **AC-8**
10. Prove the write thread: create one skill while signed in and read it back, confirm the second skill with the same name lands as `pdf-reader-2`, confirm an anonymous create is refused, and confirm an over long name and a bad install link are each refused by name, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-8**
11. Point the connection at a hosted Postgres, confirm the migration, the seed, and both functions work against it, and confirm the connection string lives only in `.env.local` and the host's environment, satisfies **AC-10**

## Consequences

**Positive**:
- Later slices stop re-deciding storage. Publish, the signed in area, upvotes, and search all read and write through the same query layer, so each one is mostly its own logic.
- The database's rules and the TypeScript types come from one file. A migration and a type change are the same edit, which is the main reason to prefer a typed query layer over hand written SQL here.
- Keeping only a Clerk user id means there is no synchronisation path to build, and no stale copy of a person's name or photo to explain.
- Choosing a connection string over a vendor specific driver means the deploy feature can pick its host without touching this code.

**Negative / tradeoffs**:
- A database is new operational surface, and until now the app could not fail because a store was down. Now it can, and it can also refuse to boot: because the connection is validated at startup as the conventions require, `npm run dev` stops with a clear message until `DATABASE_URL` exists. The sign in and design pages will not load until you set it.
- Reading a publisher's name and avatar card by card means a call to Clerk on the read path, or a cached copy. If the catalogue ever renders hundreds of cards this becomes the thing to fix, and the fix is the mirrored owner row this spec declined.
- The read returns `authorId` and nothing more about the person, so until slice 2 stores an author, every seeded skill is publisherless and cards must render without one. That empty case has to be designed for rather than discovered.
- Directory specs are heavier to read than a single file. The tradeoff is accepted because the decision record is worth keeping separate from the build steps.
- Drizzle is a real abstraction to learn, and its error messages sit between you and Postgres when a query misbehaves.

**Neutral**:
- `author_id` becoming required is a migration in slice 2 rather than a change to this spec. The column is nullable now on purpose, so this slice is buildable before the publish form exists.
- The description column stores markdown but nothing renders it yet. Rendering, and the choice of renderer and sanitiser, belongs to the detail page in slice 2.
- Running two `db:` commands rather than one is a deliberate split, so a host can never accidentally reload sample data while updating the schema.

## Follow-up

- [ ] Decide the hosted Postgres provider (Neon and Supabase are the leading candidates, both fit the connection string choice) before the deploy feature runs. The build needs one reachable instance to satisfy AC-10, and any provider's free tier will do, so this does not force the deploy decision, only a placeholder instance.
- [ ] Decide whether the catalogue reads publisher details from Clerk per card or stores a cached copy, when the catalogue feature is designed. This spec deliberately leaves the app without one.
- [ ] `AGENTS.md` names the installed skills but not the ORM. Once Drizzle is in the project, its conventions (schema first, migrations generated not hand edited, server only client) apply to every file that touches data and belong in the root `AGENTS.md` `## Rules`, which loads on every task.
- [ ] Consider installing a Drizzle community skill before the build, so the query and migration conventions for this specific tool are authoritative rather than recalled.

## References

**Project sources** (verifiable, in this repo):
- `AGENTS.md`, the stack, the strict types rule, the explicit failures rule, the folder by feature rule, and the environment validation rule.
- `docs/scope/scope.md`, feature 1, its intent and its `Done when` line, which seeded the acceptance criteria.
- `docs/specs/0002-design-system/index.md`, the primitives the catalogue's cards and error and empty states are built from.
- Installed community skills: `tanstack-start-best-practices` for the server function convention, `clerk-tanstack-patterns` for reading the session server side.

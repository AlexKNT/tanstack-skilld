# Verify: skill data model · spec 0003 · updated 2026-09-27
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Applied against Supabase (hosted Postgres 17.6).** The migration is live, the seed loaded 8 sample skills, and both paths were exercised against the real database. Ticked steps were confirmed with the evidence noted. Unticked steps still need a run.

## Already confirmed by `/develop`

- **The schema is live, not just generated.** `public.skills` exists with all 9 columns, the correct types and nullability, `gen_random_uuid()` and `now()` defaults, 3 indexes (`skills_pkey`, `skills_slug_unique`, `skills_created_at_idx` on `created_at DESC, id DESC`), and all 6 check constraints.
- **`db:migrate` is safe to repeat.** Ran 4 times against the applied database, exit 0 each time, and `drizzle.__drizzle_migrations` holds exactly 1 row.
- **`db:seed` is safe to repeat.** Run 1 added 8, run 2 added 0 and reported 8 already present, so no existing row's id or creation time changed.
- **The read path returns the right page.** `listSkillRows(20, 0)` returned 8 rows newest first (`test-case-suggester` first, `pdf-reader` last), `limit 3` returned 3, and `createdAt` came back as a real `Date`.
- **The `null` to `undefined` mapping works.** Seeded rows have `authorId === undefined`, a skill with no link has `installUrl === undefined`, and one with a link has it present.
- **The clash retry produces the spec's exact result.** Saving a second skill named `PDF Reader` stored `pdf-reader-2`, not a duplicate key error.
- **Every database rule bites.** Duplicate slug, blank name, 81 character name, non URL safe slug, 201 character summary, whitespace only summary, and whitespace only description were each refused by the store.
- **No database credential reaches the browser.** `dist/client/assets` contains no match for `DATABASE_URL` or `drizzle-orm`.
- **The connection string is not committed.** `git check-ignore .env.local` exits 0.

## UI / manual
- [ ] Start the app with no `DATABASE_URL` → it stops with a message naming `DATABASE_URL`, not a raw connection stack trace → AC-1
- [x] Call `createSkill` while signed out → `UNAUTHENTICATED` and no row written → AC-6
- [x] Call `createSkill` signed in, then confirm the stored `author_id` is your Clerk user id, and that sending an `authorId` in the payload does not override it → AC-6
- [x] Inspect a freshly created row → `created_at` and `updated_at` are set by the database, and equal on insert → AC-4
- [x] Create two skills with the same name through the real server function → `pdf-reader` and `pdf-reader-2`, no error → AC-5

## Commands
- [x] `npm run db:migrate` twice → nothing left to apply, no error → AC-1, AC-9
- [x] Confirm the live schema (columns, indexes, check constraints) → present, matching the spec's data model → AC-1, AC-7
- [x] `npm run db:seed` twice → 8 added, then 0 added → AC-9
- [x] `listSkills` default page → 8 skills, newest first → AC-3
- [x] `listSkills({ limit: 101 })` → `VALIDATION_FAILED`, field `limit` → AC-3
- [x] `listSkills({ limit: -1 })` → `VALIDATION_FAILED`, not a silently corrected 0 → AC-3
- [x] `listSkills({ offset: -1 })` → `VALIDATION_FAILED`, field `offset` → AC-3
- [x] `createSkill` input with `installUrl: "example.com"` → `VALIDATION_FAILED`, field `installUrl` → AC-8
- [x] Input with an 81 character name → `VALIDATION_FAILED`, field `name`, and the database check refuses it too → AC-7, AC-8
- [x] Input with `summary: "   "` → `VALIDATION_FAILED`, field `summary` → AC-8
- [x] Input with an empty `description` → `VALIDATION_FAILED`, field `description` → AC-8
- [x] Input with a 201 character `summary` → `VALIDATION_FAILED` before the database is reached → AC-8
- [x] Input with a blank `installUrl` → treated as absent, not as a failure → AC-8
- [x] Insert a row directly with a duplicate slug → the `skills_slug_unique` constraint refuses it → AC-7
- [x] Insert a row directly with a blank name → the `skills_name_not_blank` check refuses it → AC-7
- [x] `npx tsc --noEmit` → passes → AC-2
- [x] Rename a column in `src/db/schema.ts` and confirm the code importing `Skill` fails to compile, then rename it back → AC-2
- [x] `npm run build`, then grep `dist/client/assets` for `DATABASE_URL` and `drizzle-orm` → no match → AC-6, AC-10
- [ ] Point `DATABASE_URL` at the production instance and repeat the migrate and seed → AC-10

## Acceptance-criteria coverage
- AC-1 … the double `db:migrate` step and the live schema check
- AC-2 … the `tsc` step, the rename test, and the `undefined` mapping
- AC-3 … the default page step plus the three bad limit and offset steps
- AC-4 … the signed in create step and the timestamp inspection
- AC-5 … the clash retry (proved as `pdf-reader-2`) and the unusable name step
- AC-6 … the signed out step, the stored `author_id` step, and the bundle grep
- AC-7 … the live schema check and the two direct insert steps
- AC-8 … the install link, empty field, over length, and blank install link steps
- AC-9 … the double `db:migrate` and double `db:seed` steps
- AC-10 … the bundle grep, `git check-ignore`, and the production repetition

# Verify: moderation · spec 0009

Run on 2026-10-15 against the production build (`npm run build`, then `npm run preview` on
`http://localhost:4173`), driven in a real browser as both accounts, with the server function called
directly over HTTP and the live store queried. Every box below was run and passed. Verdict: **PASS**,
all 22 acceptance criteria met, every specced surface built.

Two accounts were used. `Aleksandrs Krivenkovs` holds `public_metadata.role = "admin"`;
`Verify Area` is an ordinary author.

## UI

- [x] Publish or pick one of your own skills, then press Hide on its card, give a reason, and confirm:
  the card keeps the skill and shows a Hidden badge, "Hidden by you", the date, and the reason → AC-11, AC-13
- [x] Press Restore on that same card and confirm: the skill is published again, the reason is gone, and
  the badge with it → AC-5, AC-13
- [x] Open the hide dialog and choose "Leave it hidden": the dialog closes, nothing changes, and no
  announcement is made → AC-13
- [x] Open the hide dialog and type 300 characters of reason, then confirm: the dialog stays open, what
  you typed stays, and the refusal reads "A reason can be up to 200 characters." → AC-21
- [x] Hide a skill you wrote, then hide the same skill as the admin, then look at it on the author's card:
  it states "An admin must restore it for you" and offers no control → AC-14
- [x] Point that skill's stored `moderated_by` at an id Clerk does not know and reload: the row still
  renders, under "A former member" → AC-11
- [x] Open `/account` with one skill hidden and one published: it reports the published count and the
  hidden count separately → AC-12
- [x] Open a hidden skill's own edit page and save a change: the page states it is hidden, the save is
  kept, the skill stays hidden with its reason, and you land back on the list → AC-15
- [x] Load a hidden skill's public address: "Skill not found", and no line of its content is in the HTML → AC-10
- [x] Search the catalogue for the hidden skill, and page through it: the skill is on no page and holds no
  slot → AC-7
- [x] Replay the hide from the card and follow a link to the catalogue without reloading: the skill is
  already gone → AC-19
- [x] Load `/admin/skills` signed out: you are sent to sign in and returned to that path → AC-16
- [x] Load `/admin/skills` signed in without the role: the app's page not found surface → AC-16
- [x] Load `/admin/skills?visibility=hidden`: only hidden skills, each with its publisher, its state and
  the last action anybody took, including the reason → AC-17
- [x] Load `/admin/skills?visibility=nonsense`: the value is dropped and every skill is listed → AC-17
- [x] Press Load more on the admin list: more rows, and no row appears twice → AC-17
- [x] Hide a skill from the admin list, and restore another: both land, and the row's last action line
  follows → AC-6, AC-17
- [x] Press the admin list's control from the keyboard (Enter) and dismiss with Escape: focus comes back
  to the control that opened the dialog, on both surfaces → AC-22
- [x] Narrow both surfaces to 320px: content measures 305px and nothing overflows → AC-22
- [x] With the role granted mid session, reload `/admin/skills`: access, without signing in again. Remove
  the role and reload: page not found → AC-18

## Commands

- [x] `npm run db:migrate` a second time → applied cleanly and changed nothing → AC-1
- [x] `information_schema.columns` for `skills` → `visibility` text NOT NULL default `'published'`,
  `moderated_at` timestamptz nullable, `moderated_by` text nullable, `moderation_reason` text nullable → AC-1
- [x] `pg_indexes` for `skills` → `skills_visibility_created_idx` on `(visibility, created_at DESC, id DESC)` → AC-1
- [x] `pg_constraint` for `skills` → `skills_visibility_allowed` (the two stored states) and
  `skills_moderation_reason_length` (1 to 200 when present) → AC-1
- [x] `update skills set visibility = 'retired'`, `set moderation_reason = ''`, and a 201 character reason
  → each refused with SQLSTATE `23514` → AC-1
- [x] The store's visibility write called four times in a row on your own row → first `changed: true`, the
  repeat `changed: false` with `moderated_at`, `moderated_by` and the reason untouched → AC-2
- [x] The same write called with another person's id as the actor → `SKILL_NOT_FOUND`, the answer a slug
  that was never stored gets → AC-4
- [x] An author's restore of a hide an admin made → `NOT_ALLOWED` with "Only an admin can restore this
  skill.", and the row stays hidden on the admin's record → AC-5
- [x] The row's id captured while hidden and again after the restore → identical id, identical slug → AC-8
- [x] The shared list query while the row is hidden → absent from page one, page two, the tag filtered
  read and the term searched read; `listSkillTagRows` no longer counts its tag → AC-7, AC-9
- [x] `findSkillBySlug` for a hidden slug, a slug that was never stored, and a published slug → the first
  two answer identically (`ok`, no value), the third resolves → AC-10
- [x] `POST /_serverFn/<the visibility write>` with no cookies, once plain and once forging an `actorId`
  and a `moderatedBy` naming the admin → `{"ok":false,"code":"UNAUTHENTICATED"}` both times, and the row
  keeps its real actor, time and reason → AC-3
- [x] `GET /_serverFn/<the admin list read>` from a signed in person without the role → `NOT_ALLOWED`
  with "This page is for admins." → AC-16
- [x] A second server instance pointed at an unreachable database, then `/admin/skills` loaded as an
  admin → "The skills could not be loaded." with a Try again control, the same read error surface the
  catalogue shows for its own read → AC-17
- [x] The PostHog batches from four real changes decoded from the request bodies → exactly four
  `skill_visibility_changed` events, carrying `slug`, `visibility`, `actor_role` (admin for an admin on
  someone else's skill, author for an admin on their own) and `has_reason` → AC-20
- [x] The same capture around a no-op call and around a refused call → no event at all → AC-20, AC-21

## Acceptance criteria coverage

AC-1 schema, index and checks, migration idempotent · AC-2 one write, idempotent, decides the caller
first · AC-3 the session is the only source of the actor · AC-4 author or admin only, a stranger gets
`SKILL_NOT_FOUND` · AC-5 an author may undo only their own hide · AC-6 an admin may act on any skill ·
AC-7 the catalogue returns published skills only · AC-8 a hide removes nothing but visibility ·
AC-9 the rule lives in the shared list query · AC-10 the detail read answers as a missing slug does ·
AC-11 the author's list carries every skill with who, when and why · AC-12 the two counts are separate ·
AC-13 one dialog with an optional reason · AC-14 restore only for your own hide · AC-15 an edit leaves a
hidden skill hidden and says so · AC-16 the admin area is guarded on the server · AC-17 the admin list is
paged, filterable and states the last action · AC-18 the role is read per request · AC-19 the acting
person's reads settle before they see them · AC-20 one event per change, captured after the store
confirms · AC-21 one map of code to wording, shown in a live region · AC-22 the controls, the dialog and
320px hold up.

## Notes

- AC-17's failure clause was exercised by running a second server instance against an unreachable
  database, so the live store was never broken.
- The spec's build plan names `src/features/skills/data.ts` for `setSkillVisibility`; it lives in
  `src/features/moderation/data.ts`. Behaviour matches the spec. The line is stale.
- Fixtures used for this pass were deleted afterwards: 23 skills, none hidden, and only the two pre
  existing rows carry a moderation record.

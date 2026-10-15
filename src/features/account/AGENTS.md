# Account area (signed in)

The pages behind sign in: an overview, your own skills, your profile, and
settings, plus the edit page for one of your own skills. One nested layout, one
guard, and one ownership rule. Spec: `docs/specs/0006-signed-in-area/index.md`.

## Where things live

- `data.ts`: the one server function that reads our store for the area
  (`getAccountOverview`, the identity from Clerk plus the published count and the
  hidden count, kept apart).
- `query.ts`: the area's query keys (`mySkillKeys`) and its query options, so
  every read and every invalidation agree.
- `components/`: the sidebar navigation, the management card and its skeleton,
  the hidden state note the card and the edit form share, the edit form, the
  delete confirmation, and the profile forms.

The routes sit with the other file based routes in `src/routes/`. `account.tsx`
is the layout and holds the guard; `account.index.tsx`, `account.skills.tsx`,
`account.skills.index.tsx`, `account.skills.$slug.edit.tsx`,
`account.profile.tsx` and `account.settings.tsx` render inside it. The skill read
and write functions live in `src/features/skills/data.ts`, because the catalogue
shares them.

## Guarding

- Every route under `/account` is guarded on the server. The layout awaits
  `ensureSignedIn` (`src/features/skills/auth.ts`) in `beforeLoad`, and because
  the check runs in a server function a signed out request is redirected before
  any area HTML is produced.
- The guard carries the requested pathname and query string as the return path,
  and only root relative, in app paths are accepted.
- The same guard serves `/skills/new`.

## Ownership

- The session user id is the only source of ownership. No client value names an
  author, and every write re reads the session.
- Ownership is enforced inside the query itself: `findSkillRowForAuthor`,
  `updateSkillRow` and `deleteSkillRow` in `src/db/queries.ts` all filter on
  `author_id`. A skill owned by someone else therefore finds no row, and answers
  exactly what a missing skill answers, never a distinct "not yours" reason.
- The paged list read filters by the session user id, so it cannot be made to
  return another author's rows.
- Visibility is not ownership: the area's reads deliberately carry no filter on
  it, so an author still sees a skill of their own that is hidden, with the
  reason it went. An author may restore only a hide they made themselves; hiding
  and restoring, and who may do which, live in `src/features/moderation/`.
- Every skill write settles the reads it can make stale before it navigates: the
  detail key for the slug, the area's list and overview keys, and the catalogue
  cards.

## Profile

The profile page writes to Clerk's client SDK rather than to our store, because
Clerk already holds each person's name, photo, and email. The browser checks the
photo for png, jpeg, webp or gif and a 5 MB ceiling, with Clerk still the final
authority.

_Drafted by /sync from the introducing change, worth a quick human pass._

# Moderation area

Hiding a skill, and bringing one back. A skill carries a visibility of
`published` or `hidden`; its author may change it, an admin may change any
skill, and only an admin can undo a hide an admin made. Spec:
`docs/specs/0009-moderation/index.md`.

## Where things live

- `role.ts`: `readIsAdmin`, which answers `public_metadata.role === "admin"` from
  Clerk once per request. It fails closed, and nothing caches it, so a role change
  lands on the next request.
- `data.ts`: the three server functions. `setSkillVisibility` takes the state to
  reach rather than a direction, so a repeated call lands on one honest state;
  `ensureAdmin` is the route guard; `listSkillsForModeration` is the admin read.
- `schema.ts`: the failure codes, the input validation, and
  `MAX_MODERATION_REASON_LENGTH`.
- `query.ts`: `moderationKeys`, the admin list's query options, and
  `settleVisibilityReads`, which settles the catalogue, the author's own area and
  the admin list after a change.
- `use-visibility.ts`: the one client path that changes visibility. It settles
  the reads and captures `skill_visibility_changed`, and it captures nothing
  when the store reports the state already held.
- `messages.ts`: the one map of refusal code to wording. Both surfaces read
  their copy from here.
- `labels.ts`: `UNRESOLVED_ACTOR_NAME`, the one label for an actor Clerk no
  longer knows. Names for a row's publisher and moderator come from
  `src/features/skills/authors.server.ts`, one batched Clerk read per page.
- `components/`: `visibility-dialog.tsx` is the confirmation both surfaces open,
  and `moderation-skill-row.tsx` is one row of the admin list.

The admin route is `src/routes/admin.skills.tsx`, and its visibility filter is
read from the address by the route's own search validator, so an unreadable
value is dropped before it reaches the store. The author's own control sits on
the management card in `src/features/account/`.

## The rule lives in the store

- The public reads are closed by `publishedOnly()` in `src/db/queries.ts`. It is
  applied to the shared list query, the detail lookup and the tag counts, so a
  later caller of that query excludes hidden skills by construction. A read that
  must see every state, such as the author's own list, does not carry it.
- Authority is decided inside the statement that performs the change, never in
  the caller: one statement for a row the session user authored, one for any row
  when the role allows it, each with its rule in the filter. A stranger's answer
  is `SKILL_NOT_FOUND`, exactly what a slug that is not stored answers.
- Asking for the visibility a skill already holds succeeds, reports
  `changed: false`, and writes no column, so a repeat cannot change who
  moderated a skill, when, or why.

## Conventions

- Restore authority: an author may undo only a hide they made themselves, and an
  admin may undo any hide. An author asking to restore someone else's hide is
  refused and the skill stays hidden.
- The session is the only source of the actor. No payload value names one.
- A restore clears the reason; a hide may carry one of up to 200 characters, and
  the author is the only person shown it.
- A hidden skill keeps its slug and every other row it owns, so a restore brings
  back the same skill at the same address.
- An admin acting on their own skill is the author, for what the event reports.
- `ensureAdmin` answers the app's not found surface rather than redirecting, so a
  signed in person who is not an admin is never told the area exists.

_Drafted by /sync from the introducing change, worth a quick human pass._

# Verify: upvotes · spec 0007 · updated 2026 10 13

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Signed out, open `/` → every card shows a count, a fresh skill shows `0` rather than nothing, and the vote control reads "Upvote <skill name> <count>" and is not pressed → AC-5, AC-6, AC-8
- [ ] Signed out on `/`, activate a card's vote control → you land on `/sign-in?redirect=%2F`, and after signing in you return to the catalogue → AC-8
- [ ] Signed out on `/skills/<slug>`, activate the vote control → the address becomes `/sign-in?redirect=%2Fskills%2F<slug>`, and after signing in you land back on that skill → AC-8
- [ ] Signed in, open a skill and upvote it → the button is pressed immediately, the count rises by one, the new count is announced, and a reload keeps the vote → AC-3, AC-5, AC-10, AC-11, AC-13
- [ ] Upvote the same skill from its card in the catalogue → the card shows the same state and count as the skill's page, and a reload keeps both → AC-3, AC-6
- [ ] Activate the control again to withdraw → the count falls by exactly one and a reload shows no vote; activate the same direction twice → the count moves once, because both directions are safe to repeat → AC-2, AC-4
- [ ] Two accounts on one browser: A upvotes a skill, then signs out through the header's user button, then B signs in through the header's dialog without any page navigation → B sees the true count and is not pressed; B upvotes and the count rises; A returns and sees only A's own pressed state → AC-7
- [ ] Upvote a skill, then reload `/` and page through "Load more" → the catalogue is still newest first, twenty per page, and the count changed no order → AC-15
- [ ] With a skill page open, make the write fail (stop the database, or block the write request in the browser's Network panel) and activate the control → the button and the count return to their previous values and "Your upvote could not be saved." appears inside the control and is announced → AC-11
- [ ] With the PostHog network tab open, upvote → exactly one `skill_upvote_changed` event carrying `slug` and `upvoted: true`; withdraw → one event with `upvoted: false`; a failed write → no event at all → AC-14
- [ ] Tab to the control → it takes focus with the visible ring at full strength; press Enter or Space → the vote changes and the pressed state, the new count, and any failure message are announced through the polite live region → AC-13
- [ ] Point the control's write at a skill id that is not stored (a temporary edit in the browser, or the same call from the store console) → the answer is a not found failure and the button returns to its previous state, never a thrown error → AC-12
- [ ] Signed out, send the write anyway (through the page's own tooling) → `UNAUTHENTICATED` and no row written → AC-9
- [ ] Make the session read fail (blank `CLERK_SECRET_KEY` in `.env.local`, restart the dev server) → `/` and `/skills/<slug>` still render with their counts and show no viewer state → AC-5, AC-6

## Commands

- [ ] `npm run db:migrate` against a database that already holds skills, then run it a second time → both runs succeed, the second changes nothing, and `drizzle/meta/_journal.json` records `0002` once → AC-1, AC-16
- [ ] Introspect `skill_upvotes` in `npm run db:studio` → three columns (`skill_id`, `user_id`, `created_at`), the primary key on (`skill_id`, `user_id`), the foreign key to `skills.id` with `ON DELETE CASCADE`, and the (`user_id`, `skill_id`) index → AC-1, AC-5
- [ ] Insert the same (`skill_id`, `user_id`) pair twice in the store → the second insert is refused by the primary key and `count(*)` stays one; insert a vote for a random uuid → the foreign key refuses it → AC-2, AC-12
- [ ] Delete a skill that holds votes → its vote rows are gone → AC-1
- [ ] `npm run typecheck` → passes → build guard
- [ ] `npm run check` → passes (run with `--staged` on Windows, where the working tree is CRLF and the index is LF) → build guard
- [ ] `npm run build` → passes → build guard
- [ ] `/test`: a unit call to `validateSetUpvoteInput` with no `skillId` → `VALIDATION_FAILED` naming `skillId`; with a non boolean `upvoted` → the same, naming `upvoted` → AC-12

## Acceptance criteria coverage

- AC-1 → the migration command and the schema introspection, plus the cascade delete of a skill
- AC-2 → the store duplicate insert and the UI "same direction twice" step
- AC-3 → the signed in upvote step and the card step
- AC-4 → the withdraw step
- AC-5 → the signed out counts step, the signed in upvote step, and the introspection command
- AC-6 → the signed out counts step, the card step, and the session outage step
- AC-7 → the two account step
- AC-8 → the two signed out steps
- AC-9 → the signed out write step
- AC-10 → the signed in upvote step, where the button and the count settle without a second request
- AC-11 → the signed in upvote step and the failed write step
- AC-12 → the store refusal command, the not stored skill step, and the unit step
- AC-13 → the keyboard and live region step
- AC-14 → the analytics step
- AC-15 → the ordering step
- AC-16 → the second migration run

## Value sourcing coverage

Each row of the spec's value sourcing table, with the step that exercises it:

- the count shown on a card and a page, counted from the rows with zero when none match → the signed out counts step, the introspection command
- whether the viewer has voted, from the existence of the pair → the signed out counts step, the two account step
- the viewer segment of the catalogue and detail keys, from `readViewerId` in the root route with a signed out marker when there is none → the two account step
- the state the control asks for, being the inverse of what it was rendered from → the withdraw step
- the state the write reports, being the requested state once the store confirms it → the signed in upvote step
- the new count, read after the write → the signed in upvote step, where the number matches the store
- the page to come back to, passed as the return path the sign in page accepts → the detail page signed out step
- the event's slug, from the payload the control was rendered with → the analytics step
- the event's state, from the value the write returned → the analytics step
- the control's accessible name, from the skill's name plus the feature's own label → the keyboard step
- the announcement of the new count and of a failure, from the polite live region → the signed in upvote step, the failed write step, the keyboard step
- the read that replaces the previous person's state when someone signs in or out → the two account step
- the count and "no viewer" when the session cannot be read → the session outage step

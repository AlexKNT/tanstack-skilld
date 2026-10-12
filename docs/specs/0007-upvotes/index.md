# 0007. Let signed in visitors upvote a skill, with the count on cards and on the detail page

**Date**: 2026-10-12
**Status**: Proposed

## Summary

Skild can show skills, but nobody can say that a skill is worth using. This decides how an upvote is stored and how the number reaches the page. Votes live in their own table with one row per person per skill, so the store itself refuses a second vote and the number shown is always a count of real rows rather than a second copy that can drift. A signed in visitor toggles a vote from a card or from the skill's page, everyone sees the count, and a signed out visitor is sent to sign in and brought back to the page afterwards. Nothing changes about who owns a skill, and the count never reorders anything.

## Requirements

**User stories**:
- As a signed in visitor, I want to upvote a skill that looks useful, so that other people can tell it is worth their time.
- As a signed in visitor, I want to take my upvote back when I change my mind or clicked by mistake, so that the number stays honest.
- As any visitor, I want to see how many people upvoted a skill on its card and on its page, so that I can judge a skill before installing it.
- As a signed out visitor, I want to understand that voting needs an account, so that I can sign in and come back to the skill I was reading.
- As the person running the project, I want the number to be counted from the votes themselves, so that it can never disagree with them.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A `skill_upvotes` table exists, created by a migration that `npm run db:migrate` applies, holding one row per skill and voter keyed by the pair (`skill_id`, `user_id`), with a `created_at` that defaults to now and a foreign key to `skills.id` that removes a skill's votes when the skill itself is deleted.
- **AC-2**: A second upvote for the same skill by the same person is refused by the store and not only by the interface, so a repeated or retried call can never create two rows or move the count by two.
- **AC-3**: A signed in visitor can upvote a skill from the skill's detail page and from the skill's card in the catalogue, and the vote survives a reload and a fresh request.
- **AC-4**: A signed in visitor can take their upvote back from either surface, and taking it back deletes the stored row so the count falls by exactly one; repeating the same direction twice changes nothing, because both directions are idempotent (safe to send more than once).
- **AC-5**: The number shown on a card and on the detail page is counted from the stored votes for that skill at read time, a skill with no votes shows zero rather than a missing value, and no stored counter exists anywhere.
- **AC-6**: The catalogue page read and the detail read each return, for every skill they return, the count and whether the signed in viewer has already voted, in the same response, so a card needs no second request to place its button.
- **AC-7**: The cached catalogue and detail data is keyed by the viewer, signing in or signing out invalidates the skill data even when the sign in happened in the header's dialog with no navigation at all, and after one person signs out and another signs in on the same browser the second person never sees the first person's vote state.
- **AC-8**: A signed out visitor sees the count everywhere it is shown, and the vote control sends them to sign in and returns them to the page they came from, rather than a control that looks live and silently does nothing.
- **AC-9**: An anonymous or forged call to the write is refused with the project's `UNAUTHENTICATED` failure and writes nothing; the voter is always the session user id read on the server, and no value supplied by the browser may name a voter.
- **AC-10**: The write returns the resulting state and the new count read from the store, so the caller can settle the button and the number without a second request.
- **AC-11**: A click is reflected immediately, and if the write fails the previous state and count are restored and a short message appears inside the control, so the interface never keeps a vote the store does not hold.
- **AC-12**: A malformed payload is refused with `VALIDATION_FAILED` naming the field, a skill id that is not stored is refused with a not found failure, and neither case reaches the interface as a thrown error.
- **AC-13**: The vote control is a real button with an accessible name that includes the action and the skill, it exposes whether it is pressed, it is reachable and operable from the keyboard, it shows a visible focus ring, and the changed count and any failure message are announced to assistive technology through a polite live region (a container assistive technology reads out when its text changes) rather than changing silently.
- **AC-14**: A successful vote change captures one PostHog event carrying the skill's slug and the resulting state, recorded only after the store confirms the change, in the same shape the other features capture their events.
- **AC-15**: The catalogue stays newest first with its existing page size, offset paging, and `hasMore` rule, and the upvote count changes no order anywhere.
- **AC-16**: The migration applies to a database that already holds skills and is safe to run twice, leaving every existing row and its id untouched.

## Decision

**Chosen option**: Option 1 in each of the six decisions recorded in [rationale.md](rationale.md): one `skill_upvotes` table keyed by the skill and voter pair, the count derived at read time, viewer aware reads with the viewer in the cache key, one intent based write, a toggle, and the control on cards and on the skill page only.

A vote is a row. `skill_upvotes` holds one row per person per skill, the pair (`skill_id`, `user_id`) is the primary key, and the row carries a `created_at`. There is no stored number: the count on a card or a page is `count(*)` over those rows for that skill. One server function changes a vote, and it takes the state to reach rather than the state currently held, so a repeated or raced call cannot flip a vote the wrong way. The two existing public reads, `listSkillCards` and `getSkillDetail`, gain the count and the viewer's own state, read from the Clerk session inside the same server function, and the catalogue and detail query keys gain the viewer segment so a page built for one person can never be served to another. Nothing is copied out of Clerk: the voter is the session user id and nothing else.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**:

One new table, `skill_upvotes`. There is still no local users table, so the voter is held as a Clerk user id with no foreign key to reference.

| Column | Type | Rules |
|---|---|---|
| `skill_id` | uuid | part of the primary key, references `skills.id`, removed with the skill |
| `user_id` | text | part of the primary key, holds the Clerk user id of the voter, required |
| `created_at` | timestamp with time zone | required, database default of now, the vote's own record |

Indexes: the primary key on (`skill_id`, `user_id`) both refuses a duplicate vote and serves the per skill count. A second index on (`user_id`, `skill_id`) serves the "has this viewer voted" lookup, which the primary key alone would answer with a scan.

**State transitions**:

One state per skill and person, with two transitions and no others: absent becomes voted (an insert), and voted becomes absent (a delete). A signed out caller can enter neither. A skill id that is not stored is not a transition at all, it is refused.

**API surface**:

Every entry is a TanStack Start server function (a typed server side function the client calls as if it were local), not an HTTP route.

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `setUpvote` | write | `skillId: string (req)`, `upvoted: boolean (req)` | `{ upvoted: boolean, upvoteCount: number }`, the state the store now holds and its count | Clerk session required | `UNAUTHENTICATED`, `VALIDATION_FAILED` naming the field, `SKILL_NOT_FOUND`, `SKILLS_WRITE_FAILED` |
| `listSkillCards` (existing, extended) | read | `limit?: number (opt, default 20, ceiling 100)`, `offset?: number (opt, default 0)` | `{ items, hasMore }`, where each item now also carries `upvoteCount` and `viewerHasUpvoted` | public, and reads the session when there is one | unchanged |
| `getSkillDetail` (existing, extended) | read | `slug: string (req)` | one skill, now also carrying `upvoteCount` and `viewerHasUpvoted` | public, and reads the session when there is one | unchanged |
| `readViewerId` | read | none | the session user id, or nothing when signed out | public | a failed session read answers "signed out" rather than failing the page |

All of them return the project's `Result` shape (a success carrying a value, or a returned failure with a code, a message, and an optional field) rather than throwing, so the interface renders a state instead of falling over.

`setUpvote` answers `SKILL_NOT_FOUND` two ways, and neither of them races. Going up, the store itself refuses the row: the foreign key violation that comes back for a skill that is not stored is mapped to `SKILL_NOT_FOUND` through the same error chain helper the store already uses for a duplicate slug. Going down, the function reads the skill's existence first, which is safe rather than racy, because the only way that read goes stale is the skill being deleted in between, and deleting a skill removes its votes anyway, so a delete that matches nothing is a success rather than a lie.

**Value sourcing** (every value each action produces, computes, or displays names where it comes from; a required value with no named source is an undecided input, resolved here rather than left for the build to invent):

| Action | Value produced / displayed | Source |
|---|---|---|
| `listSkillCards`, `getSkillDetail` | the count shown on a card and on a page | `count(*)` over `skill_upvotes` for that `skill_id`, read in the same statement, and zero when no vote row matches |
| `listSkillCards`, `getSkillDetail` | whether the viewer has already voted | the existence of the row for (`skill_id`, session user id), with the session user id read by `auth()` inside the server function |
| the catalogue and detail cache keys | the viewer segment that keeps one person's state out of another's page | the Clerk user id resolved by `readViewerId` in the root route's `beforeLoad`, and a signed out marker when there is none |
| the vote control | the state it will ask for | the inverse of `viewerHasUpvoted` in the payload the control was rendered from |
| `setUpvote` | the resulting state | the row the write inserted or deleted, reported as the requested state once the store confirms it |
| `setUpvote` | the new count | `count(*)` read in the same call, after the write |
| the signed out path | the page to come back to | the current location, passed as the return path that `ensureSignedIn` already accepts |
| the analytics event | the skill's slug | the `slug` column of the payload the control was rendered from |
| the analytics event | the resulting state | the `upvoted` value returned by the write |
| the control's accessible name | the skill's name | the `name` column of the payload, with a constant label from the feature |
| the vote control | the announcement of the new count, and of a failure | a polite live region on the control, updated from the state the write returned |
| signing in or signing out | the read that replaces the previous person's state | an invalidation of the whole `skills` key family, which partial matching applies to every viewer segment, because the header signs in through a dialog with no navigation |
| the two public reads | the count and "no viewer" when the session cannot be read | a failed session read treated as signed out, so a Clerk problem degrades the page instead of failing it |

**Key invariants**:
- The count is always a count of the stored rows for that skill. No stored number exists, so none can drift.
- A person holds at most one vote per skill, enforced by the primary key, so no application path can create a second.
- The voter is always the session user id read on the server. No value from the browser may name a voter.
- Both directions of the write are idempotent: repeating an upvote leaves one row and the same count, and repeating a withdrawal leaves none.
- A payload's vote state always belongs to the viewer that asked for it, because the viewer is part of the cache key.
- The count never influences an order anywhere, and the catalogue stays newest first.
- Deleting a skill deletes its votes, so a vote can never outlive the skill it points at.
- The optimistic state is reverted whenever the write fails, so the interface never keeps a vote the store does not hold.
- The reader functions stay public and callable by an anonymous visitor, who simply gets a payload with no viewer state.
- The count is joined in as a grouped aggregate rather than as a plain join, so it can never multiply a page's rows or break the `limit + 1` rule that decides `hasMore`.
- An unknown skill can never receive a vote: the up direction is refused by the store's own key, and the withdrawal direction checks the skill first, where the only possible race is a skill that has just been deleted and therefore has no votes to remove.
- A failed session read inside a public read answers "signed out". A Clerk problem leaves the page rendering with counts, it does not take the page down.
- Signing in or signing out invalidates the skill data, so no viewer's state is ever left over from the person who used the browser before.

**Security model**:
- Reading a count is public. A count is not personal data, and it is shown to everyone including signed out visitors.
- Voting requires a Clerk session. The voter comes only from that session, and a signed out or forged call returns `UNAUTHENTICATED` and writes nothing.
- Any signed in person may vote for any skill, including their own. No role, ownership, or moderation rule applies to voting, and ownership stays in `author_id`, untouched by this feature.
- A vote row links a Clerk user id to a skill, so it is personal data in a small way. It is only ever read in aggregate or for the viewer's own state, no surface in this feature lists who voted, and no page names a voter.
- The write already sits behind sign in rather than in the open, and one vote per person per skill is capped by a database key, so the remaining abuse surface is account creation. No per user throttle is added here (see Follow-up).
- No compliance scope applies: no payment, health, or other regulated data. `CLERK_SECRET_KEY`, the Clerk publishable key, and the database URL are already required by earlier features, and no identity data is copied out of Clerk.

**Configuration required**: None new. The feature reuses the existing Clerk and database configuration. It adds no dependency and no environment variable.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: signed in, open a skill, upvote it, reload, and confirm the vote is still there with the count one higher; then upvote the same skill from its card in the catalogue, verifies **AC-3**, **AC-5**, **AC-10**
- Idempotence: call the write twice asking for a vote and confirm one row exists and the count moved once; call it twice asking for no vote and confirm the count moved once down, verifies **AC-2**, **AC-4**
- Failure: make the write fail and confirm the button and the count return to their previous values with a short message, verifies **AC-11**
- Auth/permission: call the write with no session and confirm `UNAUTHENTICATED` with no row written, then call it with an unknown skill id and confirm a not found failure, verifies **AC-9**, **AC-12**
- Signed out: open the catalogue signed out, confirm the counts are visible, activate the control, sign in, and confirm you land back on the page you left, verifies **AC-8**
- Viewer isolation: upvote as one account, sign out and sign in as a second account through the header's dialog with no page navigation, and confirm the second account sees its own state and the true count, verifies **AC-7**
- Session outage: make the session read fail and confirm the catalogue and the detail page still render their counts with no viewer state shown, verifies **AC-5**, **AC-6**
- Cascade: delete a skill that holds votes and confirm its vote rows are gone, verifies **AC-1**
- Ordering: upvote a skill and confirm the catalogue order and its paging are unchanged, verifies **AC-15**
- Accessibility: vote from the keyboard and confirm the focus ring, the pressed state, and that the live region announces the new count, then force a failure and confirm the same region announces the message, verifies **AC-13**, **AC-11**
- Migration: apply the migration twice against a database that already holds skills and confirm it is safe and no existing row changed, verifies **AC-16**
- Analytics: upvote and confirm exactly one event with the slug and the resulting state, and confirm a failed write records none, verifies **AC-14**

## Build plan

Ordered for the project's Tracer Bullet approach (Scope header): stand up the thinnest end to end thread through every layer first, meaning the table, a viewer aware read, the write, and one working control on the detail page, then thicken it with the card, the failure path, the signed out path, the accessibility pass, and the event. The single migration lands first rather than being sliced, because it is one new table and one index with no data change and no backfill, so the schema matches the target from the first build step and nothing is built against a shape this spec does not describe.

1. Add the migration for the confirmed model: the `skill_upvotes` table with the pair (`skill_id`, `user_id`) as its primary key, a `created_at`, a foreign key to `skills.id` that deletes the votes with the skill, and the (`user_id`, `skill_id`) index. Generate it with `npm run db:generate` and apply it with `npm run db:migrate`, then confirm a duplicate pair is refused and that deleting a skill removes its votes. Running it twice is a no operation because drizzle's journal records what has already been applied, so the safety to run twice rests on that journal rather than on `IF NOT EXISTS` in the generated SQL, satisfies **AC-1**, **AC-2**, **AC-16**
2. Add the store's vote writes to `src/db/queries.ts`: an idempotent pair (an insert that does nothing when the pair already exists, and a delete that tolerates a row that is not there), a count for one skill, and the foreign key refusal on the insert mapped to `SKILL_NOT_FOUND` through the same error chain helper the file already uses for a duplicate slug. All of it returns the project's `Result` shape, satisfies **AC-2**, **AC-4**, **AC-5**, **AC-10**, **AC-12**
3. Make the two reads viewer aware: extend `listSkillRows` and `findSkillBySlug` so each row carries the skill's count and the viewer's own state, with the count joined in as a grouped aggregate so it cannot multiply the page's rows or break the `limit + 1` rule. Extend `SkillCard` and `SkillDetail` in `src/features/skills/data.ts` with `upvoteCount` and `viewerHasUpvoted`, read from `auth()` inside the server function rather than passed in from the browser, and treat a session read that fails as signed out so a Clerk problem leaves the public pages rendering, satisfies **AC-5**, **AC-6**, **AC-15**
4. Thin thread end to end: add `setUpvote` (where the withdrawal checks the skill exists before it deletes) and `readViewerId` to `src/features/skills/data.ts`, give the root route's `beforeLoad` the viewer id the way it already reads the theme, add the viewer segment to the catalogue and detail keys in `src/features/skills/query.ts`, and render one working control on the detail page against the real store. Confirm a click writes a row, the count moves, and a reload keeps the vote, satisfies **AC-3**, **AC-7**, **AC-9**, **AC-10**
5. Put the same control on the card in the catalogue grid, layered above the card's stretched link the way the install button already is, with the count beside it, satisfies **AC-3**, **AC-5**
6. Settle the cache and the failure path: the optimistic update with its snapshot and rollback, the inline message when the write fails, the invalidation of the viewer's keys after a change and of the whole `skills` key family on sign in and sign out (the header signs in through a dialog, so nothing else will refresh it), and the hydration rule for the detail key, which has no refetch on mount, satisfies **AC-7**, **AC-11**, **AC-12**
7. The signed out path: the control sends a signed out visitor to sign in carrying the current page as the return path, and the write refuses an anonymous caller on its own, satisfies **AC-8**
8. The accessibility and copy pass: the accessible name, the pressed state, the keyboard path, the visible focus ring, and the polite live region that announces the new count and any failure message, satisfies **AC-11**, **AC-13**
9. Analytics: capture the vote event after the store confirms, with the slug and the resulting state, satisfies **AC-14**
10. Verify: run `/check verify upvotes` against every criterion above, including a second migration run and the two account pass on one browser, satisfies **AC-1** through **AC-16**

## Consequences

**Positive**:
- The number can never disagree with the votes, because there is no second copy of it to keep in step.
- The duplicate rule is a database key rather than a rule every future write path has to remember to apply.
- The count and the viewer's own state arrive with the data the page already fetches, so a card needs no extra request and no client side matching up.
- Both directions of the write are safe to retry, which is what makes the immediate click honest.
- The store is ready for a popularity sort later, because the count is a real query rather than a flag anyone would have to start maintaining.

**Negative / tradeoffs**:
- The public catalogue read now carries a join, an aggregate, and a session read, so it is no longer a purely public query that could be cached for everyone. The page holds 20 skills and the primary key covers the aggregate, so the cost is small, but it is real work on the busiest page in the app.
- Putting the viewer in the cache key splits the client cache per person, and every invalidation has to cover each viewer's keys rather than one shared key. A shared cache layer in front of the catalogue would face the same tension.
- Resolving the viewer id in the root route adds a small server read to every page load, the same shape as the theme read spec 0006 added. Two small reads now sit in one place, and they can be folded together later if they show up as a cost.
- A vote row outlives the person who cast it: when a Clerk account is deleted, its votes stay behind holding an id that no longer resolves. Nothing in this feature lists voters, so the effect is invisible today, but it is a retention gap.
- An upvote is a weak signal and an easy one to inflate, since one person can create accounts. The number is not used for ranking or reward anywhere, so the stakes stay low, but nobody should read it as more than it is.
- A toggle invites accidental clicks and second thoughts, so the count moves in both directions. That is the price of letting a vote be taken back rather than being final.
- The catalogue's markup is now produced per viewer, so the home page cannot be answered from a shared cache without keeping the viewer in mind.

**Neutral**:
- One migration, forward only, creating a table and an index: no backfill, no data change, and no existing row touched.
- No new dependency, no new environment variable, and no change to the Clerk or database configuration.
- The account area's own skill list is deliberately unchanged. It shows a person's skills, not their votes, and adding counts there is a small separate addition if it is ever wanted.
- The control reuses the installed Button and the existing card layout, so no new design primitive is introduced.
- Moderation and search are untouched. When hidden skills arrive (scope feature 7), every surface that shows a count will have to stop counting a hidden skill, and this spec does not cover that because hidden skills do not exist yet.
- Signing in or signing out now invalidates the skill data, so the catalogue refetches after an auth change. That is the price of never showing one person's vote state to the next person on a shared browser.

## Follow-up

- [ ] Votes cast by a deleted Clerk account are left in place, because there is no local user table to cascade from. Decide the retention rule when account deletion or moderation lands (scope feature 7), and treat a person's votes the same way as their published skills.
- [ ] No per user throttle is added to the write, since it sits behind sign in and the primary key caps one vote per person per skill. If inflation shows up in practice, add a small per user limit inside `setUpvote` rather than a new component.
- [ ] A most upvoted ordering was deliberately left out. It belongs with the search and filter slice (scope feature 6), which owns how the catalogue is narrowed and ordered.
- [ ] The viewer id read in the root route's `beforeLoad` is the second small server read there, beside the theme. If the pair becomes measurable, fold them into one call.
- [ ] The Agent Skills and MCP discovery offer was skipped because this feature chooses no new tool: it reuses the store, the server functions, Clerk sessions, and TanStack Query exactly as the earlier specs left them.
- [ ] The scope row for feature 5 reads "upvote a skill once". That still holds in the sense that matters (one vote per person per skill), but a vote can now be taken back, so the prose is slightly narrower than the feature. `/sync` should carry the change if the wording matters to you.
- [ ] If counts are later wanted on the account area's skill list, that is a read addition to `listMySkillCards` and a small card change, not a change to this model.
- [ ] The control invokes the sign in guard from a click handler. This repo has only used that guard inside a route's `beforeLoad` so far, so confirm the redirect reaches the browser cleanly when the signed out path is built, and record the pattern in `AGENTS.md` if it holds.
- [ ] The failed session read is treated as signed out by a rule, not by a shared helper. If a third public read starts caring about the viewer, lift the rule into one place rather than repeating it.
- [ ] The write and the count that follows it are two statements rather than one snapshot, so two people voting in the same instant can each read a count taken a moment apart. That is fine for a hint that ranks nothing, and it would only need a transaction if the number starts deciding something.
- [ ] The polite live region is the first in the repo, where the spinner is the only `role="status"` today. If more surfaces need announcements, lift it into a small shared component rather than repeating it.

## Rationale

Reasoning, the options weighed, and the calls made without asking: see [rationale.md](rationale.md).

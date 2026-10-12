# Rationale: upvotes (spec 0007)

## Context

The catalogue reads real skills (spec 0003, spec 0004), people can publish them (spec 0005), and they now have an account area with their own skills and profile (spec 0006). What is missing is any signal from the community: a visitor can read a skill, but nobody can say that it is worth using. This is the first feature that records one person's opinion about another person's work, which is why the storage, the duplicate rule, and the viewer's own state are worth deciding properly rather than inventing during the build.

The forces that shaped this decision:

- The store is Postgres through Drizzle (spec 0003), and its `skills` table holds only a Clerk user id as the author, so there is no local users table to point at.
- Two reads already exist for the catalogue and the detail page (`listSkillCards`, `getSkillDetail`), both public, both returning the project's `Result` shape, and both cached by TanStack Query with keys that are the same for every visitor (spec 0004).
- Clerk sessions are read inside server functions (`auth()`), and the identity never reaches the browser as data the client can be trusted to send back.
- The publish flow already guards a route by sending a signed out visitor to sign in with a return path (spec 0005, spec 0006), so the signed out vote path has a precedent to reuse rather than invent.
- The root route's `beforeLoad` already hands one server read into router context (the theme), so a second small read there is a pattern the app has, not a new mechanism.
- Analytics events are captured on success for publishing, editing, deleting, and the theme, so an upvote event has an established shape.
- The project is built by Tracer Bullet, so the plan has to prove the thinnest working thread before it thickens anything.
- This is a learning build with one engineer and a small dataset, so the design should stay small: one table, one write, two extended reads, one control.

> ⚠️ Premise note: this feature makes the public catalogue viewer aware, which is the one real tension in it. A page that knows whether you voted cannot be one shared cached page for everybody: the clean answer is to make the viewer part of the cache key, at the price of a per person cache and a per person invalidation, and the messier alternative (a public read plus a second call for the viewer's votes) was weighed as Decision C below. The other thing to say plainly is that an upvote is a weak and easily inflated signal: nothing here ranks, rewards, or promotes anything, and the number should stay a small honest hint rather than grow into a score with weights and decay without a fresh decision. Both points are accepted deliberately, not overlooked.

## Options considered

### Decision A: Where the number comes from

**Option 1: Count the stored votes at read time (chosen).**
The `skills` table stays exactly as it is, and the number on a card or a page is a `count(*)` over the vote rows for that skill, read in the same query as the skill itself.

- Pros: the number can never disagree with the votes, because there is no second copy of it; a vote and its removal change the count by construction; no update path has to remember to keep a number in step; at this size the aggregate is served by the primary key of the vote table.
- Cons: every catalogue page pays a join and an aggregate, so the read gets heavier as the table grows, and the fix (a cached or stored number) would then have to be designed properly rather than assumed.

**Option 2: Keep an `upvote_count` column on `skills`.**
Each vote or withdrawal updates a number on the skill row.

- Pros: the list read is a plain column read with no join, so it stays as cheap as it is today; a count is available without touching the vote table at all.
- Cons: the number is a second source of truth and it will drift, from a failed update, a manual fix, a future import, or a delete that forgets to decrement; fixing drift needs a reconciliation job or a recount, which is more machinery than the number is worth here; a candidate spec would have to invent that job now.

### Decision B: What identifies a vote row

**Option 1: The pair (`skill_id`, `user_id`) as the primary key (chosen).**
The row is identified by who voted for what, with a `created_at` alongside.

- Pros: the database refuses a duplicate vote with no application logic, so "a second upvote does not count twice" is structural rather than remembered; no surrogate column to carry around; the primary key also serves the per skill count.
- Cons: a composite key is slightly less convenient to reference from a future table (a comment on a vote, for instance), and it departs from the `skills` table's habit of a generated uuid id, so a reader meets two conventions.

**Option 2: A generated uuid primary key plus a unique index on the pair.**
Each vote gets its own id, and a unique index enforces one vote per person per skill.

- Pros: consistent with the `skills` table; easy to reference a single vote from elsewhere later; the uniqueness rule is explicit in the index name.
- Cons: a column and an index that nothing in this feature needs, and a scheme where the duplicate rule lives beside the identity rather than being it.

### Decision C: How the viewer's own state reaches the interface

**Option 1: One viewer aware read, with the viewer in the cache key (chosen).**
`listSkillCards` and `getSkillDetail` also return the count and whether the session user has voted, and the query keys carry the viewer.

- Pros: a card is complete when it arrives, so no second request per card and no client side matching; the state and the skill come from one consistent read, so a page cannot show a skill from one moment and a vote state from another; the viewer in the key makes it impossible for one person's page to be served to another.
- Cons: the public reads now read a session, so they are no longer purely public queries; the client cache is split per person and each invalidation has to cover the viewer's keys; the root route needs a small read to learn the viewer id before the key can be built.

**Option 2: Keep the reads exactly as they are and fetch the viewer's votes in a second call.**
The catalogue stays public and viewer free, and one extra call brings the list of skills the viewer has voted for.

- Pros: the public read keeps its shared cache and its existing invalidation story; a signed out visitor never touches the session path.
- Cons: two calls have to agree, so a card can briefly render a state that matches neither; the second call grows with the viewer's own vote history rather than with the page; every surface that shows a control has to join two sources itself, which is exactly the work that belongs on the server.

**Option 3: Ask per skill as each card renders.**
Each control queries whether the viewer voted for its own skill.

- Pros: no change to the catalogue read at all.
- Cons: a page of 20 cards becomes 20 requests, which is the classic fan out mistake; the answer is still the same query the list could have done once.

### Decision D: The shape of the write

**Option 1: `setUpvote({ skillId, upvoted })` (chosen).**
The caller states the state it wants, and the function reaches that state.

- Pros: intent is explicit, so a double click, a retry, or two racing requests cannot flip a vote the wrong way; repeating the same call is harmless, which is what lets the interface update the button before the answer arrives; the interface already knows the desired state, so nothing has to be inferred on the server.
- Cons: the caller carries one more field, and a caller that lies about the current state (asking for a vote that is already there) gets a success it may not expect, so the returned state is what must be trusted.

**Option 2: `toggleUpvote({ skillId })`.**
The server flips whatever it currently holds.

- Pros: the smallest call to make, one field to validate.
- Cons: it depends on the state the server happens to hold, so a retried or duplicated request flips the vote back; with an optimistic interface a user can see a vote appear and then silently vanish, which is the worst kind of bug to explain.

**Option 3: Two functions, `upvoteSkill` and `removeUpvote`.**
Each direction gets its own name.

- Pros: the clearest possible naming, and each function is trivially idempotent.
- Cons: two functions to validate, authenticate, document, and test, and two entry points in the interface for what is one control; the client still has to choose between them from the same piece of state.

### Decision E: Whether a vote can be taken back

**Option 1: A toggle (chosen).**
Activating the control again removes the vote.

- Pros: a misclick is recoverable, which is what people expect from a vote control; the count stays honest when someone changes their mind; no support path for "I voted by accident" with no remedy.
- Cons: a vote stops being a final act, so the number moves in both directions and a person with an account can move a count by one at will.

**Option 2: One way, an upvote can never be withdrawn.**
An upvote is final.

- Pros: the number only ever grows, which is simpler to reason about; one direction to build and test.
- Cons: an accidental click is permanent, and the only remedy is a write to the database by hand; the interface has to make a permanent action look permanent, which is harder than it sounds.

### Decision F: Where the control and the count appear

**Option 1: On skill cards and on the detail page (chosen).**
Both surfaces show the count, and the control is live for a signed in visitor.

- Pros: exactly the surface the scope row asked for; the count is visible where skills are compared and where one is read closely; the account area stays about ownership rather than adding a second meaning to it.
- Cons: a control on a card competes with the card's other actions and with the stretched link that makes the whole card clickable, so its placement needs care.

**Option 2: Cards and the detail page, plus a list of the skills you have upvoted in your account area.**
The account area gains a page listing the viewer's own votes.

- Pros: a viewer can find the skills they liked again; it makes the vote feel like a saved item.
- Cons: it grows the scope row into the account area, adds a read and a page, and turns a vote into a bookmark, which is a different feature with its own decisions (naming, ordering, and whether an upvote should mean "saved" at all).

## Rationale

**The count is derived, because a number that can drift is worse than a join.** The whole value of the feature is that the number means something. A stored counter buys a cheaper read and sells the guarantee, and the guarantee is cheap to keep here: the vote table's primary key already answers the count for one skill, and the catalogue pages 20 rows at a time under `listSkills`'s existing ceiling of 100. The moment the aggregate becomes measurable, the honest fix is a materialised view or a carefully reconciled counter with a recount, and that is a decision worth taking with real numbers in hand rather than guessing at them now.

**The pair is the identity, because the rule should be structural.** "A second upvote does not count twice" is the one rule the scope row states explicitly, and the composite primary key makes it impossible to break from any path: the server function, a future import, a manual fix, or a script. Matching the `skills` table's uuid habit would put the rule in an index beside the identity instead of in it, for a convenience nothing in this feature needs.

**The viewer aware read is the right trade at this size, taken with open eyes.** Carrying the viewer into the read means a complete card and no fan out, which is the difference between one query and twenty. It also means the catalogue is no longer a public read that everyone shares, which is why the viewer is part of the cache key rather than left out: a payload that is built for one person must never be keyed as if it belonged to everyone, or a shared browser would show one person's pressed buttons to another after a sign in. The second read for the viewer's votes was cheaper to reason about and worse to use, and the per card query was never serious.

**The write takes the state, not the flip.** With an optimistic interface the button already knows what it wants, so sending the desired state makes the operation safe to repeat and immune to a race. A toggle would have been less typing and a source of a subtle, hard to reproduce bug where a vote appears and then reverses. Two separate functions would have been clean but doubled the surface for one control.

**A toggle is the friendlier default, and the scope row survives it.** The scope row's "upvote a skill once" is really about one vote per person per skill, which the primary key holds; taking a vote back does not violate it. Against that, a permanent accidental vote has no remedy in the product at all, which is a worse experience than a count that can move down by one.

**The control stays where the scope put it.** Cards and the detail page are where a skill is judged. Adding an account list of upvoted skills would have turned a vote into a bookmark, grown the scope row, and raised questions this feature should not have to answer.

**Calls made without asking** (these are mine to make, each with the runner up I set aside):

- **The viewer id is resolved in the root route's `beforeLoad`, beside the theme read, and the viewer becomes a segment of the catalogue and detail query keys.** The key has to be known before the query runs, and the loader is the only place that knows it on the server, so this is the smallest honest mechanism and it reuses the pattern spec 0006 established. Runner up: keep shared keys and clear the whole query cache on sign in and sign out, which is less code and can show a stale vote state in the window before the clear.
- **The votes table carries a second index on (`user_id`, `skill_id`).** The viewer's own state is looked up by person and skill, which the primary key cannot serve without a scan. Runner up: rely on the primary key alone, which is fine for counts and poor for the viewer lookup.
- **The write is an insert that does nothing on conflict, or a delete that tolerates a missing row, followed by a count read in the same call.** Both directions are then idempotent by construction, and the returned count is the store's real number rather than a guess. Runner up: read the current state, then write, then read again, which has a race window between the three statements.
- **The control sits in the card's action area above the card's stretched link, the way the install button already does.** The card stays one clickable surface and no anchor nests inside an anchor. Runner up: a separate row under the card, which is simpler to place and splits the card into two competing targets.
- **One analytics event, `skill_vote_changed`, carrying the slug and the resulting state, captured only after the store confirms.** It follows the existing event names (`theme_changed`) and the existing rule that a failure records nothing. Runner up: two events, one per direction, which is more naming and no more information.
- **Votes left behind by a deleted Clerk account are left in place for now.** There is no local users table to cascade from, nothing in this feature lists voters, and a sweep job would be machinery for an invisible problem. Runner up: a cleanup job, which belongs with account deletion or moderation rather than here (recorded in Follow-up).
- **No new dependency, no new environment variable, and no change to the Clerk or database configuration.** The feature is one table, one write, and two extended reads on what the project already runs.
- **`SKILL_NOT_FOUND` is produced two ways, and neither of them races.** Going up, the foreign key refusal from the store is mapped to the code through the error chain helper the store already has; going down, the function reads the skill's existence first, which is safe because the only way that read goes stale is a skill that has just been deleted, and a deleted skill has no votes left to remove. Runner up: check the skill before both directions, which reads better and reintroduces a check then write window the store can already answer for.
- **Signing in or signing out invalidates the whole `skills` key family rather than one viewer's keys.** The header signs people in through a Clerk dialog with no navigation, so the resolved viewer in router context can stay stale until the next navigation; invalidating the family covers every viewer segment through partial matching, and the next read fills the correct one. Runner up: recompute the viewer from Clerk's reactive user on the client only, which duplicates the source of truth the server already resolved.
- **A failed session read inside a public read answers "signed out".** The catalogue and the detail page are public pages that happen to know the viewer, so a Clerk problem must degrade them rather than take them down; a payload with counts and no viewer state is still a working page. Runner up: let the failure surface as a read error, which turns a harmless identity outage into a broken home page.
- **The new count and any failure message are announced through a polite live region on the control.** The repo has no announcement mechanism today beyond the spinner's `role="status"`, and the count changes without the user's focus moving, so something has to say it out loud. Runner up: move focus to the count, which interrupts keyboard users mid flow.

**Tensions worth stating plainly.** The catalogue's markup is now produced per viewer, so a future shared cache in front of the home page has to keep the viewer in mind. The root route's `beforeLoad` now holds two small server reads, and if that pair ever becomes measurable, they should be folded into one call rather than left to grow. And a vote row is a small piece of personal data: it links a person to a skill, so the retention gap for deleted accounts is recorded rather than hand waved.

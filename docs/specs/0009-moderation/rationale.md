# Rationale: moderation (spec 0009)

## Context

The catalogue reads real skills (spec 0003, spec 0004), people can publish them (spec 0005), they have an account area (spec 0006), and upvotes and search are in flight (spec 0007, spec 0008). Every skill that reaches the catalogue stays there until its own author deletes it. Nobody else can take it down, and the author of a skill that breaks the rules cannot take it down quietly either, short of destroying it. This feature adds the missing state: a skill can be hidden from the public catalogue and brought back later.

The forces that shaped this decision:

- The store is Postgres through Drizzle, and the `skills` table holds only a Clerk user id as the author, so there is no local users table and nowhere a role could live today.
- The skills table has no notion of state at all: no archive, no draft, no review. Every row is public the moment it is written.
- Ownership is enforced inside the query's own filter (`author_id`), so a skill that is not yours is indistinguishable from one that does not exist. That rule is the account area's, and it is worth keeping.
- Two public reads serve the catalogue and the detail page, and a third read serves the account area's own list. All three go through `src/db/queries.ts`.
- Clerk already holds each person's identity and is the only place a person's record lives, and the app already reads more than the session from it (`clerkClient().users.getUser` for the overview, a batched `getUserList` for publishers).
- The design system already reserves a destructive `hidden` badge in the gallery, so the marker an author will see was anticipated before this decision.
- The project's workflow is Alpha with Tracer Bullet delivery and one engineer, so the design stays small: one column group, one write, one new surface.
- Two features are designed but not built (upvotes and search), and both touch the reads this feature narrows. The rule has to sit where they will inherit it.

> ⚠️ Premise note: two things are worth saying plainly rather than hiding in the tradeoffs. First, the admin role lives in the Clerk dashboard, not in this app: appointing a moderator means dashboard access, there is no in app grant, and there is no way for an admin to appoint another admin. For a one person learning build that is the right trade (no new table, no new UI, no new service), but it means moderation is a capability the engineer holds alone. Second, hide is a blunt instrument and it is the only one: an admin cannot correct a skill, only remove it, and there is no user facing way to report a skill at all, so this feature gives the admin a tool to use on what they happen to notice rather than a queue to work through. Reporting is deliberately left out of scope and recorded as a follow up, because it is its own decision (a table, a form, a triage surface) and folding it in here would double the size of the spec without changing the visibility model this spec is really about.

## Options considered

### Decision A: what a hidden skill is

**Option 1: A visibility column on the skill row, with the last action beside it (chosen).**
`skills.visibility` holds `published` or `hidden`, and `moderated_at`, `moderated_by`, and `moderation_reason` record the last action on that row.

- Pros: the catalogue's filter is a predicate on a column in the row it already reads, with an index to match; the author's view of their own hidden skill is the same read it always was, with three more columns; one migration, no new table, no join; the row that answers "why is this gone" is the same row that answers "is it gone".
- Cons: only the last action survives, so history is lost; the columns sit on the busiest table in the app and mostly hold nothing; a hidden skill's state is mixed into a table whose other columns are content.

**Option 2: `visibility` on the row, plus an append only moderation events table.**
Every hide and restore is a row (skill, actor, action, reason, time), and the row's visibility stays the fast truth for reads.

- Pros: a real audit trail, which is what a moderation feature normally wants; a pattern of abuse is visible; a reason can be revised without losing the earlier one; nothing about a read changes, since the state stays on the skill row.
- Cons: a second table, a second write, and a second read path for a feature whose done condition is "an authorised user can hide and restore a skill"; nothing in this scope reads the history, so it would be written and never looked at; the team is one person at Alpha rigor, where unused machinery is the thing that rots.

**Option 3: A `hidden_at` timestamp only.**
The presence of a timestamp means hidden, and its absence means published.

- Pros: one nullable column, the smallest possible change; the flag and the time are the same value, so they cannot disagree; restoring is a null assignment.
- Cons: no actor and no reason, so the author is told their skill is gone and nothing about why; the author cannot be told whether they may restore it themselves, because the rule depends on who hid it; a partial hide (a reason with no time) is representable, which a check constraint should prevent.

### Decision B: where the admin role lives

**Option 1: Clerk public metadata, read on the server (chosen).**
The person's Clerk record carries a role, read with the Clerk users API when a request needs the answer.

- Pros: Clerk is already the one place identity lives, so no local users table appears and no second source of identity is created; the role is data on the same record the app already reads for names and photos; a change takes effect on the next request rather than waiting for a session token to refresh; the check is a server read, so no browser value can claim it.
- Cons: the grant needs the Clerk dashboard, since nothing in this app writes the metadata; an admin request pays a Clerk lookup, which a cached read softens but does not remove; the role is invisible in the project's own store, so a reader of the database cannot see who is an admin.

**Option 2: An environment variable holding the admin user ids.**
An `ADMIN_USER_IDS` value in `.env.local` lists the Clerk ids that may moderate.

- Pros: no dashboard work, no API call, no cache, and the grant is visible in one file; comparing an id against a list is trivial to test.
- Cons: changing who is an admin needs a new deployment; the list is invisible to anyone without the deployment config; a secret shaped value holding identity data is easy to leak into a log or a client bundle; and it makes the role a deployment concern rather than a data one.

**Option 3: A local moderators table keyed by Clerk user id.**
A small table in the project's own store grants the role.

- Pros: the grant is in the store the app already queries, so it can be granted from a seed, a script, or a future admin page; it can carry a granted by and a granted at; it does not depend on a Clerk API call.
- Cons: it duplicates identity into a second place, and the project has deliberately kept people out of its own store; it is a table, a migration, and a read for a role that one person holds; deleting a Clerk account leaves an orphan grant.

**Option 4: Clerk Organizations, with an organisation admin role.**
Each moderator is a member of a Clerk organisation with the admin role.

- Pros: real role management with members, invitations, and roles, handled by Clerk; multiple moderators scale without new code; the role vocabulary is standard.
- Cons: it introduces a whole organisation concept the product does not have, and every future question (does a skill belong to an organisation? is the catalogue scoped per organisation?) then has to be answered; it is the heaviest possible mechanism for a single admin flag.

### Decision C: how much a restore may undo

**Option 1: An author may restore only a hide they made themselves (chosen).**
An admin can always restore; an author may restore while `moderated_by` is that same author.

- Pros: hiding by an admin actually holds, which is the whole point of the feature; the modest, honest author case still works, since an author who hid their own draft can bring it back alone; the rule is one column comparison with the session id, so it is cheap and testable.
- Cons: an author who genuinely fixed the problem must ask an admin, so an admin is on the critical path for the common case; the author's card cannot offer a restore control in that case, so it has to explain why not; it makes `moderated_by` load bearing rather than informational.

**Option 2: An author may always restore their own skill.**
Hiding is never final for the person who published it.

- Pros: the simplest rule, and the friendliest to authors; no dependence on who hid it; one fewer branch and one fewer failure code.
- Cons: moderation becomes advisory. An admin hides a spam listing and its author restores it in one click, with nothing an admin can do short of deleting the skill, which this feature deliberately does not offer. The feature would then not achieve its own done condition.

**Option 3: Only admins may restore, always.**
An author may hide their own skill but never bring it back.

- Pros: one rule for everyone, no dependence on who acted; an author cannot undo anything, so the state is unambiguous.
- Cons: an author who hides their own skill to fix it cannot bring it back without asking, which is a poor deal for a self inflicted, harmless state; it pushes routine traffic onto the admin.

### Decision D: where the controls live

**Option 1: An admin area for every skill, and controls on the author's own card (chosen).**
A guarded `/admin/skills` page lists every skill with its state and a control, and the account area's managed card carries the author's own hide and restore.

- Pros: each person acts in the place that already exists for that job: the author manages their skills where they edit and delete them, and the admin reviews where a list of every skill belongs; the public pages stay untouched and uncluttered; the admin list is the only place that needs paging and a filter, and it is behind a guard.
- Cons: two surfaces to build, and the hide dialog has to be shared between them so the two do not drift; the admin list is a new page and a new route in a slice that could have been smaller.

**Option 2: The account card plus a control on every public skill page for admins.**
An admin moderates while reading the catalogue, where the problem was found.

- Pros: the admin acts exactly where they noticed the problem; no separate list to build; the control is naturally scoped to one skill.
- Cons: the public detail read becomes viewer aware for a role rather than for the viewer's own content, which is a bigger change to the most cached page in the app; the same page then renders two very different experiences; there is still no place to see every skill's state, so a restore is hard to find.

**Option 3: The admin area only.**
Owners ask an admin to hide their own skill.

- Pros: one surface, one dialog, one code path; the guard and the read are the only new things.
- Cons: it contradicts the scope row, which puts the owner and the admin on equal footing; it makes hiding your own work a request rather than an action, while deleting your own work is already an action.

### Decision E: how much the reason is obliged to be

**Option 1: Optional, recorded, and shown to the author (chosen).**
The hide dialog offers a reason of at most 200 characters, and the author's card shows it with who and when.

- Pros: the author learns why without the admin being blocked on writing prose for obvious spam; the record exists when it matters; the field is a label and a textarea, no new primitive.
- Cons: the common case may leave the field empty, so the author's card often shows who and when with nothing else; the length ceiling is a rule to enforce in two places (the form and the store).

**Option 2: Required.**
A hide cannot be applied without a reason.

- Pros: every hidden skill carries an explanation, so the author is never left guessing; it nudges the moderator to think about the rule that was broken.
- Cons: friction on the clearest cases, which is where speed matters; a person writing filler text produces a worse record than an empty field; it adds a field level error to a dialog that is otherwise a single action.

**Option 3: None.**
Hidden or published is the whole story.

- Pros: the smallest interface and the smallest record; nothing to validate, nothing to render; no risk of the reason becoming a place to write something unpleasant.
- Cons: the author sees their skill marked hidden with no explanation, which invites a support conversation the record could have avoided; the actor and the time are still needed for the restore rule, so a record exists anyway and the cheapest part of it is skipped.

## Rationale

The visibility column wins on the force that matters most here: the author needs to see their hidden skill. That read already exists, and putting the state and the last action on the same row means the author's list gains three columns and one badge instead of a join and a second read path. An events table is the better design for a product where moderation is contested and audited; this product has one moderator, one author, and a done condition that asks for hide and restore, so the history would be written and never read. The audit trail is recorded as a follow up rather than built, which is the honest ordering.

The role in Clerk public metadata wins because Clerk is already the identity source and the project has already decided twice not to keep people in its own store: the author id is a bare Clerk id, and the overview and the publisher names are read from Clerk. Adding a moderators table would be the first local copy of a person, and the first thing that copy would need is a rule for what happens when that person's Clerk account goes away. The environment variable is the smaller option and the one to reach for if a role ever has to be granted without dashboard access, but it turns a data question into a deployment, which is the wrong shape for a grant that should change in seconds. Organizations are the right answer to a different question, namely a product where a group owns a set of skills. Two details matter more than the choice itself: the role is read from Clerk's public metadata, never from the metadata field Clerk lets the browser write, because that field would hand out admin to anyone who edits it from the client; and the read is settled once per request rather than cached with a time to live, because a cache with a time to live would keep a demoted admin writing until it expired, which contradicts the promise that a change lands on the next request.

The restore rule is the part of this feature that decides whether it does anything at all. An author who can undo an admin's hide is not moderated, and the feature would ship a state that never holds. Keeping the author able to undo their own hide costs one comparison against `moderated_by` and keeps the harmless case self service, so the rule is narrow rather than punitive. That comparison is the reason the actor is stored at all, which is why the actor column is not optional in this design even though the reason is. Two things about the rule are worth stating because a build would otherwise get them wrong. The comparison belongs in the filter of the statement that performs the change, judged by the rows the statement reports as changed, rather than in a read taken just before the write: an admin's hide that lands in that gap would otherwise be undone by an author's restore that was already decided. And the write has to settle who is calling before it decides whether anything needs to change, because a check that answers "the state is already what you asked for" reveals that a slug exists, which is exactly what the ownership rule is there to prevent.

The surfaces follow the ownership rule the account area already set: act where the thing is yours, review where the whole set is. The public detail page was the tempting third option, and it loses because it makes the app's most cached, most public read viewer aware for a role, which is a large change to the busiest page for a small convenience.

The reason stays optional because the record's job is to answer a question the author will ask, and the answer is often "because it was spam". Who and when are recorded regardless, so the optional field is the only part that can be empty, and an empty field beats a field filled with a single letter to satisfy a form.

Three smaller calls were made without asking, because they are consequences of the decisions above rather than choices of their own. A restore clears the reason, since a reason describes the hide it was written for; the actor and the time stay, so a restored row still says who brought it back and when. The event is captured only when the state actually changed and from one shared client path, so a retried call cannot double count and the two surfaces cannot drift; that means the write reports whether it changed anything rather than the client guessing. And the hide dialog is one component used by both surfaces, because the author's reason and the admin's reason are the same field with the same rule, and two copies of it would be two places for the rule to rot.

## Present state of the code (evidence for this decision)

Checked while writing this spec:

- `src/db/schema.ts` holds one table, `skills`, with `author_id` as a nullable text Clerk id, a unique index on `slug`, two ordering indexes, and check constraints for the slug, the lengths, and the timestamp order. There is no state column, no archive, and no second table beyond the upvote work in flight.
- `src/db/queries.ts` holds every read and write: `listSkillRows` (the shared catalogue list query, paged newest first), `findSkillBySlug` (the detail read), `findSkillRowForAuthor`, `updateSkillRow`, and `deleteSkillRow` (all filtering on `author_id` inside the where clause), plus the author list and count the account area uses.
- `src/features/skills/data.ts` holds the public server functions (`listSkills`, `listSkillCards`, `getSkillDetail`), the write (`createSkill`), the session guard helper in `auth.ts`, and the batched Clerk publisher read (`loadAuthors`).
- `src/features/account/data.ts` reads the Clerk user directly (`clerkClient().users.getUser`) for the overview, which is the precedent for reading a role from the same record.
- A search across `src` for admin, moderator, role, or permission concepts finds none: the only matches are `aria-hidden`, `overflow-hidden`, and the design gallery's reserved `hidden` badge in `src/routes/design.tsx`.
- `src/components/ui/` holds button, card, badge (with a destructive variant), alert, alert-dialog, avatar, separator, skeleton, empty, and spinner, so the hide confirmation dialog needs no new primitive.
- `drizzle/` holds two migrations applied by `npm run db:migrate`, so the column group lands as `0002`.
- Analytics events are captured in route components (`sign_in_started`, `sign_up_started`, `theme_changed`), so the event this feature captures follows the same shape and place.

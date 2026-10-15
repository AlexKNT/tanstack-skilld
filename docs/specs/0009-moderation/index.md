# 0009. Let an owner or an admin hide a skill, and keep hidden skills out of the public catalogue

**Date**: 2026-10-13
**Status**: In Progress

## Summary

Today a skill that breaks the rules can only be deleted by its own author, so there is no way to take one off the public catalogue. This decides how a skill is hidden and who may do it: a skill carries a visibility value (published or hidden), its author may hide and restore it, and an admin, recognised by a role held on the person's Clerk record, may hide any skill and is the only one who can undo a hide they made. A hidden skill leaves the catalogue, its own page answers not found, and its author still sees it in their own area with a badge and the reason it was hidden.

## Requirements

**User stories**:
- As the person running Skild, I want to take a rule breaking skill off the catalogue, so that visitors no longer find it.
- As an author, I want to hide my own skill and bring it back, so that I control my own listing.
- As an author whose skill was hidden, I want to see it marked hidden with the reason in my own area, so that I know why it went and what to do next.
- As an admin, I want one page listing every skill with its state and a hide or restore control, so that review and restore happen in the same place.
- As a visitor, I want a hidden skill gone from the catalogue and from its own page, so that hiding actually removes it from view.
- As the engineer, I want the state on the row the catalogue already reads, so that hiding costs the public reads nothing new to run.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The `skills` table gains a required `visibility` column (text, default `published`, one of `published` or `hidden` enforced by a check constraint), a nullable `moderated_at` (timestamp with time zone), a nullable `moderated_by` (text, the Clerk user id of whoever acted last), and a nullable `moderation_reason` (text, trimmed, 1 to 200 characters when it is present, enforced by a check constraint), plus one index on (`visibility`, `created_at` descending, `id` descending). One migration adds all of it, `npm run db:migrate` applies it, every row that already exists keeps its id and reads as published, and running the migration a second time changes nothing.
- **AC-2**: One server function changes visibility, and it takes the skill's slug, the visibility to reach, and an optional reason. It decides who is calling and what they may do before it looks at the skill's current state, so a no-op answer can never tell a stranger whether a slug exists. Asking for the visibility a skill already holds then succeeds, reports that nothing changed, and writes no column, so a repeated or retried call cannot change who moderated it, when, or why (idempotent).
- **AC-3**: The session is the only source of the actor: an anonymous caller receives `UNAUTHENTICATED`, `moderated_by` is the session user id read on the server, and no value supplied by the browser may name an actor.
- **AC-4**: Who may act is decided inside the write: the skill's author, or an admin. Anyone else receives `SKILL_NOT_FOUND`, exactly what a slug that is not stored receives, so a skill that is not yours is never confirmed to exist.
- **AC-5**: An author may hide their own skill and restore it only while the current hide was their own (`moderated_by` equal to the session user id). The rule is decided inside the statement that performs the change, whose filter requires the row to be hidden and the actor to be a session user who is either that hide's actor or an admin, and is read from the rows the statement reports as changed. An admin's hide that lands first therefore cannot be undone by an author's restore that was decided a moment earlier. An author's restore that the filter refuses answers `NOT_ALLOWED` with a message saying an admin must restore it, and the skill stays hidden.
- **AC-6**: An admin may hide any skill and restore any skill, including one they hid themselves, through the same write, the same optional reason, and the same rules.
- **AC-7**: A fresh public catalogue read returns published skills only: a hidden skill is absent from the first page and every page after it, and holds no slot in any page, so it never shifts another skill's position. Its absence leaves the page size of 20, the newest first order, the one extra row rule that decides `hasMore`, and the card shape exactly as they are.
- **AC-8**: Hiding removes nothing but visibility: a hidden skill keeps its slug and every other row it owns, so restoring it brings back the same skill, at the same address, with whatever a later feature hangs off it (its upvotes when the upvote feature has landed, its tags when the tag feature has landed).
- **AC-9**: The visibility rule is applied in the one shared store list query rather than in a caller, so the catalogue read and any later caller of that query (the filtered read of another spec) exclude hidden skills by construction.
- **AC-10**: The public detail read answers `SKILL_NOT_FOUND` for a hidden skill, the same answer a slug that is not stored gets, so the detail route renders its existing not found surface and no hidden skill's content reaches HTML.
- **AC-11**: The account area's own skill list returns an author's skills whatever their visibility, and each hidden row carries its visibility, the reason, who hid it (resolved to a name), and when, so an author learns why it went without leaving the app. A moderator id that Clerk does not resolve is shown under one neutral label rather than failing the row.
- **AC-12**: The account overview reports a published count and a hidden count separately, so the count the overview has always shown keeps meaning published.
- **AC-13**: An author's own skill card offers a hide control that opens a confirmation dialog naming the skill, with an optional reason of at most 200 characters; confirming applies the hide, cancelling changes nothing, and no hide control is offered on a skill that is already hidden. The dialog is the same component the admin area uses, so the two surfaces cannot drift.
- **AC-14**: A hidden skill's card offers a restore control only while the current hide was the viewer's own; when someone else hid it, the card states that an admin must restore it and offers no control.
- **AC-15**: Editing a skill that is hidden saves the edit and leaves the skill hidden, and the edit surface states that it is hidden, so an edit is never a way back into the catalogue.
- **AC-16**: The admin area is the route `/admin/skills`, guarded on the server: a signed out visitor is sent to sign in and returned to that path, a signed in visitor without the admin role receives the app's not found surface, and the read behind the page refuses a caller without the role with `NOT_ALLOWED` when it is called directly.
- **AC-17**: The admin list read is paged with the same page size, offset paging, newest first order, and one extra row rule as the catalogue, and returns every skill whatever its visibility, each row carrying the skill, its publisher, its visibility, and its last moderation action where there is one: a hidden row shows who hid it, when, and why, and a restored row shows who restored it and when, with no reason from the earlier hide. It accepts an optional visibility filter whose value is validated in the route's search validator against the two stored values and dropped when it does not match, so an unreadable value never reaches the store and the page renders from the address alone. A first load that fails renders the same read error surface the catalogue already has.
- **AC-18**: The admin role is read on the server from the signed in person's Clerk public metadata, never from a value the browser supplies and never from the metadata field Clerk lets the browser write, and it is settled once per request rather than cached with a time to live, so a role change lands on the next request.
- **AC-19**: After a hide or a restore, the reads the acting person can be shown as stale are settled before the interface navigates: the catalogue's pages, the detail key for that slug, the account list and overview keys, and the admin list keys, so the acting person sees a hidden skill gone and a restored one back. These keys come from one key factory per surface, invalidated by prefix.
- **AC-20**: Every hide and restore that changed the state captures exactly one PostHog event named `skill_visibility_changed`, carrying the skill's slug, the visibility reached, whether the actor was the author or an admin (an admin hiding their own skill counts as the author), and whether a reason was given. It is captured only after the store confirms the change, in one shared client path both surfaces use, so a no-op or a retried call captures nothing and no surface can capture twice.
- **AC-21**: A refusal never reaches the interface as a thrown error: a payload that breaks the rules answers `VALIDATION_FAILED` naming the field, a slug that is not stored answers `SKILL_NOT_FOUND`, a store failure answers `SKILLS_WRITE_FAILED`, and the interface keeps its previous state and shows the message in a polite live region (a container assistive technology reads out when its text changes). Every message comes from one exported map of code to wording that both surfaces read, so the same refusal never reads two ways.
- **AC-22**: The controls and the dialog are accessible: each control is a real button whose accessible name carries the action and the skill, the dialog is operable and dismissible from the keyboard and returns focus to the control that opened it, a row's state is readable as text rather than by colour alone, and both surfaces hold together at 320px.

## Decision

**Chosen option**: One `visibility` column on `skills` with the last moderation action beside it, an admin role held in Clerk public metadata and read on the server, an author who may undo only their own hide, controls in an admin area and on the author's own card, and an optional reason that reaches the author.

A skill carries its own visibility, so the catalogue's only change is a predicate on a column it was already reading. The one write takes the state to reach rather than a direction, so a repeated or raced call lands on one honest state. The actor, the time, and the reason of the last action sit on the same row, which is what lets an author see who hid their skill and why without a second table. The column is named `visibility` rather than `status`, because the workflow files already use status for a feature's lifecycle and one word should mean one thing.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**:

One table changes, `skills` (spec 0003). No new table.

| Column | Type | Rules |
|---|---|---|
| `visibility` | text | required, default `published`, one of `published` or `hidden` (check constraint) |
| `moderated_at` | timestamp with time zone | nullable, the time of the last hide or restore |
| `moderated_by` | text | nullable, the Clerk user id of whoever acted last; there is still no local users table to point at |
| `moderation_reason` | text | nullable, trimmed, 1 to 200 characters when present (check constraint) |

Index: `skills_visibility_created_idx` on (`visibility`, `created_at` descending, `id` descending). The catalogue's public branch reads the `published` prefix of it, and the admin list's filter reads either value, so both lists stay covered by an index.

**State transitions**:

Two states, `published` and `hidden`, with two transitions and no others:

- `published` becomes `hidden`: an author acts on their own skill, or an admin acts on anyone's. The actor, the time, and the reason are written with it.
- `hidden` becomes `published`: an admin always, or the author when `moderated_by` is that same author. This transition clears the reason and records who restored it and when.

Asking for the state the skill already holds is not a transition: nothing is written, so the actor, the time, and the reason of the last real action survive a repeat. The write decides who is calling, and what they may do, before it compares the wanted state with the current one, so the no-op answer cannot be used to ask whether a slug exists.

**API surface**:

Every entry is a TanStack Start server function (a typed server side function the browser calls as if it were local).

| Action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `setSkillVisibility` | POST | `slug`: string (req), `visibility`: `published` or `hidden` (req), `reason`: string, at most 200 chars (opt) | `slug`, `visibility`, `changed` (whether anything was written), `moderatedAt`, `moderatedBy`, `reason` | session; the skill's author, or an admin | `UNAUTHENTICATED`, `NOT_ALLOWED`, `SKILL_NOT_FOUND`, `VALIDATION_FAILED`, `SKILLS_WRITE_FAILED` |
| `listSkillsForModeration` | GET | `limit` (opt), `offset` (opt), `visibility`: `published` or `hidden` (opt) | `items` (skill, publisher, visibility, moderatedBy, moderatedAt, reason), `hasMore` | session with the admin role | `UNAUTHENTICATED`, `NOT_ALLOWED`, `VALIDATION_FAILED`, `SKILLS_QUERY_FAILED` |
| `listSkillCards`, `listSkills` (changed) | GET | `limit` (opt), `offset` (opt), unchanged | unchanged shape; published skills only | public | unchanged |
| `getSkillDetail` (changed) | GET | `slug` | `SKILL_NOT_FOUND` when the skill is hidden | public | unchanged, plus a hidden skill answering not found |
| the account area's own list read (changed) | GET | `limit` (opt), `offset` (opt), unchanged | each row also carries `visibility`, `reason`, `moderatedBy`, `moderatedAt` | session | unchanged |
| `getAccountOverview` (changed) | GET | none | `skillCount` (published) and `hiddenSkillCount` | session | unchanged |

Two store statements sit behind the one write rather than one statement with a widened filter, because the account area's author filtered write can never reach another person's row: one statement acts on a row whose `author_id` is the session user, and one acts on any row by slug, chosen by the role the write read. The authority rule (AC-5) lives in the filter of whichever statement runs, so the answer comes from the rows the statement reports as changed rather than from a read taken before it.

**Value sourcing** (every value each action produces, and where it comes from):

| Action | Value produced / displayed | Source |
|---|---|---|
| `setSkillVisibility` | the visibility reached | the validated input param, restricted to the two stored values |
| | the actor id, written to `moderated_by` | the Clerk session user id, read on the server inside the function |
| | the time, written to `moderated_at` | the database's clock at write time, not a value the browser sends |
| | the reason, written to `moderation_reason` | the optional input, trimmed, stored as `null` when empty |
| | whether the caller is an admin | the signed in person's Clerk public metadata, read on the server |
| | whether anything changed | the rows the update statement reports as changed |
| | the refusal when an author tries to undo another person's hide | the filter of the statement that ran, judged from the rows it reported as changed |
| | whether the actor was the author or an admin (analytics) | derived in the write from the two checks it already made; a person who is both counts as the author |
| | whether the event is captured at all | the `changed` flag the write returns; a no-op captures nothing |
| the catalogue read | which skills appear | the `skills.visibility` column |
| the detail read | a hidden skill answering not found | the `skills.visibility` column |
| the account list | the hidden badge, the reason, who hid it, when | `skills.visibility`, `skills.moderation_reason`, `skills.moderated_by` resolved to a display name through the existing batched Clerk author read in `src/features/skills/data.ts`, and `skills.moderated_at` |
| the account list and the admin list | the name of an actor Clerk does not resolve | one neutral label defined in the moderation area, so a missing id never fails a row |
| the account overview | the published count and the hidden count | a `count(*)` over the author's rows, grouped by `skills.visibility` |
| the admin list | each row's skill, publisher, and state | the store read plus the same batched Clerk author read, over the union of the publisher ids and the moderator ids on the page; the state from `skills.visibility`, the last action from the three moderation columns |
| the admin list | which rows appear | the `visibility` value validated in the route's search validator, with no match treated as no filter |
| every refusal | the message a person sees | one exported map of failure code to wording, read by both surfaces |

**Key invariants**:
- A skill's `visibility` is one of the two values, and the database refuses anything else.
- A hidden skill never appears in a fresh public read: not in the catalogue, not in its own page, and not in any later caller of the shared list query.
- The write settles who is calling, and what they may do, before it compares the wanted state with the current one.
- The restore authority rule lives in the filter of the statement that performs the change, so it cannot be beaten by an action that landed in between.
- `moderated_by` is always a server read session id; no browser value names an actor.
- A reason is stored trimmed, is at most 200 characters, and is `null` when none was given and after a restore.
- Asking for the state a skill already holds changes no column.
- An author can never restore a hide that was not their own.
- An edit never changes visibility.

**Security model**:
- Public: the catalogue and a skill's page, which now return published skills only.
- Session: publishing, editing, and deleting your own skill (all existing), and hiding and restoring your own skill.
- Admin (the person's Clerk public metadata carries the admin role): hide and restore any skill, and read the admin list.
- Ownership is enforced in the filter of the statement that runs, as the account area already does, so a skill that is not yours answers exactly as a missing one. The admin path is a separate statement selected by the role the server read, never a widened filter and never a flag the browser sends.
- The role comes from Clerk's public metadata. Clerk's unsafe metadata is writable from the browser, so it is never read for this, and the role is settled once per request rather than cached with a time to live, so a removed role stops working on the next request.
- No regulated data is involved: no payments, no health data, and no new personal data beyond the actor id that already exists as an author id.

**Configuration required**:
- No new environment variables and no new dependency. One prerequisite: at least one person's Clerk record must carry the role in its public metadata (`role` set to `admin`) in the Clerk dashboard before the admin area can be reached. Granting or removing the role is a dashboard action, since nothing in this app writes it.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: an author hides their own skill, it leaves the catalogue, its page answers not found, and a restore brings it back at the same address, verifies **AC-2**, **AC-5**, **AC-7**, **AC-10**, **AC-14**, **AC-19**
- Failure case: a repeated call asking for the visibility the skill already holds writes nothing and reports no change, an admin's hide that lands while an author's restore is in flight leaves the skill hidden, and a store failure leaves the page on its previous state with a message, verifies **AC-2**, **AC-5**, **AC-20**, **AC-21**
- Auth/permission: a stranger's write answers `SKILL_NOT_FOUND` whether or not the slug exists and whatever state is asked for, an author restoring an admin's hide answers `NOT_ALLOWED` and the skill stays hidden, and a non admin's call to the admin read answers `NOT_ALLOWED`, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-16**

## Build plan

Ordered for this project's build approach, Tracer Bullet (prove the thinnest thread end to end before thickening it), so the migration, the write, the author check, and one working control land before the admin role, the second surface, and the polish.

1. [x] The store: add the migration for the four columns and the index, and the visibility write in `src/db/queries.ts` as two statements (one for a row the session user authored, one for any row by slug, chosen by the role), each with the authority rule in its own filter and the answer read from the rows it reports as changed. The write leaves the previous action's actor, time, and reason alone when the state does not change, and clears the reason when it restores. All of it returns the project's `Result` shape, and it is applied to a hosted Postgres with `npm run db:migrate`, satisfies **AC-1**, **AC-2**, **AC-5**, **AC-8**, **AC-9**
2. [x] Close the public reads: filter the shared list query to published, and let a hidden skill answer the detail read exactly as a slug that is not stored does, satisfies **AC-7**, **AC-9**, **AC-10**
3. [x] Thin thread end to end: add `setSkillVisibility` to `src/features/skills/data.ts` with the author check read from the session, one hide control on a card inside the account area, and the settling of the catalogue and detail keys so the thread is proved against fresh reads rather than a stale page, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-13**, **AC-19**
4. [x] The admin role: a server helper that reads the role from the person's Clerk public metadata, settled once per request, and the admin branch of the write, so an admin can hide and restore any skill, satisfies **AC-6**, **AC-18**
5. [x] The admin area: the `/admin/skills` route with its guarded `beforeLoad`, the visibility filter in its search validator, the paged admin read, and the row with its state and control, satisfies **AC-16**, **AC-17**
6. [x] The author's surfaces: the hidden badge with the reason, the actor, and the time on the managed card, the neutral label for an unresolvable actor, the published and hidden counts on the overview, the restore control rules, and the hidden state on the edit form, satisfies **AC-11**, **AC-12**, **AC-14**, **AC-15**
7. [x] The dialog, the states, and the announcements: the hide dialog shared by both surfaces with its optional reason and its 200 character limit, the failure copy from the one message map, the announced failure and the focus returned to the control, and the 320px pass on both surfaces, satisfies **AC-13**, **AC-21**, **AC-22**
8. [x] Cache settling and the event: the key factories and the invalidation of the catalogue, detail, account, and admin keys after a change, and the one `skill_visibility_changed` event captured in a shared client path after the store confirms a change, satisfies **AC-19**, **AC-20**
9. Verify: `/check verify moderation`, including a forged call to both server functions, a no-op repeat, a second run of the migration, and the accessibility walk in both themes, satisfies **AC-1** through **AC-22**

## Consequences

**Positive**:
- A hidden skill leaves every public surface at once, because the rule sits in the one store read the catalogue already uses rather than in each page.
- No new service, dependency, environment variable, or table arrives: the role reuses identity Clerk already holds, and the state reuses the row the catalogue was already reading.
- Soft hiding rather than deleting means a mistaken hide is reversible and an author's work is not destroyed, which deletion by an admin could never promise.
- The author keeps a window on their own hidden skill, with the reason, so hiding is a conversation rather than a disappearance.
- The admin list is the first place in the app that shows every skill and who published it, which is useful beyond hiding.

**Negative / tradeoffs**:
- Granting moderation needs the Clerk dashboard, so there is no in app way to appoint or remove an admin, and every admin request pays one Clerk lookup that an ordinary request does not.
- Hide is the only tool an admin has over someone else's skill. A skill with a broken link can be hidden but not corrected, and a hidden skill cannot be previewed at its own address even by its author, so fixing and checking content needs a restore in between.
- A hidden skill disappears for the person who acted, not for everyone at once. Another visitor whose browser already holds the catalogue in cache keeps seeing the skill until their own stale period passes (30 seconds) or they reload, because the server cannot reach into a cache it does not own. The reader who hid it gets a fresh view immediately.
- The catalogue read now carries a predicate that can only get narrower, and the state column becomes load bearing for later features (the sitemap must exclude hidden skills, and the tag counts must not count them).
- Only the last moderation action is recorded. A skill hidden, restored, and hidden again keeps one actor, one time, and one reason, and a restore clears the reason, so a pattern of abuse leaves no trace.
- The admin area is the first surface whose mere existence is hidden from non admins, so a person who believes they are an admin sees the app's not found page with no explanation.
- Two hides that land at the same moment both succeed, and the later one wins on the actor and the reason. The authority filter keeps that safe from an author's restore, but the record still holds only the last action.

**Neutral**:
- One migration, forward only, adding columns with a default and an index: no backfill, and no existing row touched.
- `visibility` sits beside the existing `skills` checks, so an import written by hand obeys the same rules as the app.
- A hidden skill keeps its slug, so a restored skill returns to the address people may already have linked.
- A restore keeps who and when but clears the reason, because a reason describes the hide it was written for and not the state after someone undid it.
- Two statements rather than one sit behind the single write, since the account area's author filtered write can never reach another person's row. Both return the same shape, so the caller cannot tell which one ran.
- The account overview's existing count keeps its name and keeps meaning published, and a second field carries the hidden count.
- The admin list reuses the catalogue's page size, offset paging, and card styling, so no new design primitive is introduced beyond the dialog the project already has.

## Follow-up

- [ ] The site metadata and sitemap feature (scope feature 8) must leave hidden skills out of the sitemap and give a hidden page nothing indexable. The visibility rule must reach it.
- [ ] The catalogue search and filter (spec 0008) needs the same rule in the two places that do not go through the shared list query: the tag counts, and the stored search document if it is materialised. Confirm both when that feature is built.
- [ ] If hide and restore history is ever wanted (a pattern of abuse, a dispute), that is a moderation events table added beside the current state, not a change to these columns.
- [ ] A user facing way to report a skill is deliberately out of scope, and it is the honest gap in this feature: an admin can only act on what they happen to notice. Worth its own decision if the catalogue grows.
- [ ] `src/features/moderation/AGENTS.md` should carry the visibility rule, the role's home in Clerk, and the restore authority rule once the area exists, with a pointer line added to the root `AGENTS.md` context list.
- [ ] The account area's `AGENTS.md` ownership section should gain one line: an author may restore only a hide they made themselves.
- [ ] The Agent Skills and MCP discovery offer was skipped because this feature chooses no new tool: it reuses the store, the server functions, the Clerk session and role, and TanStack Query exactly as the earlier specs left them.

## Rationale

Reasoning, the options weighed, and the calls made without asking: see [rationale.md](rationale.md).

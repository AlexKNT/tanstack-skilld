# 0006. Give signed in users an account area with their own skills, profile, and theme

**Date**: 2026-10-02
**Status**: Accepted

## Summary

This decision adds the signed in area: a group of four pages under `/account` (an overview, your skills, your profile, and settings), sharing one nested layout and guarded on the server so a signed out request never receives the area's HTML. It also lets an author manage what they published (edit it, or delete it for good) and finally turns on the theme switcher (light, dark, or match your device) that the design system left for a later feature.

Almost all of the storage work is already done. The `skills` table already holds an `author_id`, and the publish flow already owns the field rules, so this feature adds one small migration (an index and a rule that refreshes `updated_at`), five server functions, four routes, and one new UI primitive. The profile page writes to Clerk rather than to our database, because Clerk already holds each person's name, photo, and email.

The tradeoff is size: this is a wide slice, and it is the first feature that touches the shared header and the root document, so a mistake in the theme work would reach every page.

## Requirements

**User stories**:
- As a signed in user, I want a home for my account so that the product has somewhere that is mine rather than only a public catalogue.
- As an author, I want to see the skills I published so that I can find and manage them.
- As an author, I want to correct or remove a skill I published so that the catalogue stays honest.
- As a signed in user, I want to manage my name, photo, and email so that my identity is current without leaving the app.
- As a visitor, I want to choose light or dark so that the product suits the room I am in.
- As a signed out visitor, I want to be sent to sign in and returned to where I was headed so that the guard feels like one flow.
- As the engineer, I want one guarded layout and one set of field rules so that later slices (upvotes, moderation) inherit them instead of repeating them.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The area lives at `/account`, with an overview at `/account`, the skill list at `/account/skills`, the profile at `/account/profile`, and settings at `/account/settings`. All four render under one nested layout that provides a sidebar navigation (vertical links to the four pages, folding to a row of links at small widths) and the shared site header, and each page has exactly one `h1` with a heading order that never skips a level.
- **AC-2**: Every route under `/account` is guarded on the server. A signed out request is redirected to `/sign-in/$` before any area HTML is produced, the guard carries the originally requested path (pathname plus query string) as the return path, and `src/routes/sign-in.$.tsx` hands that path to Clerk so the user lands back in the area after signing in. The check is a server function calling Clerk's `auth()`, never a direct call inside `beforeLoad` (which also runs in the browser), and the return path is validated as an in app path before it is used.
- **AC-3**: A signed in user reaches the area from a visible header link, shown only while signed in. The header also carries a theme control, available to every visitor whether signed in or not.
- **AC-4**: `/account` shows the signed in user's identity from Clerk (avatar, full name, primary email address, and the date they joined), the number of skills they have published, and links to the other three pages. The count comes from our database, the identity from Clerk, and neither is guessed on the client.
- **AC-5**: `/account/skills` lists only the signed in user's own skills, most recently updated first, as management cards showing the name, the summary, and the date it was last updated, each linking to its edit page and to its public detail page. The list pages 20 at a time with a Load more control that hides once the end is reached, matching the catalogue's existing pattern.
- **AC-6**: An author with no skills sees the `Empty` state on `/account/skills` with a call to action that leads to `/skills/new`, never a blank page.
- **AC-7**: A read failure on any area page renders the `Alert` surface with the returned message and a retry, and a loading state renders `Skeleton` placeholders in the shape of the content, consistent with the catalogue. No area page ever shows a blank surface or a raw error.
- **AC-8**: `/account/skills/$slug/edit` renders the four fields (name, summary, description, install URL) prefilled from the stored skill, inside one `Card`, with the same labels, hints, and validation rules as publishing, and one `h1`. A `SKILL_NOT_FOUND` result from the read renders the router's `notFound()` surface with a `notFoundComponent`, matching the public detail page.
- **AC-9**: Saving a valid edit writes through a new server function that reads the Clerk session, confirms the skill belongs to the caller, reuses the publishing field rules, updates only those four fields, and leaves the slug unchanged. The database refreshes `updated_at` on every update through a trigger, so the stored value advances even for a writer that is not this app.
- **AC-10**: After a successful save the area invalidates the affected queries (the detail key for that slug, the area's list and overview keys, and the catalogue cards) and navigates to the public detail page `/skills/<slug>`, which now shows an edited date line (`Edited 20 Sept 2026`) when `updated_at` is later than `created_at`, formatted with the date helper spec 0004 built.
- **AC-11**: A failed edit keeps the typed values. A validation failure renders its message under the offending input with `aria-invalid` set and the message region announced; a store failure shows the `Alert` with a retry; and a save that returns unauthenticated shows an inline `Sign in` button (calling Clerk's `openSignIn()`) with the copy `Sign in to save your changes`, leaving what they typed on screen.
- **AC-12**: The edit form warns before leaving with unsaved changes on in app navigation, so a half written edit is not lost silently.
- **AC-13**: The edit page offers a delete action that opens a modal confirmation (shadcn's `AlertDialog`, focus trapped inside and dismissible). Confirming deletes the row for good, invalidates the detail key for that slug and the catalogue cards, and returns the user to `/account/skills` with an inline `Skill deleted` message carried by a `?deleted=<slug>` search param so it survives the navigation; the deleted skill's public detail page then answers 404.
- **AC-14**: Only the owner can read a skill for editing, update it, or delete it. A signed in user asking for another author's skill, whether by URL or by a crafted write, receives the same answer a missing skill gets (not found), never a distinct "not yours" reason, and never a write. Ownership is decided from the session user id, never from a value the client sends.
- **AC-15**: `/account/profile` lets the signed in user change their first name, last name, and photo, and change their email address: enter the new address, receive a code, verify it, then make the verified address primary in a separate step. Every write goes through Clerk's client SDK. A wrong code, an expired code, and an address already in use each render a message tied to the input by `aria-describedby` and announced; the photo is checked in the browser for one of png, jpeg, webp, or gif and a 5 MB ceiling before upload, with Clerk still the final authority and its own message shown for anything the browser check cannot predict.
- **AC-16**: `/account/settings` offers the theme choice (system, light, dark), reflecting and setting the same value as the header control, and defaulting to system.
- **AC-17**: The theme choice persists in a cookie that the server reads during rendering, so the first paint already carries the right theme for the light and dark choices with no flash. For the system choice the device preference decides before paint through a small inline script, and a change is applied immediately with no reload (the browser writes the cookie with `document.cookie`, then toggles the class on the root element, so nothing waits on a round trip). The cookie value is constrained to the three allowed values, and an unknown or missing value falls back to system.
- **AC-18**: The area is fully keyboard reachable with a visible focus ring, and every control has a label (the icon only theme control carries an accessible name that states the current choice). The layout works from 320px up, and no new colour pair is introduced: every value comes from the existing tokens in both themes.
- **AC-19**: This feature adds exactly one migration, creating an index that supports the author filtered read in its updated order and a trigger that refreshes `updated_at` on every update. It adds no new table and no new column.
- **AC-20**: The four new actions capture analytics through the existing PostHog client: `skill_updated` and `skill_deleted` each carrying the skill's slug, `theme_changed` carrying the chosen value (system, light, or dark), and `profile_updated` carrying which field changed (name, photo, or email) and never the value itself. No other personal data is captured.

## Decision

**Chosen option**: Option 1: a nested, server guarded area at `/account` with our own pages, our own management of the four skill fields (edit and a permanent delete), a hand built profile page writing to Clerk's client SDK, and a cookie backed theme system that the root document reads on the server.

This means four file routes under a shared layout (`account.tsx` as the layout with `account.index.tsx`, `account.skills.tsx`, `account.profile.tsx`, `account.settings.tsx`, plus `account.skills.$slug.edit.tsx`), one generalized guard server function reused by the publish route and the whole area, four new server functions plus one count and one theme read, one migration (an index and an `updated_at` trigger), one new UI primitive (shadcn's `AlertDialog` for the delete confirmation), and a small theme feature read by the root route.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `clerk-custom-ui` (`clerk/skills`, `~/.agents/skills/clerk-custom-ui/`, the appearance and SDK conventions for the profile writes)

## Feature design

**Data model sketch**:

One migration, no new entity, no new column. The existing `skills` table (spec 0003) is unchanged in shape:

| Change | Statement | Why |
|---|---|---|
| index | `skills_author_updated_idx` on `(author_id, updated_at desc, id desc)` | the area's only read filters by author and orders by recently updated, and today only `created_at` is indexed (basis: the existing `listSkillRows` order and its `skills_created_at_idx`) |
| trigger | `skills_set_updated_at`, BEFORE UPDATE, sets `NEW.updated_at = now()` | the edit path must advance `updated_at`; spec 0003 recorded the rule but never built it, and the trigger holds for any writer, not just Drizzle |

Unchanged: every `skills` column, the `skills_slug_unique` index, the length and shape checks, `createSkill`, `listSkillCards`, `getSkillDetail`, and the whole catalogue. The theme choice lives in a cookie and the profile in Clerk, so neither needs storage of ours.

**State transitions**:

- **Edit form**: `idle` → `submitting` → `saved` (invalidate, then navigate to the public detail page) · `invalid` (field messages shown, form stays editable) · `error` (an `Alert` with a retry, values kept) · `unauthenticated` (a sign in prompt, values kept). There is no draft state: an edit either lands or it does not.
- **Delete**: `closed` → `confirming` (the modal is open and focus is trapped) → `deleting` → `deleted` (navigate to the list with a confirmation) · `error` (the modal reports the failure and stays open so the user can retry or cancel).
- **Email change**: `idle` → `entering address` → `code sent` (the code field appears) → `verified` (the make primary action appears) → `primary set`. Failure branches, each keeping the user where they are: `code incorrect`, `code expired` (offering a resend), `address already in use`, and `verification failed` after too many attempts.
- **Theme**: three values, `system`, `light`, `dark`. The header control cycles `system → light → dark → system`; the settings page selects any of the three directly. There are no other transitions.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `ensureSignedIn` (existing, generalized) | read (server function, GET) | `returnTo: string` | nothing on success | public (it is the gate) | throws a router redirect to `/sign-in/$` with the return path |
| `listMySkillCards` | read (server function, GET) | `limit` (optional, default 20, ceiling 100), `offset` (optional, default 0) | `{ items: ManagedSkillCard[], hasMore: boolean }` | signed in | `UNAUTHENTICATED`, `SKILLS_QUERY_FAILED` |
| `getAccountOverview` | read (server function, GET) | none | `{ user: { fullName, imageUrl, primaryEmail, joinedAt }, skillCount }` | signed in | `UNAUTHENTICATED`, `SKILLS_QUERY_FAILED` |
| `getMySkill` | read (server function, GET) | `slug` (required) | the stored skill, ready to prefill the form | signed in, owner | `UNAUTHENTICATED`, `SKILL_NOT_FOUND`, `SKILLS_QUERY_FAILED` |
| `updateSkill` | write (server function, POST) | `slug` (required), `name`, `summary`, `description` (required), `installUrl` (optional) | the updated skill with its unchanged slug | signed in, owner | `UNAUTHENTICATED`, `VALIDATION_FAILED` (carries `field`), `SKILL_NOT_FOUND`, `SKILLS_WRITE_FAILED` |
| `deleteSkill` | write (server function, POST) | `slug` (required) | nothing | signed in, owner | `UNAUTHENTICATED`, `SKILL_NOT_FOUND`, `SKILLS_WRITE_FAILED` |
| `readThemeChoice` | read (server function, GET) | none | `"system" | "light" | "dark"` | public | none (an unknown value falls back to `system`) |

`ManagedSkillCard` is `{ id, slug, name, summary, updatedAt }`, enough for the card to link to both the edit page and the public detail page. The three skill functions that need ownership share one query layer helper, so the "is this mine" check exists in one place rather than three. `SKILL_NOT_FOUND` already exists (spec 0004 introduced it for the detail page). Profile writes are not in this table because they go straight to Clerk from the browser, not through our server.

**Value sourcing** (every value each action produces, computes, or displays names where it comes from; a required value with no named source is an undecided input, resolved here rather than left for the build):

| Action | Value produced / displayed | Source |
|---|---|---|
| `getAccountOverview` | the full name | the Clerk user's `firstName` and `lastName`, joined, falling back to the local part of the primary email when both are empty |
| `getAccountOverview` | the avatar | the Clerk user's `imageUrl` |
| `getAccountOverview` | the primary email | the Clerk user's `primaryEmailAddress.emailAddress` |
| `getAccountOverview` | the joined date | the Clerk user's `createdAt`, formatted with the date helper in `src/features/skills/date.ts` |
| `getAccountOverview` | the skills published count | a new `countSkillRowsByAuthor(sessionUserId)` query (`count(*)`), not a length of a loaded page |
| `listMySkillCards` | the rows | `listSkillRowsByAuthor(sessionUserId, limit, offset)` ordered by `updated_at` then `id`, both descending |
| `listMySkillCards` | the author filter | the Clerk session user id read inside the function, never an input |
| `listMySkillCards` | `hasMore` | derived: one row beyond the requested limit, the same trick the catalogue uses |
| the List more control | the next offset | derived from the rows already loaded, matching `skillCardsQueryOptions` |
| a management card | the last updated date | the `skills.updated_at` column, formatted with the date helper |
| the area guard | allow or redirect | the Clerk `auth()` result read inside the guard server function |
| the area guard | the return path | the router's `location.pathname` plus `location.searchStr` (the root relative form, not the absolute `href`), passed into the guard and validated to start with `/` and not `//` |
| `getMySkill` | the four prefilled values | the stored row's `name`, `summary`, `description`, and `install_url` |
| `getMySkill`, `updateSkill`, `deleteSkill` | the ownership decision | the stored row's `author_id` compared with the session user id |
| `updateSkill` | the slug | the stored row's existing `slug`, never re derived and never sent by the client |
| `updateSkill` | the new `updated_at` | the new database trigger, not the application |
| the detail page | the edited date line | `skills.updated_at`, shown only when it is later than `created_at` |
| the profile page | the editable name and photo | the client `user` object from Clerk's `useUser()`, which is what carries `update` and `setProfileImage` |
| the profile page | the code delivery status | `emailAddress.verification.status` and, on failure, the `code` on the thrown `ClerkAPIResponseError` |
| the email flow | which address to verify | the `EmailAddressResource` returned by `user.createEmailAddress({ email })`, re found on the user object after `user.reload()` |
| the header and settings controls | the current theme choice | the `theme` cookie value, read on the server through `getCookie` inside the theme server function |
| the system choice | the resolved theme | the browser's `matchMedia('(prefers-color-scheme: dark)')`, applied before paint by a small inline script |
| the root element | the `dark` class | derived from the resolved theme, which reaches the root document because the root route resolves the choice in `beforeLoad` into router context and the shell reads that context |
| the theme controls | the stored cookie | written from the browser with `document.cookie` (`Path=/`, `SameSite=Lax`, one year), because the framework offers no client setter |
| the icon only theme control | its accessible name | the current theme choice, so the label states what is set |
| the four analytics events | the event payloads | the action's own values (the skill slug where relevant), captured through the existing PostHog client |

Hand written copy decided here (kept in the feature, not invented by `/develop`): the sidebar labels are `Overview`, `My skills`, `Profile`, `Settings`; the header link label is `Your account`; the overview headings are the user's name with the supporting line `Your Skild account`; the skills page `h1` is `My skills` with the supporting line `Skills you published, newest edit first.`; the empty state title is `You have not published a skill yet` with the action `Publish a skill`; the edit page `h1` is `Edit skill`; the delete confirmation title is `Delete this skill?` with the body `This removes the skill for good. Anyone following its link will see a not found page.`, the confirm label `Delete skill`, and the cancel label `Keep skill`; the delete message is `Skill deleted`, shown inline on the list; the theme control's accessible name is `Theme: System`, `Theme: Light`, or `Theme: Dark`; the settings theme legend is `Theme` with the three options `System`, `Light`, `Dark` and the hint `System follows your device setting.`; the profile page sections are `Name`, `Photo`, and `Email address`; the edited date label is `Edited 20 Sept 2026`; the unauthenticated save prompt is `Sign in to save your changes` with a `Sign in` action; and the email messages are `That code is not right.` for a wrong code, `That code has expired. Send a new one.` for an expired one, and `That email address is already in use.` for one already taken, with Clerk's own message shown for any code we do not map. Field labels, hints, limits, and messages for the four skill fields come from the shared constants and messages in `src/features/skills/schema.ts`, so they never drift from the server.

**Key invariants**:
- The session user id is the only source of ownership. No client value may name an author, and every write re reads the session.
- A skill that belongs to someone else is indistinguishable from a skill that does not exist, on every path (the edit read, the update, and the delete).
- The slug is decided once, at publish, and never changes. Renaming a skill leaves its URL alone, so shared links keep working.
- `updated_at` is always at or after `created_at`, and the trigger is what advances it, so no application path can forget.
- The area's list read filters by the session user id, so it cannot be made to return another author's rows.
- The theme cookie holds only `system`, `light`, or `dark`. Any other value, or no value, resolves to `system`, so a forged cookie cannot inject a class or markup.
- The theme class is applied to the root document element before the first paint, so a light or dark choice never flashes the wrong theme.
- Every area route is guarded on the server before any area HTML is produced, so a signed out visitor cannot read the area's markup from the response.
- Every skill write settles the reads it can make stale before it navigates: the detail key for the slug, the area's list and overview keys (`mySkillKeys`), and the catalogue cards. The detail query has no refetch on mount, so skipping its invalidation is exactly what would show a stale page.

**Security model**:
- Reading a skill is public: the catalogue and the detail page are open to anyone, and this feature does not change that.
- Editing and deleting are owner only. Ownership is enforced inside each new server function by comparing the stored `author_id` with the session user id, and a mismatch returns `SKILL_NOT_FOUND`, so the answer does not confirm that someone else's skill exists.
- The area guard runs on the server in a server function, and each write checks the session again on its own, so a forged client request fails at the server regardless of what the browser did.
- The profile writes use Clerk's client SDK against the user's own session, so no other person's identity can be written, and no identity data passes through our server.
- The theme cookie is deliberately not `httpOnly` (the browser applies a change instantly), so it is treated as untrusted input and validated on read. It is `SameSite=Lax` and `Path=/`, and it carries no personal data.
- No new secret and no new environment variable. `CLERK_SECRET_KEY`, the Clerk publishable key, and the database URL are already required by earlier features.
- No compliance scope applies: no payment, health, or regulated data. The name, photo, and email already live in Clerk for the authentication foundation, and this feature reads and writes them through Clerk rather than copying them into our store.

**Configuration required**: None new. The feature reuses the existing Clerk and database configuration. The theme cookie name is a constant in the theme feature, not an environment variable.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: signed in, open `/account` and see the identity and the count, open `/account/skills` and see own skills newest edit first, open a skill's edit page, save it, and land on the public detail page with the edited date shown, verifies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-8**, **AC-9**, **AC-10**
- Auth: request `/account/skills` while signed out and confirm a server redirect to sign in that carries the return path and returns the user to the area afterwards, verifies **AC-2**
- Auth/permission: signed in as one author, request another author's edit URL and call the update and delete functions with their slug, and confirm both answer not found while nothing changes, verifies **AC-14**
- Delete: delete a skill through the modal and land on the list with a confirmation, then request the deleted skill's public page and confirm 404, verifies **AC-13**
- Empty state: an author with no skills sees the `Empty` state and its call to action to `/skills/new`, verifies **AC-6**
- Theme: choose dark and reload, and confirm the first paint is already dark with no flash; choose system and confirm the device preference decides before paint, verifies **AC-16**, **AC-17**
- Email change: enter a new address, take the code, verify it, then make it primary; then repeat with a wrong code and with an address already in use and confirm each renders a tied and announced message, verifies **AC-15**
- Failure: force a read failure on the list and confirm the `Alert` with a retry; force a save failure and confirm the typed values stay, verifies **AC-7**, **AC-11**
- Leave guard: change a field, navigate away in app, and confirm the prompt appears, verifies **AC-12**
- Migration: edit a skill and confirm `updated_at` advanced, and confirm the new index exists, verifies **AC-9**, **AC-19**

## Build plan

Ordered for the project's Tracer Bullet approach (Scope header): stand up the thinnest end to end thread through every layer first (a guarded area route, a real author filtered read, and a rendered list), then thicken it with the states, the write path, the delete, the profile, and finally the theme, which is the one part that reaches outside the area. The single migration lands early rather than being sliced, because it is two statements with no data change and no backfill, so the schema matches the target from the first build step and nothing is built against a shape the spec does not describe.

1. Generalize the guard and stand up the shell. Change `ensureSignedIn` to accept a validated return path, and update `/skills/new` to pass its own path (the existing `PUBLISH_PATH` constant becomes that argument). Add `src/routes/account.tsx` as the layout route whose `beforeLoad` awaits the guard, plus `src/routes/account.index.tsx` as a placeholder. Confirm a signed out request to `/account` redirects and lands back after signing in, and that a child route renders inside the layout, satisfies **AC-1**, **AC-2**
2. Add the migration: the `skills_author_updated_idx` index on `(author_id, updated_at desc, id desc)` and the `skills_set_updated_at` trigger. Generate it with `npm run db:generate`, apply it with `npm run db:migrate`, and confirm by updating a row that `updated_at` advances, satisfies **AC-19**, **AC-9**
3. Thin thread end to end: add `listSkillRowsByAuthor` to `src/db/queries.ts` (taking the author id, limit, and offset, ordered by `updated_at` then `id` descending) and `listMySkillCards` in `src/features/skills/data.ts` (session author, `limit + 1` rows for `hasMore`), add the area's `mySkillKeys` key map and its infinite options, then render the real list at `/account/skills` with the management card (name, summary, last updated date, links to edit and to the public page) and Load more, so the whole pipe from session to store to UI is proven, satisfies **AC-5**
4. Add the list's three states: `Skeleton` placeholders in the card's shape while loading, the `Empty` state with the call to action to `/skills/new` when the author has none, and the `Alert` with a retry when the read fails, satisfies **AC-6**, **AC-7**
5. Add the overview: `countSkillRowsByAuthor` in `src/db/queries.ts`, `getAccountOverview` reading the Clerk user with `clerkClient().users.getUser(...)` and the count, and the page showing the identity, the joined date, the count in a `Card`, and links to the other three pages, satisfies **AC-4**
6. Add the header entry points in `src/components/site-header.tsx`: a `Your account` link to `/account` inside the existing signed in block, and the theme control (its behaviour lands in step 12, its placement here), satisfies **AC-3**
7. Add the edit read path: a shared query layer helper that resolves a slug for an author and returns `undefined` when the row is missing or owned by someone else, then `getMySkill` on top of it, and the `/account/skills/$slug/edit` route rendering the four prefilled fields in one `Card` with the existing publish field wrapper and the shared labels, hints, and limits; map `SKILL_NOT_FOUND` to `notFound()` with a `notFoundComponent`, satisfies **AC-8**, **AC-14**
8. Add the write path: `updateSkill` (session, ownership, the shared validation, the four fields only, slug untouched), then invalidate `skillKeys.detail(slug)`, the area's `mySkillKeys` list and overview keys, and the catalogue cards, and navigate to `/skills/<slug>`; then add the `Edited 20 Sept 2026` line to the public detail page, shown only when `updated_at` is later than `created_at`, satisfies **AC-9**, **AC-10**, **AC-14**
9. Add the edit failure states and the leave guard: one `fieldErrors` state set from the mutation result, the message under the offending field with `aria-invalid` and an announced region, the `Alert` with a retry for a store failure, an inline `Sign in to save your changes` button (Clerk's `openSignIn()`) for an unauthenticated result with the typed values kept on screen, and a `useBlocker` guard that warns before in app navigation once a field has been changed, satisfies **AC-11**, **AC-12**
10. Add the delete path: install shadcn's `AlertDialog` (it imports from the consolidated `radix-ui` already in `package.json`, so it adds no dependency; still repoint the `cn` import to `#/lib/utils` and drop the `cn` package, per the registry note in `AGENTS.md`), add `deleteSkill` with the ownership check, put the delete action on the edit page, and on confirm invalidate the detail key for the slug plus the area and catalogue keys, then return to `/account/skills?deleted=<slug>` where the inline `Skill deleted` message renders, satisfies **AC-13**, **AC-14**
11. Add the profile page: first and last name through `user.update`, the photo through `setProfileImage` with a browser side type and 5 MB check before upload and Clerk's message shown when it rejects, and the email change as three steps (add the address, send and verify the code, then make the verified address primary), with a tied and announced message for a wrong code, an expired code (offering a resend), and an address already in use, satisfies **AC-15**
12. Add the theme system and the settings page: `src/features/theme/` holding the cookie name constant, a `readThemeChoice` server function reading it with `getCookie`, a browser side hook that writes the cookie with `document.cookie` and toggles the class on the root element at once, a root route `beforeLoad` that resolves the choice into router context, the root document applying the `dark` class from that context plus a small inline script that resolves the system choice before paint, the header cycle button, and the three way control on `/account/settings`. Prove the shell wiring first, since `<html>` renders in `shellComponent` rather than in a route component, satisfies **AC-16**, **AC-17**
13. Add the four analytics events in the publish feature's fixed order: `skill_updated` before navigating, `skill_deleted` before navigating to the list, `theme_changed` on the choice, and `profile_updated` after a successful Clerk write, satisfies **AC-20**
14. Accessibility and responsive pass across the four pages in both themes: labels on every control, the icon only theme control's name stating the current choice, visible focus rings, heading order, the live region announcements, the delete dialog's focus trap and escape, the tap targets, and the layout at 320px, satisfies **AC-18**
15. Confirm the boundaries: exactly one migration, no new table and no new column, the publish rules reused unchanged, the theme values constrained to the three, and no new environment variable, satisfies **AC-19**, **AC-9**

## Consequences

**Positive**:
- The product gains a home for the person using it, and the first way to correct or retire a published skill, so publishing stops being a one way door.
- The dark palette that spec 0002 built and only `/design` could reach is finally switchable by a real visitor, so both themes are first class in practice rather than in the gallery.
- The guard becomes a reusable server side gate for a group of routes, which the later slices (upvotes, moderation) can lean on instead of each inventing one.
- The update path closes the gap spec 0003 recorded, where `updated_at` never advanced on an update.
- The management card, the area shell, and the settings page extend the existing design system rather than starting a second one, and the profile page proves Clerk's client side write path.

**Negative / tradeoffs**:
- This is a wide slice: four pages, a write path, a delete path, an external verification flow, and an app wide theme change. It will take materially longer than spec 0005, and the theme work touches the shared header and root document, so a mistake there reaches every page. If it stalls, the natural cut is to split the profile flow and the theme system into their own spec.
- Ordering the skill list by recently updated makes it unstable under writes: editing a skill moves it to the top, and a skill edited while the user pages through the list can appear twice or be missed. The list is invalidated on edit and the user leaves for the detail page after saving, so the window is small, but the risk is real and it is the price of putting the most recently touched skills first.
- The theme choice lives in a cookie, so it does not follow a signed in user to another device, and the system choice depends on a small inline script before paint, which a future Content Security Policy has to allow or it will flash.
- Resolving the theme on the server adds a server function call to the root route's `beforeLoad`, so every page load pays a small extra round trip for a cosmetic setting. The alternative, reading the cookie in the inline script for all three values, removes the round trip but moves that work to the browser.
- The email change is the most failure prone surface in this feature: code delivery, expiry, and an address already in use each need their own tested message, and it depends on Clerk's email deliverability, which we do not control.
- Delete is permanent with no undo and no archive, so an accidental delete loses the description. The modal is the only guard.
- The area gives an author no control over anyone else's skill, and there is still no moderation, so deleting your own is the only lever this slice adds.
- Three new functions depend on the same ownership check. It is enforced once in the query layer so the functions share it, but a future write path must remember to call that helper rather than query directly.

**Neutral**:
- One migration, forward only, with no data change: an index and a trigger, so there is no backfill and no rollback risk on data.
- The theme system changes the root document and the header, which every route shares, so its blast radius is the whole app while its surface area is small.
- `design.md` and spec 0002 both record that the theme switcher is a later feature and that only `/design` can toggle the dark class. That is now stale, and `/sync` owns correcting it (see Follow-up).
- The only new primitive is shadcn's `AlertDialog`, which imports from the consolidated `radix-ui` package already in `package.json`, so it adds no new dependency.
- The area adds no new environment variable, so nothing new to configure on a fresh checkout.

## Follow-up

- [ ] `design.md` and spec 0002 (`index.md`, `rationale.md`, `verify.md`) state that the theme switcher is a later feature and that only `/design` can toggle the dark class. This spec delivers the switcher, so those lines are stale: `/sync` should correct them, and `/scope` should retire the deferred "Theme switcher" item now absorbed by feature 4.
- [ ] The Agent Skills and MCP discovery offer was skipped because this feature chooses no new tool: it reuses Clerk, TanStack Start and Router, Drizzle, and the shadcn registry already in the project. The one addition, shadcn's `AlertDialog`, is a component of the installed system rather than a new tool.
- [ ] Spec 0003's `verify.md` records that `updated_at` is not refreshed on update. This spec closes that gap with a trigger, so `/sync` should note it as closed rather than leaving the stale entry.
- [ ] The theme cookie is not `httpOnly` by necessity. When the deploy slice (feature 10) adds a Content Security Policy, the small inline script that resolves the system choice must be allowed by a nonce or a hash, or the system choice will flash the wrong theme on every load.
- [ ] The server read of the theme costs one call in the root route's `beforeLoad` on every page load. If that becomes a measurable cost, move the read into the inline script (which can see the cookie itself) and drop the server function, keeping the class applied before paint.
- [ ] The email change depends on Clerk's email deliverability and its rate limits. Check the Clerk instance's email settings (and whether a development instance delivers real mail) before verifying AC-15, since a development instance may silently not send.
- [ ] The skill list is paged by offset while ordered by `updated_at`. If the shifting order shows up in practice, move to a keyset cursor over `(updated_at, id)` instead of the offset.
- [ ] The photo check in the browser enforces a type and a 5 MB ceiling, with Clerk as the authority. If Clerk's accepted type list proves narrower than the browser check, tighten the browser check to match rather than letting the user reach Clerk's rejection.
- [ ] When the profile page grows (or if the email flow's error states multiply), consider replacing the hand built page with Clerk's prebuilt `UserProfile` component, which was weighed and set aside here so the profile stays inside the app's own layout. Revisit if the maintenance cost of the hand built flows climbs.
- [ ] The area is behind sign in and should stay out of the sitemap and per page SEO metadata. Feature 8 should treat `/account/*` as excluded.
- [ ] If this spec proves too wide to build in one pass, split the profile flow and the theme system into their own spec rather than leaving milestones half true. The area shell, the skill list, and the edit and delete paths are the core and should stay together.

## Rationale

Reasoning, the options weighed, the sources, and the verified links: see [rationale.md](rationale.md).

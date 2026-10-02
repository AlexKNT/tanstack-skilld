# 0005. Publish a skill from a form

**Date**: 2026-10-02
**Status**: Accepted

## Summary

This decision adds the publish flow: a `/skills/new` page where a signed in user fills a four field form and saves a skill the catalogue then shows. Almost everything below the surface already exists. The write path (`createSkill`), the validation rules, the slug retry, the `skills` table, and the catalogue read all shipped in specs 0003 and 0004, so this feature is the page, the form, the guard, and the wiring around them. No database change, no new server function, no new dependency.

## Requirements

**User stories**:
- As a signed in user, I want to add a skill through a form so that others can find and install it.
- As a signed in user, I want clear feedback when a field is wrong so that I can fix it and publish.
- As a signed out visitor, I want to be sent to sign in and returned here so that publishing feels like one flow.
- As the engineer, I want publishing to reuse the write path and rules the data model already established, so there is one place that decides what a valid skill is.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: `/skills/new` renders a form with four fields (name, summary, description, install URL) inside one `Card`, under the shared header, with one `h1`, reachable from a `Publish a skill` control in the header shown only to signed in users.
- **AC-2**: Reaching `/skills/new` while signed out redirects to `/sign-in/$` on the server from `beforeLoad` (a small `ensureSignedIn` server function calls `auth()` and `throw`s a router `redirect`), the form never renders for a signed out client, the redirect carries `/skills/new` as the return path, and `src/routes/sign-in.$.tsx` passes that return path to Clerk so the user lands back on the form after signing in.
- **AC-3**: Submitting a valid skill saves it through the existing `createSkill` server function, then redirects to `/skills/<slug>` for the new skill.
- **AC-4**: On a successful save the catalogue query key `skillKeys.cards()` is invalidated and awaited before navigating, so returning to `/` shows the new skill without waiting out the stale time.
- **AC-5**: Each field shows a validation message under it, tied to the input by `aria-describedby` with `aria-invalid` set on the input, taken from the server failure's `field` and `message`, and the message region is announced when it appears (an `aria-live` region, or focus moved to the first invalid field).
- **AC-6**: The name is limited to 80 characters and the summary to 200, the description is required and limited to 100000 characters, and the install URL, when given, must be an http or https address; each limit is stated in a hint under its field, enforced by the existing `validateCreateSkillInput`.
- **AC-7**: A save failure that is not validation keeps the typed contents and shows an `Alert` above the form with a retry action; a `UNAUTHENTICATED` failure shows a sign in prompt instead.
- **AC-8**: Opening the form captures a `publish_started` event with no skill fields (none exist yet), and a successful save captures a `skill_published` event carrying the skill name (from form state) and the returned slug, both through the existing PostHog client and both fired before state is cleared and before navigation, with no other personal data.
- **AC-9**: The form is fully keyboard reachable with a visible focus ring, every control has a label (a hand built field wrapper, since no `Label` or `Input` primitive is installed), the submit control is disabled with a `Spinner` and keeps a stable accessible name (`aria-label`) while the save is in flight, an Enter key submit while the save is in flight is ignored by an in handler guard, and the layout works from 320px up.
- **AC-10**: `/skills/new` resolves to the form even though `/skills/$slug` exists, because a static segment ranks above a parameter segment; the route is added to the generated route tree, and the collision is documented in the spec and on the route so nobody reorders the routes by mistake.
- **AC-11**: This feature adds no database column and no migration; the `skills` table, `createSkill`, `validateCreateSkillInput`, and the catalogue query are reused unchanged.

## Decision

**Chosen option**: Option 1, a dedicated `/skills/new` page guarded on the server, a controlled React form submitting through `useMutation` to the existing `createSkill`, with inline field errors from the server result, then a redirect to the new skill's detail page.

The new route `src/routes/skills.new.tsx` sits under the shared header and renders one `Card` holding the four fields in source order (name, summary, description, install URL), each in a hand built labelled field wrapper (no `Label` or `Input` primitive is installed). Form state lives in React state (no form library), and the save runs through `useMutation` wrapping `createSkill`, which already reads the session for the author id, validates, and retries a clashing slug. On success the mutation captures the analytics event, awaits the catalogue invalidation, and redirects to `/skills/<slug>`; on a validation failure the returned `field` and `message` render under the offending input in an announced live region; on any other failure an `Alert` appears above the form with a retry that keeps the typed contents. The route's `beforeLoad` calls a small `ensureSignedIn` server function that reads the Clerk session and throws a router redirect to `/sign-in/$` with the return path preserved, and `src/routes/sign-in.$.tsx` hands that return path to Clerk so the user comes back to the form.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`) · `tanstack-query-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-query-best-practices/`) · `clerk-tanstack-patterns` (`clerk/skills`, `.agents/skills/clerk-tanstack-patterns/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**: No change. The feature writes into the `skills` table (spec 0003) through the existing `insertSkillWithSlug`, which already sets `slug` (derived on the server), `author_id` (from the session), `created_at` and `updated_at`. The form collects exactly the four fields `createSkill` accepts:

| Form field | Column | Rule |
|---|---|---|
| name | `name` | required, trimmed, 1 to 80 characters, `h1` scale input |
| summary | `summary` | required, trimmed, 1 to 200 characters, single line |
| description | `description` | required, trimmed, 1 to 100000 characters, multi line markdown |
| install URL | `install_url` | optional, an http or https web address when given |

The slug is never collected: `createSkill` derives it from the name and retries with a numeric suffix on a clash, so two skills may share a name and still live at distinct URLs.

**State transitions**: The form moves through `idle` to `submitting` to `saved` (then a redirect), `invalid` (field errors shown, form stays editable), or `error` (an `Alert` with retry, form stays editable). No stored entity changes state; a published skill is immediately visible in the catalogue, there is no draft or review state in this slice.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createSkill` (existing) | write (server function, POST) | `name` (req), `summary` (req), `description` (req), `installUrl` (opt) | the created skill with its `id` and `slug` | signed in | `UNAUTHENTICATED`, `VALIDATION_FAILED` (carries `field`), `SKILLS_WRITE_FAILED` |

This feature adds no server function. `createSkill` already takes the exact payload the form collects, takes the author id from the session rather than the payload, validates through `validateCreateSkillInput`, and returns either the created skill (with its slug for the redirect) or a `Failure` carrying a `code`, a `message`, and for validation a `field`. That is the whole server surface the form needs.

**Value sourcing** (every value each action produces, computes or displays names where it comes from; a required value with no named source is an undecided input, resolved here rather than left for the build):

| Action | Value produced / displayed | Source |
|---|---|---|
| the form | the four field values | typed by the user into React state |
| `createSkill` | the stored `name`, `summary`, `description`, `install_url` | the four field values in the payload |
| `createSkill` | the slug | derived on the server by `slugify` from the name, with a numeric suffix retried on a clash |
| the form | the submitted values | the four field values, each trimmed before they enter the payload, with the raw strings kept in state for re editing |
| `createSkill` | the author id | the Clerk session inside `createSkill`, never the payload |
| the redirect | the target URL `/skills/<slug>` | the `slug` on the created skill `createSkill` returns |
| the inline error | which field and which message | the `field` and `message` on the returned `Failure`, held in one `fieldErrors` state (`Partial<Record<FieldName, string>>`), set from the mutation result and cleared at the start of the next submit |
| the retry action | what to resubmit | the same four field values already in React state |
| `ensureSignedIn` | redirect or allow | the Clerk `auth()` result read in the server function behind `beforeLoad`; a failure throws `redirect({ to: "/sign-in/$", search: { redirect: "/skills/new" } })` |
| `sign-in.$.tsx` | the post sign in destination | the `redirect` search param the guard set, passed to Clerk as the fallback redirect target |
| the length hints | the 80, 200 and 100000 limits | the constants `MAX_SKILL_NAME_LENGTH`, `MAX_SKILL_SUMMARY_LENGTH`, `MAX_SKILL_DESCRIPTION_LENGTH` in `src/features/skills/schema.ts`, imported rather than re typed |
| the sign out prompt | shown or not | derived from the failure `code` being `UNAUTHENTICATED` |
| the analytics events | `publish_started` and `skill_published` | a PostHog capture on mount and on success, carrying the name and slug only |
| the guard | redirect or render | the Clerk session read on the server in `beforeLoad` |
| the page copy | each heading, label, hint and button label | hand written copy decided here (see the table below) |

Hand written copy decided here (kept in the feature, not invented by `/develop`): page kicker `Publish`, `h1` `Publish a skill`, supporting line `Share a skill so others can find and install it.`; submit label `Publish skill` with a stable `aria-label` so its accessible name does not change while pending, and a `Spinner` shown beside it as the visual pending cue; the field labels and hints are `Name` (hint `Up to 80 characters.`), `Summary` (hint `One line, up to 200 characters.`), `Description` (hint `Markdown is allowed. Up to 100,000 characters.`), `Install URL` (hint `Optional. Must start with http:// or https://.`); the error `Alert` title `The skill could not be published` with the returned message and a `Try again` action; the unauthenticated `Alert` title `Please sign in again` with a `Sign in` action. The hint wording and the field error wording come from the shared constants and messages in `src/features/skills/schema.ts` so they never drift; the 100,000 grouping in the hint is presentation only and must not change the validated value.

**Key invariants**:
- The server is the only authority on validity. The form makes no client side rule of its own, so an accepted skill is exactly what `validateCreateSkillInput` accepts.
- The author is always the signed in session. The payload never carries an author id, so nobody can publish under another name.
- The slug is always derived on the server. The client never sends one.
- A submission is guarded while in flight: the mutation's `isPending` disables the submit control, so a double click cannot start two writes, and the slug retry means even a genuine double save would not clash.
- The form contents survive every failure except a successful save; only the redirect clears them.
- The order on success is fixed: capture the analytics event, then `await` the catalogue invalidation, then navigate. A skill published twice in a row cannot leave the catalogue showing stale data.
- The order on failure is fixed: set the failure state first, then render, so no event is captured after unmount.
- `/skills/new` always resolves to the form, never to a skill whose slug happens to be `new`. A skill slugified to `new` is shadowed at that path (the static route wins) and is reachable only by a different slug, which the numeric suffix retry already provides.

**Security model**:
- Publishing is available to any signed in user, with no quota and no role check this slice. There is no anonymous publish path.
- The route is guarded on the server in `beforeLoad` so the form does not render for a signed out visitor, and `createSkill` checks the session again on the write, so a forged client request fails at the server regardless.
- The author id comes from the session, never the client, so attribution cannot be spoofed.
- The description stays untrusted. It is stored as text and sanitized at render time by the renderer spec 0004 built (scripts, frames, event handlers and images stripped, links limited to http, https and mailto), so this feature does not add a new sanitizing surface and does not need to strip on write.
- No new credential and no new environment variable. `CLERK_SECRET_KEY` and the database URL are already required by earlier features.
- No compliance scope applies: no payment, health, or regulated data.

**Configuration required**: None new. The feature reuses the existing Clerk and database configuration.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: signed in, open `/skills/new`, fill all four fields, submit, and land on the new skill's detail page with the skill present in the catalogue, verifies **AC-1**, **AC-3**, **AC-4**
- Validation: submit with an empty name, then with a name over 80 characters, and confirm the message appears under the name input with `aria-invalid` set, verifies **AC-5**, **AC-6**
- Auth/permission: reach `/skills/new` while signed out and confirm a server redirect to sign in that returns to the form, verifies **AC-2**
- Failure: force `createSkill` to return `SKILLS_WRITE_FAILED` and confirm the typed contents stay and an `Alert` with a working retry appears; force `UNAUTHENTICATED` and confirm the sign in prompt, verifies **AC-7**
- Double submit: click submit twice quickly and confirm only one skill is created, verifies **AC-9**
- Routing: confirm `/skills/new` renders the form and `/skills/<a real slug>` renders the detail page, verifies **AC-10**

## Build plan

Ordered for the project's Tracer Bullet approach: stand up the thinnest end to end thread (route to form to store to redirect) on real data first, then thicken it with per field errors, the states, the guard, and the accessibility pass. Every step leaves the app runnable, and the early steps reuse what specs 0003 and 0004 already shipped.

1. Add the route shell: `src/routes/skills.new.tsx` with a `createFileRoute` that renders the page frame (kicker, `h1`, supporting line, one `Card`) with a placeholder form, and confirm `/skills/new` resolves to it while `/skills/$slug` still works, satisfies **AC-1**, **AC-10**
2. Thin thread end to end: four controlled inputs in React state wired to a `useMutation` calling `createSkill`, with a submit that logs the result, so the whole pipe from form to store and back is proven before styling, satisfies **AC-3**
3. On success, invalidate the catalogue query key (`skillKeys.cards()`) and redirect to `/skills/<slug>` from the returned skill, satisfies **AC-3**, **AC-4**
4. Add the server side guard: a small `ensureSignedIn` `createServerFn` that calls `auth()` and `throw`s `redirect({ to: "/sign-in/$", search: { redirect: "/skills/new" } })` when signed out, called from the route's `beforeLoad`; then have `src/routes/sign-in.$.tsx` read that `redirect` search param and pass it to Clerk as the fallback destination, satisfies **AC-2**
5. Add the field wrapper: a small labelled field component (label, control, hint, `aria-describedby`, `aria-invalid`) hand built on the existing styles, since no `Label`, `Input` or `Textarea` primitive is installed, satisfies **AC-5**, **AC-9**
6. Map failures to the UI: keep one `fieldErrors` state set from the mutation result and cleared on the next submit, a validation `Failure` renders its `message` under the field named by `field`, and the message region is announced via an `aria-live` region; any other `Failure` shows the `Alert` above the form with a retry that resubmits the kept state; `UNAUTHENTICATED` shows the sign in prompt, satisfies **AC-5**, **AC-7**
7. Add the field hints from the shared length constants, and the markdown hint on the description, satisfies **AC-6**
8. Add the pending state: the submit control disables, shows a `Spinner`, and keeps a stable `aria-label` while the mutation is in flight, with an in handler guard that ignores a second submit, so neither a click nor an Enter key can start two writes, satisfies **AC-9**
9. Add the header entry point: a `Publish a skill` `Button` in `src/components/site-header.tsx` linking to `/skills/new`, shown only inside the existing `Show when="signed-in"` block, satisfies **AC-1**
10. Add the analytics in the fixed order: capture `publish_started` with no skill fields on mount, and on success capture `skill_published` with the name from form state and the returned slug before clearing state, then `await` the catalogue invalidation, then navigate, satisfies **AC-8**
11. Accessibility and responsive pass: label every control, confirm focus rings and heading order and the live region announcement, and check the layout at 320px, satisfies **AC-9**
12. Confirm the boundaries: no schema change or migration, and `createSkill`, `validateCreateSkillInput`, the `skills` table and the catalogue query are reused unchanged, satisfies **AC-11**

## Consequences

**Positive**:
- The catalogue gains its first way to grow from the app itself, so the product is no longer read only.
- Almost all of the riskier work is already done and proven (the write path, the validation, the slug retry, the catalogue read), so this slice is small and mostly UI.
- Reusing `createSkill` and `validateCreateSkillInput` means one place decides what a valid skill is, and the form can never drift from the server.
- The design system gains its first real form, which proves the input, label and alert treatment the way the catalogue proved the cards.

**Negative / tradeoffs**:
- The form makes no client side validation, so a submit always costs a server round trip before the user sees a field error. On a slow connection that feels sluggish, and it is a deliberate trade for not duplicating the rules.
- The description is a plain textarea with no preview, so a user writing markdown cannot see how it will render before publishing. A preview is left to a later slice.
- Draft state lives only in React state, so a reload or a crash loses the typed contents. This slice adds no leave guard (neither a router guard nor a `beforeunload` one), so an accidental in app navigation also loses the form; adding one is left to Follow-up.
- Any signed in user can publish with no quota or rate limit, so the catalogue could be flooded. Moderation (scope feature 7) is where that is addressed.
- The new route depends on TanStack Router's static over parameter ranking. If someone later restructures the skills routes and breaks that, `/skills/new` would try to load a skill named `new`; the spec and a comment on the route are the guard.

**Neutral**:
- No migration and no data change, so there is no rollback risk.
- The `new` slug is effectively reserved for the route rather than for a skill. A skill slugified to `new` is shadowed at `/skills/new` by the publish page (its detail read still works, but that path shows the form), and it is reachable only through the numeric suffix the slug retry already provides. This is the intended behaviour.
- No new dependency, so nothing new to keep patched.
- The header gains a second signed in control beside the user button.

## Follow-up

- [ ] The Agent Skills and MCP discovery offer was skipped because this feature chooses no new tool; nothing to record for it.
- [ ] The description textarea has no markdown preview. If users ask for one, it can reuse the renderer spec 0004 built, but it is a separate decision.
- [ ] Publication is unlimited. When moderation lands (scope feature 7), reconsider a per author cap or a report path, and whether a hidden or draft state is needed.
- [ ] Consider a client side guard on submit (blocking only empty required fields) if the round trip latency proves annoying in practice; the server stays the authority either way.
- [ ] A leave guard for a half written form (router guard or `beforeunload`) was decided against for this slice; revisit if losing a long description becomes a real complaint.
- [ ] The `new` route reservation should be noted wherever the skills routes are documented, so a future restructuring keeps the static route winning.
- [ ] Per skill SEO metadata and the sitemap stay with scope feature 8, which is where the publish page's own title and description will be settled.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

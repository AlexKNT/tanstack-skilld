# 0006 rationale. The signed in area

## Context

> ⚠️ Premise note: the topic arrived as scope feature 4, a guarded area whose recorded "done when" is only that a signed out visitor is sent away and a signed in user sees their own skills. The design conversation widened it to four pages plus an edit path, a permanent delete, a hand built profile that includes an email verification flow, and an app wide theme switcher. Those are four independently implementable surfaces in one spec, and the theme in particular was a separately deferred scope item. It is recorded here as one feature because they share one layout, one guard, and one reason to exist, and the build plan slices them so the core (shell, list, edit, delete) can land before the extras. If this stalls part way, the honest cut is to move the profile flow and the theme system into their own spec rather than leaving milestones half true. This is flagged, not blocked: the engineer chose the wider scope deliberately when asked.

The catalogue can now be read and written: specs 0003, 0004, and 0005 shipped the store, the public pages, and the publish form. What the product still lacks is a place that belongs to the person using it. A published skill can never be corrected or retired, there is no view of your own work, and the theme the design system built is unreachable because only the `/design` gallery can add the `dark` class.

Three forces are at play. First, the identity layer already exists: Clerk holds each person's name, photo, and email, and the session middleware is installed, so an area behind sign in costs no new identity work. Second, the store already carries `author_id` on every skill, so "my skills" is a filter away rather than a new model. Third, the publish flow already decided what a valid skill is, in one shared module, so an edit path can reuse those rules rather than invent a second definition.

What happens without this decision: the product stays read only for its own authors. A typo in a published description is permanent, a skill that should be retired stays in the catalogue, and the dark palette remains a gallery curiosity. The scope also names the guard as the thing later slices lean on, so upvotes and moderation would each build their own gate if this one does not land.

Two smaller forces shape the build. The area is the first feature that guards a group of routes rather than a single one, so the guard the publish feature wrote needs to generalize instead of being copied. And the theme touches the root document and the shared header, so its blast radius is every page even though its surface area is small.

The skill data model (spec 0003) and the session model (the authentication foundation) are the prerequisites, and both exist as specs, so no assumption here is unsupported.

## Options considered

### Option 1: A nested, server guarded area with our own pages, our own skill management, our own profile page, and a cookie backed theme

Four file routes under one layout route whose `beforeLoad` awaits a generalized guard server function. The skill list reads a new author filtered query. Edit reuses the publish rules and freezes the slug. Delete is permanent behind a modal. The profile page is hand built against Clerk's client SDK, including the email verification steps. The theme choice lives in a cookie the server reads, so the root document renders the right class on the first paint.

**Pros**:
- One layout, one guard, and one field rule module, so later slices inherit all three.
- The area keeps the app's own layout and design system rather than handing the profile to a Clerk modal, so the four pages feel like one product.
- The theme system lands where the design system always intended it, and the server read removes the flash that a client only approach would show.
- Reuses nearly everything: the table, the write validation, the card grid pattern, the date helper, the state surfaces.

**Cons**:
- The widest slice so far: four pages, two write paths, an external verification flow, and a change to the root document.
- The theme and the header are shared by every route, so a defect there is app wide.
- The email verification flow is hand built, so its error states are ours to get right and to test.

### Option 2: A minimal area: the guard and the my skills list only

Ship the layout, the guard, and the list of your own skills, and leave edit, delete, the profile, and the theme to later slices. This is the narrowest reading of the scope row, which only asks that a signed out visitor is sent away and a signed in user sees their own skills.

**Pros**:
- Smallest risk and fastest to a shippable state, matching the scope's recorded done when exactly.
- The guard and the author filtered read are the genuinely load bearing parts, and they are proven with little else in flight.
- Nothing touches the root document or the header, so the blast radius stays inside the new routes.

**Cons**:
- A list you cannot act on is a dead end: the author sees a typo and still cannot fix it, which was the most obvious gap this feature was meant to close.
- The theme switcher stays unreachable, and the dark palette keeps waiting.
- Three of the four pages the engineer asked for would not exist, so the answer would be to a different question.

### Option 3: The area shell plus Clerk's prebuilt profile, with the theme switcher left deferred

Guard the area, add the skill list, and host Clerk's own `UserProfile` component for the profile page (name, photo, email change, password, and connected accounts, styled by the shadcn theme already wired). Leave the theme switcher deferred as the scope records it.

**Pros**:
- The profile surface, including the email verification flow, is Clerk's to maintain rather than ours, which removes the most failure prone part of Option 1.
- Immediately consistent with the `UserButton` menu, which already opens the same component.
- Smallest remaining build once the area shell exists.

**Cons**:
- The profile page would look and behave like a Clerk screen inside our layout, so the area stops feeling like one product, and its typography and spacing are only as close as the theme allows.
- The theme switcher, which the design system anticipated and which is cheap once the tokens exist, stays unreachable for another slice.
- It duplicates a surface the header already reaches, so the signed in user finds the same screen in two places.

### Option 4: A client only area with no nested layout

One `/account` page with client side tabs and a client side sign in check, no shared route layout, and no server guard.

**Pros**:
- Fewest new route concepts: one file, one component, no layout inheritance to reason about.
- Fastest to write, and the client already has Clerk's user object for free.

**Cons**:
- The area's HTML would be produced for signed out visitors and then hidden in the browser, which is exactly what the scope's "guarded on the server" asks us not to do.
- Each tab would repeat its own guard and data loading, so the later slices would copy the pattern rather than inherit it.
- It contradicts the router and start conventions the project already follows (a guard is a server function, not a client check), so it would fight the installed skills rather than use them.

## Rationale

Option 1 is chosen. The deciding force is the scope row itself: it asks for a group of pages sharing one nested layout and guarded on the server, which is a description of a layout route with a server side gate, not of a single page with a client check (Option 4 fails this outright). Between the remaining three, the engineer's answers during the design conversation settled the width: they chose all four pages, full management of their own skills, an editable profile including an email change, and the theme choice. Option 2 was the narrower reading and was declined, and Option 3 was declined at the profile step in favour of a hand built page, so the area keeps one look and one navigation (basis: the engineer's answers in the staged conversation, profile build step).

The sub decisions inside Option 1 were made as follows, each with the runner up named.

**Where the ownership check lives.** One query layer helper resolves a slug for a given author and returns `undefined` when the row is missing or owned by another author, and all three functions built on top of it inherit that answer. The runner up was to repeat the comparison in each server function, which reads more plainly at each call site but gives the same rule three homes and guarantees that a fourth write path will one day forget it. One home was chosen because the rule is the security boundary, and a boundary with three copies is a boundary with three chances to get it wrong (basis: the existing `src/db/queries.ts` boundary convention, where driver errors are turned into returned failures in one place).

**The guard takes a return path rather than a constant.** The publish feature hardcoded `/skills/new` in `ensureSignedIn`, which cannot serve a group of routes. The guard now takes the current location and validates it as an in app path before using it, and the publish route passes its own path. The runner up was one guard per route, each with its own constant, which would have been five copies of the same function and five places to keep the redirect shape right. The chosen shape also keeps the client supplied value safe, because the path is validated to start with `/` and not `//`, so it cannot bounce a user off site (basis: the existing `readRedirectTarget` guard in `src/routes/sign-in.$.tsx` makes exactly this check today).

**The theme lives in a cookie the server reads.** A cookie lets the first paint be right, because the server can render the class into the HTML, which a `localStorage` approach cannot do without an extra blocking script. The runner up was `localStorage` plus an inline script, which is the common pattern but means the theme is decided after the document starts and risks a flash. A third option, storing the choice in Clerk's user metadata, was set aside because it costs a Clerk write for a purely cosmetic choice and would not help a signed out visitor at all. The system choice still needs a small inline script, because no server can know a device's preference, so the cookie covers the two explicit choices and the script covers the third before paint (basis: TanStack Start's `getCookie` server primitive, verified in the Clerk and TanStack documentation linked below). The write is a browser side `document.cookie` write, because the framework offers no client setter, and the class is toggled on the root element at once so no reload is needed; the server read is only what makes the first paint right. That creates one wiring risk worth naming: the root document element renders in `shellComponent`, not inside a route component, so the resolved choice has to reach it through router context, which is why the build plan proves that wiring before the rest of the theme work rather than after it.

**The list is ordered by recently updated.** The engineer chose this over newest created. It surfaces what was just worked on, which matches the job of an author's own page, at the cost of a stable order: an edit moves a row to the top, and a row edited during paging can shift between pages. The order is served by the new composite index, so the read does not sort in memory, and the tradeoff is recorded in the spec's Consequences rather than hidden.

**Delete is permanent, behind a modal.** The engineer chose a permanent delete with a confirmation over a soft delete. A soft delete would need a new column and would overlap the moderation feature, which is where hiding belongs, and the design brief says soft deletes pollute queries and break unique constraints (basis: the feature mode guidance against soft deletes, and the scope's separate moderation feature 7). The modal is a new primitive because the design system has no dialog yet, and it is the right home for a destructive confirm rather than an inline two step control that a stray click can reach.

**The profile page is hand built, and the photo is checked before upload.** The engineer chose a hand built page over Clerk's prebuilt `UserProfile`, which means the email verification flow is ours: add the address, send the code, verify it, then make it primary as a separate step. The runner up, Clerk's component, would have removed the most failure prone part of the work, and is recorded as a Follow-up rather than discarded. The photo is checked in the browser for type and a 5 MB ceiling so the common mistakes get an instant, friendly message, with Clerk kept as the final authority so the browser check can never let something through that Clerk would refuse.

**What was reused rather than rebuilt.** The write validation, the field labels and hints, the date helper, the card grid and its paging shape, the state surfaces (`Skeleton`, `Empty`, `Alert`), the `Result` and `Failure` types, and the `SKILL_NOT_FOUND` code all already exist and are used unchanged. Two candidates were reused rather than extended: `listSkillCards` could have taken an optional author filter, which was rejected because a public read that accepts an author would blur the line between the catalogue and the area, and `skillDetailQueryOptions` could have served the edit page, which was rejected because the edit read must be ownership checked and must return the fields the public card omits.

## Evidence from the documentation check

A single read only research pass verified the external API shapes this spec depends on. Recorded compactly so the build does not have to re search.

**Clerk client side user writing** (all methods live on the `user` object from `useUser()`):

- Name: `user.update({ firstName, lastName })`, which refreshes the client `user` object automatically.
- Photo: `user.setProfileImage({ file })`, taking a `File` in the browser; passing `{ file: null }` removes the image. Clerk's ceiling is 10 MB, and an oversized upload comes back with the code `image_too_large` (status 413), a wrong type with `request_body_invalid`.
- Email change, in order: `user.createEmailAddress({ email })`, then `user.reload()` and re find the address on `user.emailAddresses` by its id, then `emailAddress.prepareVerification({ strategy: "email_code" })`, then `emailAddress.attemptVerification({ code })`, and later `user.update({ primaryEmailAddressId: emailAddress.id })` to make the verified address primary. An address must be verified before it can be primary.
- Status and errors: `emailAddress.verification.status` is one of `unverified`, `verified`, `transferable`, `failed`, or `expired`. Failures are thrown as a `ClerkAPIResponseError`, whose `errors` array carries a `code`: `form_code_incorrect` for a wrong code, `verification_expired` for an expired one, `verification_failed` after too many attempts, and `form_identifier_exists` when the address already belongs to an account. Detect it with `isClerkAPIResponseError()` from `@clerk/tanstack-react-start/errors`.

**TanStack Start cookies**: `getCookie`, `setCookie`, and `setResponseHeader` come from `@tanstack/react-start/server`. `beforeLoad` and loaders are isomorphic (they also run in the browser), so a cookie must be read inside a server function and never directly in `beforeLoad`. This is why the theme read is its own server function and why the existing guard already takes the same shape.

**TanStack Router layout routes**: a route file with no leading underscore and children in the tree (`account.tsx` plus `account.index.tsx` and siblings) provides the shared layout, and `beforeLoad` on the parent runs before every child's, so one gate covers the group. The current location inside `beforeLoad` is available as a parsed location with `pathname` and `searchStr`, and the root relative form of those two is what the guard passes as the return path. The absolute `href` is deliberately not used, because the existing `readRedirectTarget` check in `sign-in.$.tsx` only accepts a value that starts with `/`, so an absolute URL would be rejected and the return path silently dropped.

## References

**Project sources** (verifiable, in this repo):
- `AGENTS.md`, for the stack, the folder by feature rule, the strict type rules, and the accessibility baseline
- `design.md`, for the design direction, the composition patterns, and the note that both themes are first class
- spec 0003 (`docs/specs/0003-skill-data-model/index.md`), the `skills` table and its rules, including the `updated_at` rule this spec finally builds
- spec 0004 (`docs/specs/0004-skill-catalogue/index.md`), the card grid, the paging shape, the date helper, `SKILL_NOT_FOUND`, and the state surfaces
- spec 0005 (`docs/specs/0005-publish-a-skill/index.md`), the `ensureSignedIn` guard, the field rules, the field wrapper, and the analytics ordering pattern
- spec 0002 (`docs/specs/0002-design-system/index.md`), the token map and the dark palette
- `src/db/queries.ts`, `src/features/skills/data.ts`, `src/features/skills/auth.ts`, `src/features/skills/query.ts`, `src/routes/sign-in.$.tsx`, `src/components/site-header.tsx`

**Practices & standards**:
- Server side authorization: never trust a client supplied identity, and re check the session on every write rather than only at the route gate
- Ownership answers should not leak existence: a resource that is not yours reads as not found, not as forbidden
- Unvalidated cookie values are untrusted input and must be constrained to an allow list before they reach rendering
- Soft deletes are a last resort: they pollute queries and break unique constraints, so hiding belongs with moderation and permanent deletion belongs with the owner
- Paginate every list, and page with a stable order or accept and document the instability

**Links** (web verified during the design conversation):
- Clerk user object, TanStack Start: https://clerk.com/docs/tanstack-react-start/reference/objects/user
- Clerk email address type: https://clerk.com/docs/tanstack-react-start/types/email-address
- Clerk verification resource type: https://clerk.com/docs/tanstack-react-start/types/verification-resource
- Clerk API response error type: https://clerk.com/docs/tanstack-react-start/reference/types/clerk-api-response-error
- Clerk custom flow, adding an email address: https://clerk.com/docs/guides/development/custom-flows/account-updates/add-email
- TanStack Start server functions (including the cookies primitives): https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- TanStack Router route options (the `beforeLoad` contract): https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType
- TanStack Router parsed location (the `href` property): https://tanstack.com/router/latest/docs/framework/react/api/router/ParsedLocationType
- TanStack Router routing concepts (layouts and nesting): https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts

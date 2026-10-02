# 0005. Publish a skill from a form: rationale

## Context

The catalogue (spec 0004) reads real skills from the store and shows them on the home page and on a detail page, but nothing in the app can put a skill there. Every row today arrives from the seed script. The data model (spec 0003) already built the write path: the `skills` table, the `createSkill` server function that takes the author from the session and derives the slug, the validation rules in `validateCreateSkillInput`, and the insert with its unique slug retry. What is missing is the surface a person uses to reach that write path.

The forces at play are mostly about reuse and restraint. The project is a learning build on a deliberately chosen stack (TanStack Start, Clerk, Drizzle, TanStack Query, shadcn/ui), so a feature that invents a new way to write skills, duplicates the validation in the browser, or adds a form library would work against the point of building on this stack. The scope row for this feature says a signed in user adds a skill through a form and it shows up in the catalogue, with clear field level errors for invalid input, which is a small surface that the existing write path already covers almost entirely.

Two constraints shape the design. First, the catalogue is public and the write is not, so the split between what anyone may do and what only a signed in user may do has to be enforced on the server, not only hidden in the interface. Second, the description is untrusted markdown that the detail page already renders through a sanitizer, so the publish form must not open a second, unguarded path for that content to reach a page. The consequence of not deciding the shape here is that `/develop` would invent a form structure, a validation approach and a guard mechanism on the fly, each of which would then be the de facto convention for later write features (upvotes, moderation) without ever being weighed.

## Options considered

### Option 1: A dedicated `/skills/new` page with a controlled form on the existing write path (chosen)

A new route renders one `Card` holding four controlled inputs, submitting through `useMutation` to the existing `createSkill`, mapping the returned field errors to the inputs, and redirecting to the new skill on success. The route is guarded on the server.

**Pros**:
- Reuses the entire write path and validation, so there is one definition of a valid skill and no drift between client and server.
- No new dependency; the form is plain React state and the query layer spec 0004 built.
- A URL is shareable, bookmarkable and guardable on the server, which the guard requirement needs.
- The redirect to the detail page is self evident proof that the skill was saved.

**Cons**:
- A submit always costs a server round trip before a field error shows; no instant client feedback.
- A dedicated page is slightly more routing to add than an inline form or a dialog.

### Option 2: A dialog or sheet over the catalogue

The form opens in a modal over the home page, so the user never leaves the catalogue.

**Pros**:
- Keeps the user on the catalogue visually.
- Feels light for a short form.

**Cons**:
- No `Dialog` or `Sheet` primitive exists yet, so it means installing registry components and their accessibility plumbing first.
- A modal has no URL, so it cannot be guarded by a server redirect or deep linked, which the signed out guard wants.
- A four field form with a long description is cramped in a modal and awkward on mobile.

### Option 3: An inline form always present on the home page

The form sits below the catalogue intro, visible whenever a signed in user is on the home page.

**Pros**:
- The fewest moving parts: no new route, no redirect.
- Publishing is immediately discoverable.

**Cons**:
- Crowds the browse experience for the many visitors who never publish.
- Signed out visitors would still render the form unless it is hidden, and hiding it still leaves a direct URL with no guard to build.
- Mixes two concerns (browse the catalogue, write a skill) on the product's most important page.

## Rationale

Option 1 wins because the feature is almost entirely a UI problem sitting on a solved server problem, and Option 1 is the shape that touches the least while keeping the guard and the reuse it needs. `createSkill` already accepts exactly the four fields the form collects, takes the author from the session, validates, and retries a clashing slug, so the form does not need a new server function, a form library, or a second copy of the validation rules. Keeping the rules in one place (the server) is the specific force that rules out duplicating them on the client; the cost is the round trip, and that is a conscious trade rather than an oversight.

The dedicated page beats the dialog and the inline form because of the guard requirement. The scope row asks that only a signed in user publishes, and the honest way to enforce that on this stack is a server redirect before the route renders, which needs a URL. A dialog has none, and an inline form would either show to everyone or need the same guard logic built around a component that is not a route. The page also matches the catalogue's own URL style and gives `/develop` a clear, testable acceptance criterion (a signed out visitor is redirected and returned).

The routing collision with `/skills/$slug` is the one sharp edge, and it is resolved by the router's own rule rather than a workaround: TanStack Router ranks a static segment above a parameter segment, so `/skills/new` always resolves to the form. Reserving the `new` slug inside the detail route would push the problem into a guard that is easier to get wrong, and moving to a `/publish` path would trade a small naming tidiness for a second namespace. Keeping `/skills/new` with the collision documented is the smallest correct answer.

## References

No references were recorded for this decision (the engineer chose to keep the spec clean, and this feature chooses no new tool or provider, so there is nothing to verify on the web). The reasoning rests on the constraints named in Context: the project's existing stack and conventions in `AGENTS.md`, the write path and validation shipped in spec 0003, the catalogue read and sanitized renderer shipped in spec 0004, and the design system shipped in spec 0002.

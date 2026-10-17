# Scope: Skild

A learning build of the JavaScript Mastery Skild tutorial: a place where people discover and share AI agent skills. You build it to learn TanStack Start, Clerk, and the workflow around them.

**Build approach:** Tracer Bullet (prove the whole pipe works end to end before building any one part fully).
**Workflow:** Alpha (`/check verify` after `/develop`, no separate test suite by default). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Stack & architecture | Foundation | existing |
| B | Authentication & accounts | Foundation | existing |
| C | Product analytics | Foundation | existing |
| D | Coding standards & tooling | Foundation | done |
| E | Design system & UI foundation | Foundation | done |
| 1 | Skill data model | Slice 1 | done |
| 2 | Skill catalogue | Slice 1 | done |
| 3 | Publish a skill | Slice 2 | done |
| 4 | Signed in area | Slice 3 | in-progress |
| 5 | Upvotes | Slice 4 | done |
| 6 | Search and filter | Slice 5 | in-progress |
| 7 | Moderation | Slice 6 | done |
| 8 | SEO metadata and sitemap | Hardening | in-progress |
| 9 | Cookie notice and legal pages | Hardening | planned |
| 10 | Deploy | Ship | planned |

## Foundations

### A. Stack & architecture · existing
Scaffolded TanStack Start app on the decided stack, booting locally and building cleanly. code in `./`

### B. Authentication & accounts · existing
Clerk sign in, sign up, session middleware, and header controls, wired to the shadcn theme. code in `src/start.ts`, `src/routes/sign-in.$.tsx`, `src/routes/sign-up.$.tsx`, `src/components/site-header.tsx`

### C. Product analytics · existing
PostHog on the EU host, identifying the signed in user and capturing sign in and sign up intent. code in `src/routes/__root.tsx`

### D. Coding standards & tooling · done
Conventions are captured in `AGENTS.md`, and the pre commit hook and the CI workflow are now installed.
**Done when:** lint, format, typecheck, and the test command all pass on a clean checkout, and a push runs them.
- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`
- [x] Verify it runs clean: `/check verify tooling`
code in `.husky/pre-commit`, `.github/workflows/ci.yml`

### E. Design system & UI foundation · done
Theme tokens, Tailwind CSS 4, and shadcn/ui are wired up, and only the button primitive exists so far.
**Done when:** the primitives the catalogue needs exist and meet the accessibility baseline.
- [x] Design it (spec): `/architect design system & UI foundation`
- [x] Build it: `/develop design system & UI foundation`
  - [x] Map the shadcn tokens onto the Skild palette and fix the two contrast failures (AC-1, AC-4, AC-6)
  - [x] Clean the styling layer: dead classes out, one `cn` helper (AC-7)
  - [x] Install the eight primitives: Card, Badge, Avatar, Separator, Skeleton, Empty, Alert, Spinner (AC-2, AC-3)
  - [x] Add the gallery route, then the visual and keyboard walk in both themes (AC-4, AC-5)
  - [x] Record the direction in `design.md` (AC-8)
- [x] Verify they render and are keyboard reachable: `/check verify design system & UI foundation`
spec [0002](../specs/0002-design-system/index.md) · code in `src/styles.css`, `src/components/ui/`, `src/routes/design.tsx`

## Slice 1: Read the catalogue on real data

### 1. Skill data model · done
Define the skill and owner shapes and where they live, with the read and write queries every later slice leans on.
**Done when:** skills and owners are stored, typed end to end, and one server function can read the list and write a skill.
- [x] Design it (spec): `/architect skill data model`
- [x] Build it: `/develop skill data model`
  - [x] Stand up the store: Drizzle, the connection, the `skills` table with its rules, and the inferred types (AC-1, AC-2, AC-7)
  - [x] Read path end to end: the bounded `listSkills` query and server function, plus the seed and a proven read (AC-3, AC-9)
  - [x] Write path end to end: the slug helper, the `createSkill` function reading the Clerk session, and the clash retry (AC-4, AC-5, AC-6)
  - [x] Failures and limits: explicit failure codes, field validation, and the description and link rules (AC-8)
  - [x] Prove it against a hosted Postgres with the connection string kept out of the repo (AC-10)
- [x] Verify it: `/check verify skill data model`
spec [0003](../specs/0003-skill-data-model/index.md) · code in `src/db/`, `src/features/skills/`, `scripts/seed.ts`, `drizzle/`, `drizzle.config.ts`

### 2. Skill catalogue · done
The home list of skill cards and the detail page for a single skill, reading real data. This is the first real thread through UI, server, and store.
**Done when:** the home page lists skills from the store with loading, empty, and error states, and a card opens a detail page at its own URL.
- [x] Design it (spec): `/architect skill catalogue`
- [x] Build it: `/develop skill catalogue`
  - [x] Read layer and the two public server functions (AC-6, AC-10)
  - [x] Thin thread: the home list and the detail route on real data (AC-1, AC-4)
  - [x] Cards, publishers and the sanitized markdown body (AC-1, AC-2, AC-3, AC-4, AC-5, AC-9, AC-11)
  - [x] Load more paging and the loading, empty and error states (AC-7, AC-8, AC-12)
  - [x] The 404 path, the accessibility pass and the boundary check (AC-6, AC-11, AC-13)
- [x] Verify it: `/check verify skill catalogue`
spec [0004](../specs/0004-skill-catalogue/index.md) · code in `src/features/skills/`, `src/routes/index.tsx`, `src/routes/skills.$slug.tsx`

## Slice 2: Contribute

### 3. Publish a skill · done
A signed in user adds a skill through a form, and it shows up in the catalogue.
**Done when:** a signed in user can submit a valid skill, see it in the catalogue, and gets clear field level errors for invalid input.
- [x] Design it (spec): `/architect publish a skill`
- [x] Build it: `/develop publish a skill`
  - [x] Route shell and the thin thread: `/skills/new` renders the form, and a controlled submit reaches `createSkill` and returns (AC-1, AC-3, AC-10)
  - [x] Success path and the guard: invalidate the catalogue then redirect to the new detail page, and guard the route on the server with the return path preserved (AC-3, AC-4, AC-2)
  - [x] Field errors, hints and the states: the labelled field wrapper, `fieldErrors` from the server result, the announced message, the hints from the shared constants, and the failure and pending states (AC-5, AC-6, AC-7, AC-9)
  - [x] Entry point and analytics: the header publish button and the two PostHog events in the fixed order (AC-1, AC-8)
  - [x] Accessibility pass and the boundary check: labels, focus, heading order, 320px, and no schema change (AC-9, AC-11)
- [x] Verify it: `/check verify publish a skill`
spec [0005](../specs/0005-publish-a-skill/index.md) · code in `src/routes/skills.new.tsx`, `src/features/skills/auth.ts`, `src/features/skills/components/publish-skill-form.tsx`, `src/features/skills/components/publish-form-field.tsx`, `src/components/site-header.tsx`, `src/routes/sign-in.$.tsx`

## Slice 3: Your own space

### 4. Signed in area · in-progress
A group of pages behind sign in, sharing one nested layout and guarded on the server so an unauthenticated request never reaches them.
**Done when:** a signed out visitor is sent away from the area, and a signed in user sees their own skills there.
- [x] Design it (spec): `/architect signed in area`
- [x] Build it: `/develop signed in area`
  - [x] The area shell, the guard, and the my skills read end to end (AC-1, AC-2, AC-5, AC-6, AC-7, AC-19)
  - [x] The overview and the header entry points (AC-3, AC-4)
  - [x] Edit and delete a skill, with the failure states and the leave guard (AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14)
  - [x] The profile page and its name, photo, and email flows (AC-15)
  - [x] The theme system, the settings page, the analytics, and the accessibility pass (AC-16, AC-17, AC-18, AC-20)
- [ ] Verify it: `/check verify signed in area`
spec [0006](../specs/0006-signed-in-area/index.md) · code in `src/routes/account*.tsx`, `src/features/account/`, `src/features/theme/`, `src/features/skills/`

## Slice 4: Community signal

### 5. Upvotes · done
Signed in users upvote a skill once, and the count shows on cards and on the detail page.
**Done when:** an upvote persists, the count updates, a second upvote does not count twice, and signed out visitors see the count but cannot vote.
- [x] Design it (spec): `/architect upvotes`
- [x] Build it: `/develop upvotes`
  - [x] The vote in the store and the reads that carry it (AC-1, AC-2, AC-5, AC-6, AC-12, AC-15, AC-16)
  - [x] The thin thread: a vote from the detail page and from a card, on real data (AC-3, AC-4, AC-10)
  - [x] The cache rules, the rollback, and the signed out path (AC-7, AC-8, AC-9, AC-11)
  - [x] Accessibility, the event, and the verification pass (AC-11, AC-13, AC-14)
- [x] Verify it: `/check verify upvotes`
spec [0007](../specs/0007-upvotes/index.md) · code in `src/db/schema.ts`, `src/db/queries.ts`, `src/features/skills/`, `src/routes/index.tsx`, `src/routes/skills.$slug.tsx`

## Slice 5: Find skills

### 6. Search and filter · in-progress
Narrow the catalogue by text and by tag, with the choice in the URL so a filtered view can be shared.
**Done when:** the list filters as the user types or picks a tag, the URL carries the filter, and an empty result renders a helpful state.
- [x] Design it (spec): `/architect search and filter`
- [x] Build it: `/develop search and filter`
  - [x] The store change and the shared tag rule (AC-1, AC-2, AC-7)
  - [x] The filter end to end: the read takes a term and a tag, and the address carries both (AC-5, AC-6, AC-8, AC-10)
  - [x] Tags end to end: both forms collect them, and the cards and the detail page show them (AC-3, AC-4)
  - [x] The filter's interface: the box, the chips, the pacing, the empty surface and the announcement (AC-9, AC-11, AC-12, AC-13, AC-15)
  - [x] The event, the accessibility pass and the boundary check (AC-13, AC-14, AC-16)
- [ ] Verify it: `/check verify search and filter`
spec [0008](../specs/0008-search-and-filter/index.md) · code in `src/features/skills/`, `src/hooks/`, `src/db/schema.ts`, `src/db/queries.ts`, `src/routes/index.tsx`, `drizzle/`

## Slice 6: Keep it tidy

### 7. Moderation · done
An owner or an admin can hide a skill that breaks the rules, and a hidden skill leaves the public catalogue.
**Done when:** an authorised user can hide and restore a skill, and a hidden skill never appears in the public list or on its detail page.
- [x] Design it (spec): `/architect moderation`
- [x] Build it: `/develop moderation`
  - [x] The state and the store: the migration, the visibility write with its authority inside the filter, and the public reads closed (AC-1, AC-2, AC-5, AC-7, AC-8, AC-9, AC-10)
  - [x] The thin thread: the write, the author check, and one hide control on the owner's own card, on real data (AC-3, AC-4, AC-13, AC-19)
  - [x] The admin role and the admin area: the Clerk metadata role, the guarded `/admin/skills` list, and its filter (AC-6, AC-16, AC-17, AC-18)
  - [x] The author's surfaces: the hidden badge with the reason, the two counts, the restore rules, the hidden state on the edit form (AC-11, AC-12, AC-14, AC-15)
  - [x] The polish pass: the shared dialog, the messages, the announcements, the cache settling, the event, and the accessibility walk (AC-20, AC-21, AC-22)
- [x] Verify it: `/check verify moderation`
spec [0009](../specs/0009-moderation/index.md)

## Hardening

### 8. SEO metadata and sitemap · in-progress
Per page titles and descriptions, plus a sitemap covering the public pages.
**Done when:** every public page has a unique title and description, and a sitemap lists the public URLs.
- [x] Design it (spec): `/architect SEO metadata and sitemap`
- [x] Build it: `/develop SEO metadata and sitemap`
  - [x] The thin thread: both crawl routes answering, the site address read and validated, and the home page's title and description in the server rendered HTML (AC-1, AC-6, AC-10, AC-14)
  - [x] Metadata on the pages that need it: the skill page's own title and description, the social tags, the filtered view's rule, and the one middleware noindex rule for the private paths (AC-2, AC-3, AC-4, AC-5, AC-12)
  - [x] The crawl files thickened: the published entries through the shared visibility rule, the date only lastmod, the cache headers, the 503 path when the read fails, and the host rule (AC-7, AC-8, AC-9, AC-11)
  - [x] The structured data on skill pages, then the crawl and quality pass on both a production host and a local one (AC-13, all)
- [ ] Verify it: `/check verify SEO metadata and sitemap`
spec [0010](../specs/0010-seo-metadata-and-sitemap/index.md) · code in `src/features/seo/`, `src/routes/sitemap[.]xml.ts`, `src/routes/robots[.]txt.ts`, `src/start.ts`, `src/routes/index.tsx`, `src/routes/skills.$slug.tsx`, `src/db/queries.ts`

### 9. Cookie notice and legal pages · needs a decision
A consent notice for the analytics cookies, and simple privacy and terms pages.
**Done when:** a first time visitor can accept or decline analytics cookies, the choice persists across visits, and privacy and terms pages are reachable from the footer.
- [ ] Design it (spec): `/architect cookie notice and legal pages`

## Ship

### 10. Deploy · needs a decision
Put the app on a host with its environment variables and a first production build.
**Done when:** the app is reachable at a public URL, sign in works there, and analytics events arrive.
- [ ] Design it (spec): `/architect deploy`

## Deferred
Out of scope for this build pass, kept so the plan stays honest.
- **Image upload**: let a skill carry a logo or screenshot · needs a decision
- **Comments**: discussion on a skill page · needs a decision
- **Theme switcher**: let a visitor pick light or dark, with the choice remembered · from spec 0002 · needs a decision
- **Upvoted skills list**: a page in the account area listing the skills you upvoted · from spec 0007 · needs a decision
- **Tag landing page**: one page per tag, listing the skills that carry it · from spec 0008 · needs a decision
- **Report a skill**: a visitor flags a skill for an admin to review · from spec 0009 · needs a decision
- **Share image**: one static image for the whole site, then the `og:image` tag and the large social card · from spec 0010 · needs a decision
- **Publisher written search description**: let a publisher write the description a search engine shows, for when the stored summary is too long for a snippet · from spec 0010 · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box.

**Feature lifecycle:**

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked, spec linked, `Build it: /develop <feature>` with 2 to 5 milestones |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one, code pointer filled |
| `done` | you, when you decide it is | the tier's last stage is the suggested point to call it done |

- **Next step** = the first unticked box, always a command or a tracked milestone.
- **Atomic build tasks live in the spec, not here.** The scope carries only the milestone rollup.
- **Status:** `planned`, `in-progress`, `done`, plus `existing` (built before the workflow) and `dropped` (dropped from scope, kept for history).
- **Workflow:** `Alpha` means `/check verify` after `/develop`. Add a tag beside a heading (e.g. `· GA`) to do more or less on one feature.
- **Pointer line** (`spec <n> · code in <path>`) appears only once the spec or the code exists.

## References

**Project sources**
- The JavaScript Mastery Skild tutorial (`adrianhajdin/skild`), for the feature set and the order they are introduced in.
- `AGENTS.md`, for the stack, the conventions, and the tooling choices recorded by `/audit`.

**Practices & standards**
- Vertical slices ship real value early and retire the risk that the layers do not connect.
- Foundations before features: the data model is the costliest thing to redo, so it lands before the pages that read it.
- WCAG AA on UI, per the accessibility baseline in `AGENTS.md`.
- Prefer recording a decision over guessing at one, since an unflagged decision is the expensive miss.

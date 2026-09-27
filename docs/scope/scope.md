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
| E | Design system & UI foundation | Foundation | in-progress |
| 1 | Skill data model | Slice 1 | planned |
| 2 | Skill catalogue | Slice 1 | planned |
| 3 | Publish a skill | Slice 2 | planned |
| 4 | Signed in area | Slice 3 | planned |
| 5 | Upvotes | Slice 4 | planned |
| 6 | Search and filter | Slice 5 | planned |
| 7 | Moderation | Slice 6 | planned |
| 8 | SEO metadata and sitemap | Hardening | planned |
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

### E. Design system & UI foundation · in-progress
Theme tokens, Tailwind CSS 4, and shadcn/ui are wired up, and only the button primitive exists so far.
**Done when:** the primitives the catalogue needs exist and meet the accessibility baseline.
- [x] Design it (spec): `/architect design system & UI foundation`
- [ ] Build it: `/develop design system & UI foundation`
  - [ ] Map the shadcn tokens onto the Skild palette and fix the two contrast failures (AC-1, AC-4, AC-6)
  - [ ] Clean the styling layer: dead classes out, one `cn` helper (AC-7)
  - [ ] Install the eight primitives: Card, Badge, Avatar, Separator, Skeleton, Empty, Alert, Spinner (AC-2, AC-3)
  - [ ] Add the gallery route, then the visual and keyboard walk in both themes (AC-4, AC-5)
  - [ ] Record the direction in `design.md` (AC-8)
- [ ] Verify they render and are keyboard reachable: `/check verify design system & UI foundation`
spec [0002](../specs/0002-design-system/index.md) · code in `src/styles.css`, `src/components/ui/`, `src/routes/design.tsx`

## Slice 1: Read the catalogue on real data

### 1. Skill data model · needs a decision
Define the skill and owner shapes and where they live, with the read and write queries every later slice leans on.
**Done when:** skills and owners are stored, typed end to end, and one server function can read the list and write a skill.
- [ ] Design it (spec): `/architect skill data model`

### 2. Skill catalogue · needs a decision
The home list of skill cards and the detail page for a single skill, reading real data. This is the first real thread through UI, server, and store.
**Done when:** the home page lists skills from the store with loading, empty, and error states, and a card opens a detail page at its own URL.
- [ ] Design it (spec): `/architect skill catalogue`

## Slice 2: Contribute

### 3. Publish a skill · needs a decision
A signed in user adds a skill through a form, and it shows up in the catalogue.
**Done when:** a signed in user can submit a valid skill, see it in the catalogue, and gets clear field level errors for invalid input.
- [ ] Design it (spec): `/architect publish a skill`

## Slice 3: Your own space

### 4. Signed in area · needs a decision
A group of pages behind sign in, sharing one nested layout and guarded on the server so an unauthenticated request never reaches them.
**Done when:** a signed out visitor is sent away from the area, and a signed in user sees their own skills there.
- [ ] Design it (spec): `/architect signed in area`

## Slice 4: Community signal

### 5. Upvotes · needs a decision
Signed in users upvote a skill once, and the count shows on cards and on the detail page.
**Done when:** an upvote persists, the count updates, a second upvote does not count twice, and signed out visitors see the count but cannot vote.
- [ ] Design it (spec): `/architect upvotes`

## Slice 5: Find skills

### 6. Search and filter · needs a decision
Narrow the catalogue by text and by tag, with the choice in the URL so a filtered view can be shared.
**Done when:** the list filters as the user types or picks a tag, the URL carries the filter, and an empty result renders a helpful state.
- [ ] Design it (spec): `/architect search and filter`

## Slice 6: Keep it tidy

### 7. Moderation · needs a decision
An owner or an admin can hide a skill that breaks the rules, and a hidden skill leaves the public catalogue.
**Done when:** an authorised user can hide and restore a skill, and a hidden skill never appears in the public list or on its detail page.
- [ ] Design it (spec): `/architect moderation`

## Hardening

### 8. SEO metadata and sitemap · needs a decision
Per page titles and descriptions, plus a sitemap covering the public pages.
**Done when:** every public page has a unique title and description, and a sitemap lists the public URLs.
- [ ] Design it (spec): `/architect SEO metadata and sitemap`

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

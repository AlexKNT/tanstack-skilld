# 0002 rationale. Design system and UI foundation

Decision record for [index.md](index.md). The build spec lives there; this file holds the problem, the options weighed, the reasoning and the evidence. `/develop` skips this file.

## Context

Skild grew its look in two passes that never met. The scaffold arrived with shadcn and the stock zinc values, which is what the shadcn tokens in `src/styles.css` still hold: `--primary`, `--border`, `--ring`, `--muted-foreground` and the rest are the untouched defaults. Then the pages got a real palette, the sea and lagoon family with its own light and dark values, and since that palette had no named utilities, the markup reached for it by hand (`text-[var(--lagoon-deep)]`, `bg-[var(--surface)]`, `border-[var(--line)]`). The result is two languages in one file: the brand lives in the arbitrary values, and anything that reads a shadcn token renders in zinc. That is why the primary button is near black on a teal app.

The same second pass left a layer of component classes in `src/styles.css` (`.island-shell`, `.feature-card`, `.island-kicker`, `.nav-link`, `.rise-in`, `.site-footer`, `.page-wrap`, `.display-title`) that nothing in `src/` references. It encodes real design intent, the glassy surface, the soft shadow, the underline that slides in on hover, but no surface uses it, so it has already drifted from the tokens it duplicates.

Two colours in that file also sit below the accessibility bar the project set for itself in `AGENTS.md` (WCAG AA). The global link colour measures 3.3:1 against the page background and 3.8:1 against white, where normal text needs 4.5:1, and the shadcn muted body colour measures 4.2:1 against the page background for the same reason. The app's own secondary ink passes at 5.9:1, so the failure is confined to the shadcn side and to the link rule.

The catalogue is the next thing to build, and the workflow's UI track builds a page against a `design.md` that holds the direction. No `design.md` exists, and only one primitive does (`Button`), so a catalogue build today would have to invent the art direction, the vocabulary of controls, and the colour of every control it uses. That is the gap this decision closes: one token set, one written direction, and the small set of primitives the first real slice needs.

## Options considered

### Option 1: Unify the tokens on the Skild palette, and build generic primitives (chosen)

Point the shadcn semantic names at Skild values in both theme blocks, name the missing values (the display font, one elevation step), ship the eight primitives the catalogue and the detail page need, and write the direction down in `design.md`.

**Pros**:
- One system. Every shadcn primitive and the already wired Clerk theme inherit the brand with no per component styling.
- The brand colours gain named utilities, so the arbitrary value habit (`text-[var(--lagoon-deep)]`) stops spreading.
- The two baseline failures get fixed in the same pass, because the mapping forces each pair to be measured.
- The catalogue and every later feature start from named pieces, and the measurements are recorded for the next person.

**Cons**:
- The shipped look changes: the buttons move from near black to teal.
- The tokens now point at local values, so a shadcn preset command later would overwrite them.
- More work now than adding components alone: the mapping, the measurements, the class cleanup and `design.md`.

### Option 2: Keep the two token sets side by side

Leave the shadcn tokens at their defaults and keep the sea palette for the bespoke surfaces. The catalogue primitives would read the zinc tokens and look neutral against the coloured page.

**Pros**:
- Nothing that already shipped changes appearance.
- The smallest change to `src/styles.css`, so the least risk of a surprise on a page nobody re-checked.

**Cons**:
- The catalogue would read as a different product from the page it sits on, and the split gets harder to undo with every feature built on top of it.
- The baseline failures in the link and muted colours would still need fixing somewhere.

### Option 3: Record the direction only

Write `design.md` and add the primitives on top of what exists, with no token work and no cleanup.

**Pros**:
- The fastest route to a visible catalogue.
- Nothing in the existing styling moves.

**Cons**:
- The split stays, and every later feature has to decide for itself which of the two systems it is in.
- The dead class layer keeps drifting, and the contrast failures stay on every page.

### Option 4: Unify, and build the primitives for the whole plan

The same mapping, but install everything the plan will need (form controls, dialogs, sheets, menus, search pieces) in one batch.

**Pros**:
- One decision round instead of four, and no repeat visits to the same inventory later.
- Later features start from a complete kit.

**Cons**:
- Several primitives would sit unused for weeks, shaping nothing, and would be designed against features that have not had their own decisions made yet.
- The unused pairings would drift from the features that finally use them, which is the same failure the dead class layer just demonstrated.

### Option 5: Unify, and include a skill specific card

The same mapping, plus a `SkillCard` built now against a small local prop shape (title, tagline, tags, owner, upvotes).

**Pros**:
- A visible card sooner, and the catalogue would only have to wire data into it.
- Forces the visual shape of a skill to be decided early.

**Cons**:
- The skill data model is still `needs a decision`, so a typed card would invent exactly the shape that feature 1 exists to decide, and the catalogue would then inherit a guess.

## Rationale

The deciding force is that the split is already causing visible wrongness, not just untidiness: the primary action in the header is near black on a teal app, and the brand colours only exist as arbitrary values in markup. Every feature added on top of that split makes it more expensive to close, and the catalogue is the first feature that will need a real vocabulary of surfaces. Closing it now, while the codebase is three pages and one primitive, is the cheap moment (basis: `AGENTS.md`'s preference for recording a decision over guessing at one, and the scope's foundation first ordering).

The narrow primitive set follows from the project's own delivery strategy, Tracer Bullet: the scope header declares it, and the scope's own wording for this feature is "the primitives the catalogue needs". Building the whole kit up front would produce components designed against features whose decisions are not made, which is precisely how the current dead class layer came to exist. Option 4's cost is not the install time, it is the drift.

Generic primitives rather than a `SkillCard` is the same reasoning one level down. The skill shape is the subject of feature 1, which is still `needs a decision`. A card built now would either guess that shape or be rewritten, and the catalogue's spec is the right place to decide how a skill looks on a card, with the data model in front of it.

On the colour question, the engineer's own requirement was a primary action that carries the brand, and the measurements rule out the two easy versions of it. The bright lagoon gives 2.38:1 with white text and 2.09:1 against the page, so it fails as a button fill twice over, once for its label and once for its own boundary. Filling it with dark ink instead (5.15:1) passes for the label but leaves the button barely separated from the page at 2.1:1, which is a control the eye has to hunt for. A deeper teal from the same family satisfies both tests at once (5.43:1 with white text, 4.77:1 against the page), keeps the hue the palette is built on, and leaves the bright lagoon to do what it is good at: highlights, icon accents, decorative gradients and fills that carry dark ink. The same reasoning fixed the two pre-existing failures, since a link and a muted paragraph both need 4.5:1 on the surface they sit on, and both now clear it (5.89:1 and 4.77:1 respectively, measured against the real page).

Deleting the class layer rather than keeping it as the component vocabulary follows what the code already does: every shipped surface is styled with utilities in the markup, and the classes are referenced by nothing. The one thing worth keeping is the shadow recipe from `.feature-card`, because it is genuine design intent, so it moves into `--shadow-card` as a token instead of disappearing with the class. That is the strangler instinct applied to CSS: keep the value, retire the dead code.

**Decisions I made rather than asking** (each with the runner up I set aside):
- **The `cn` helper**: use the project's own helper at `#/lib/utils`, which is what `components.json` declares and what the registry's generated files import. Runner up: keep the `cn` npm package, which would mean editing the import in every component the CLI adds, forever.
- **Elevation**: one named step, `--shadow-card`, taken from the existing `.feature-card` recipe. Runner up: cards with a border and no shadow, which loses depth the palette was designed to have.
- **The type scale**: no new `--text-*` tokens. Tailwind's own steps already form a scale and the pages use them, so the scale gets written down in `design.md` as guidance instead of duplicated as tokens. Runner up: a custom set of text tokens, which adds a layer that nothing yet needs.
- **The gallery route**: a development only route, kept as the living example of the set, because the feature's Done when line asks that the primitives render, and `/check verify` needs a surface to drive. Runner up: no route, which leaves the set unverifiable until the catalogue exists.
- **Reduced motion**: every animation the primitives carry is guarded with `prefers-reduced-motion`. Runner up: leave it, which would ship movement to people who have asked their system for none.
- **The registry's hover classes**: left exactly as the registry writes them (`hover:bg-primary/90`), so an upstream update still merges. Runner up: hand-edit them to a solid darker teal, which reads slightly better and costs a merge conflict on the next update.
- **The fonts**: keep the Google Fonts `@import` for now, with self hosting written down as a follow-up. Runner up: self host immediately, which is one more moving part in a feature that is already touching the whole style layer.
- **Two local corrections to registry files**: the focus ring draws at full strength (a half strength ring measures 1.84:1) and a destructive fill uses `text-destructive-foreground` instead of the hardcoded white the registry ships (which measures 2.77:1 on the dark red), each with a comment in the file saying why. Runner up: leave both registry class strings untouched for cleaner merges, which would ship a focus indicator and an error fill that both sit below the bar `AGENTS.md` sets.

## Evidence

Contrast measured with the WCAG relative luminance formula against the real surfaces in this app: the page background `#e7f3ec`, the card surface `#f4f8f2` (the translucent white over the page), white, the dark page `#0a1418` and the dark card `#0d1b1f`.

The page is a gradient rather than one flat colour. `#e7f3ec` is its darkest stop, which is the worst case for dark text sitting on it, so every light mode figure is measured against that stop rather than against the lighter top of the gradient. Where a control sits on a white surface instead (the outline button variant, for example), the white column applies.

**The failures this spec fixes**

| Colour | Role | Measured before | Needed |
|---|---|---|---|
| `--lagoon-deep` `#328f97` | Links and icon accents | 3.81:1 on white, 3.34:1 on the page | 4.5:1 as text |
| `--muted-foreground` `#71717b` (shadcn default) | Secondary body text | 4.83:1 on white, 4.24:1 on the page | 4.5:1 as text |

**The values that replace them**

| Colour | Role | On white | On the page | On a card |
|---|---|---|---|---|
| `#24747c` primary, links | Filled buttons, links | 5.43:1 | 4.77:1 | 5.06:1 |
| `#c2261f` destructive | Error text and error fills | 5.85:1 | 5.13:1 | 5.45:1 |
| `#6b8580` input boundary | Control edges | 3.97:1 | 3.48:1 | 3.70:1 |
| `--sea-ink-soft` `#416166` | Secondary text | 6.72:1 | 5.89:1 | 6.25:1 |

**The dark block**

| Colour | Role | On the dark page | On the dark card |
|---|---|---|---|
| `#60d7cf` primary and ring | Filled buttons, focus rings | 10.76:1 | 10.15:1 |
| `#d7ece8` body text | Body text | 15.14:1 | 14.29:1 |
| `#afcdc8` secondary text | Secondary text | 11.00:1 | 10.38:1 |
| `#f87171` destructive | Error text | 6.74:1 | 6.36:1 |
| `#4f7570` input boundary | Control edges | 3.65:1 | 3.43:1 |

**Colours deliberately kept off text**: the bright lagoon `#4fb8b2` (2.38:1 on white, 2.09:1 on the page) survives as a highlight and decoration colour only, and as a fill for dark ink, where it measures 5.15:1.

## References

**Project sources** (verifiable in this repo):
- `src/styles.css`, the token blocks and the palette values this decision maps onto
- `AGENTS.md`, for the WCAG AA baseline, the naming and folder conventions and the stack
- `components.json`, for the registry, the new-york style, the radix base and the `#/lib/utils` alias
- The `shadcn` skill at `.agents/skills/shadcn/`, for the composition rules, the semantic colour rule and the component selection table
- `docs/scope/scope.md`, feature E, its intent and its Done when line

**Practices & standards**:
- WCAG 2.2 AA contrast minimums: 4.5:1 for normal text, 3:1 for non text and focus indicators
- Semantic tokens over literal colour values, so a theme change is one edit rather than a search
- Keep the value, retire the dead code (the strangler instinct applied to a styling layer)
- Tailwind CSS 4's `@theme inline` for exposing custom properties as utilities

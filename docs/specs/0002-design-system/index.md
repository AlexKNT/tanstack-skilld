# 0002. Unify the design tokens on the Skild palette and add the catalogue primitives

**Date**: 2026-09-27
**Status**: Proposed

## Summary

Skild currently runs two colour systems side by side. The pages use the sea and lagoon palette written by hand, while the shadcn primitives read a set of stock zinc values, so the buttons render near black on a teal app and the brand colours have no named utilities. This spec maps the shadcn tokens onto the Skild palette, names the missing values (the display font and one elevation step, meaning how far a surface appears to float above the page), fixes two colours that fell below the accessibility baseline, and adds the eight primitives the catalogue needs: Card, Badge, Avatar, Separator, Skeleton, Empty, Alert and Spinner. It also records the visual direction in a `design.md` at the repo root, so every later UI build starts from one written source of truth instead of guessing. Nothing here stores or reads data. This is the styling and component floor that the rest of the app stands on.

## Requirements

**User stories**:
- As the engineer building the catalogue, I want a small set of primitives that already match the Skild look and meet the accessibility baseline, so that I build pages instead of restyling controls.
- As a person browsing the site, I want text, links and focus indicators I can genuinely see, so that I can use the app with a keyboard or in bright light.
- As a future feature builder, I want the look written down in one place with named values, so that new pages match it without re-deriving the palette.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The shadcn semantic tokens resolve to Skild palette values, so `Button` renders the deeper teal primary instead of near black, and the Clerk dialogs follow the same values.
- **AC-2**: Card, Badge, Avatar and Separator are installed and render on a page, with Avatar falling back to initials when there is no image.
- **AC-3**: Skeleton, Empty, Alert and Spinner are installed and render on a page, covering the loading, empty and error states the catalogue needs.
- **AC-4**: Every primitive renders correctly in both the light and the dark theme, with no colour written directly into a component.
- **AC-5**: Every interactive primitive is reachable by keyboard and shows a visible focus indicator that measures at least 3:1 against whatever sits behind it.
- **AC-6**: Text and link colours meet 4.5:1 against the page background and the card surface, and every control boundary meets 3:1.
- **AC-7**: The styling layer is consistent: the unused class rules are gone, a single `cn` helper is in use, and lint, typecheck and build all pass.
- **AC-8**: `design.md` exists at the repo root and records the direction, the build mandate and the composition rules, pointing at `src/styles.css` for the values.

## Decision

**Chosen option**: Option 1, unify the two token sets on the Skild palette, and build generic primitives only.

The design system becomes one set of tokens led by the brand, held in `src/styles.css`. The shadcn semantic names (`--primary`, `--ring`, `--accent`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--destructive`) point at Skild palette values, in both the light block and the dark block. A deeper teal carries the primary action with white text, the bright lagoon stays for highlights and decoration, and the display font and one elevation step get named values. The primitive set is deliberately generic: the catalogue feature owns any component that knows what a skill is.

**Implementation skills**: `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Scope boundary**: These primitives serve the catalogue list and the skill detail page. Anything a later feature needs arrives with that feature's own spec: form controls with publish, overlays and menus with the signed in area and moderation, and a theme switcher later still.

**Data model**: Not applicable. This feature stores nothing and reads nothing from a database. The values it produces are CSS custom properties (named style values the browser inherits) and component props.

**State transitions**: Not applicable. No entity here has a lifecycle.

**Token map** (the values the whole system resolves to, each measured against the surfaces it actually sits on):

| Token | Light | Dark | Used for | Measured |
|---|---|---|---|---|
| `--primary` | `#24747c` | `#60d7cf` | Filled buttons, active states | light 5.43:1 with white text, 4.77:1 against the page; dark 10.76:1 against the page |
| `--primary-foreground` | `#ffffff` | `var(--bg-base)` | Text on a primary fill | passes with the pair above (dark 10.76:1) |
| `--ring` | `#328f97` | `#60d7cf` | Focus rings, drawn at full strength | light 3.81:1 on white, 3.34:1 on the page |
| `--lagoon-deep` | `#24747c` | `#8de5db` (unchanged) | Links, icon accents | light 5.43:1 on white, 4.77:1 on the page, 5.06:1 on a card |
| `--muted-foreground` | `var(--sea-ink-soft)` | `var(--sea-ink-soft)` | Secondary text | light 5.89:1 on the page, 6.25:1 on a card; dark 11.00:1 and 10.38:1 |
| `--accent`, `--muted`, `--secondary` | `var(--sand)` | `var(--link-bg-hover)` | Hover fills, quiet surfaces | fills only, no text requirement |
| `--accent-foreground`, `--secondary-foreground` | `var(--sea-ink)` | `var(--sea-ink)` | Text on those fills | light 10.51:1, dark 11.81:1 |
| `--background`, `--card`, `--popover` | `#ffffff`, `var(--surface-strong)`, `#ffffff` | `var(--bg-base)`, `var(--surface-strong)`, `var(--foam)` | Surfaces and floating panels | text on them is measured in the rows above |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `var(--sea-ink)` | `var(--sea-ink)` | Body text, and the text on card and panel surfaces | light 12.24:1 on white, dark 15.14:1 |
| `--border` | `var(--line)` | `var(--line)` | Hairlines, card edges | decorative |
| `--input` | `#6b8580` | `#4f7570` | Control boundaries | light 3.48:1 on the page, 3.70:1 on a card; dark 3.65:1 and 3.43:1 |
| `--destructive` | `#c2261f` | `#f87171` | Error fills and error text | light 5.13:1 as text on the page, 5.85:1 with white text; dark 6.36:1 as text |
| `--destructive-foreground` | `#ffffff` | `#2a0f0d` | Text on an error fill | passes with the pair above |
| `--font-display` | `'Fraunces', Georgia, serif` | same | Page and section headings | a typeface, not a colour |
| `--shadow-card` | `0 1px 0 var(--inset-glint) inset, 0 18px 34px rgba(30, 90, 72, 0.1), 0 4px 14px rgba(23, 58, 64, 0.06)` | the same inset glint with `rgba(0, 0, 0, 0.45)` and `rgba(0, 0, 0, 0.35)` spreads | Card elevation, mapped as `--shadow-sm` so the registry Card picks it up | decoration, no contrast requirement |

`--radius` (0.625rem) and its sm, md, lg and xl steps stay as they are. `--chart-*` and `--sidebar-*` are unused today and stay untouched. The palette names in the right column of the light block are the app's existing tokens, so the shadcn layer points at them rather than repeating values.

Cards stay slightly translucent, which is the glassy look the palette was built for. Floating panels (popovers, menus) take an opaque surface instead, because text ghosts through a translucent panel when there is no blur behind it. Their border carries the separation.

Two values outside the table move with it: `a:hover` becomes `#1f6a72` (6.24:1 on white, 5.48:1 on the page), and the link underline derives from `--lagoon-deep` rather than the literal `rgba(50, 143, 151, 0.4)` it uses today, which would otherwise stay the old teal after the link itself moves. `--shadow-card` reaches the Card by being mapped as `--shadow-sm`, which is the class the registry Card already ships, so no registry file is edited for the elevation. The focus ring and one destructive variant do take a local correction, described under the rules below.

**Surface inventory** (the primitives this feature ships):

| Primitive | Registry item | Serves | States it carries |
|---|---|---|---|
| Card (with header, title, description, content and footer) | `card` | Skill cards on the list, sections on the detail page | static |
| Badge | `badge` | Skill tags, and a hidden marker later | static, variants |
| Avatar (with image and fallback) | `avatar` | The skill owner | image, initials fallback |
| Separator | `separator` | Detail page dividers | static |
| Skeleton | `skeleton` | The loading list and the loading detail page | loading |
| Empty (with title, description and action) | `empty` | No skills yet, and no results later | empty |
| Alert | `alert` | A read that failed | error, variants |
| Spinner | `spinner` | Pending state on a retry control | pending |

**Props and API rules**:
- Each primitive keeps the registry's own API exactly: the variant and size helpers, `asChild` where the registry offers it, and the `data-slot` attributes. No wrapper API is invented, so an upstream update still merges cleanly.
- Every primitive forwards `className` for layout only, never to recolour or retype a control.
- Colour and typography always come from a token, never from a literal inside a component.
- Two registry class strings are corrected locally, and only these two: the focus ring drops its `/50` alpha so it draws at full strength, and any destructive variant that hardcodes `text-white` uses `text-destructive-foreground` instead. Each one carries a short comment in the file saying why, because the accessibility bar in `AGENTS.md` outranks merge convenience, and a registry update has to re-apply them.

**Gallery route**: `src/routes/design.tsx`, a development only route reached at `/design` and kept out of the site navigation. It renders every primitive once in a light section and once inside a wrapper carrying the `dark` class, so the dark values can be seen before any theme switcher exists. It is the surface `/check verify` drives, and feature 10 gates or removes it before deploy.

**Value sourcing** (every value a primitive produces or displays, and where it comes from):

| Action | Value produced or displayed | Source |
|---|---|---|
| Rendering any primitive | All colours, radii, shadows and fonts | The token blocks in `src/styles.css`, mapped into Tailwind through `@theme inline` |
| Card title, description, content | The words and the structure | Props passed by the caller; the catalogue passes values its own spec defines |
| Avatar image | The owner's picture | The `src` prop; when it is missing or fails, `AvatarFallback` shows the initials the caller passes |
| Badge label | The tag text | The child text the caller passes |
| Empty heading, description, action | The copy and the control | Required props supplied by the caller. The primitives ship no product strings of their own, so the catalogue owns every word a person reads |
| Skeleton rows | How many placeholders appear | A `count` prop defaulting to 6, decided by the caller |
| Spinner size | The visual size | The primitive's own size variant |
| Alert title and body | The error wording | Props passed by the caller; the catalogue owns its wording |
| Focus indicator | Its colour and thickness | The `--ring` token and the registry's focus classes |

**Key invariants**:
- Text meets 4.5:1 against the surface behind it, and every control boundary and focus indicator meets 3:1. Any new value is measured before it lands, and the measurement is recorded here.
- A focus indicator is drawn at full strength. A half strength ring measures 1.84:1 on white, so an alpha ring never counts as meeting the bar.
- Where a registry file hardcodes a value that breaks the bar, correct it locally and write the reason beside it.
- No component writes a colour directly. Everything resolves through a token.
- No animation ships without a `prefers-reduced-motion` guard.
- Every primitive renders on the server without touching `window`, so hydration stays clean.
- Icons come from `lucide-react` as components, sized by the component, never emoji and never a string lookup.
- One `cn` helper exists, at `#/lib/utils`, matching `components.json`, so the registry's generated imports resolve as written.

**Security model**: Not applicable. Every primitive is presentational: it reads no data, holds no session and exposes no write path. The only access rule in this area remains with Clerk, whose dialog follows the mapped tokens through the shadcn theme already wired in `src/routes/__root.tsx`.

**Configuration required**: None. No new environment variables and no new credentials.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: the gallery route renders all eight primitives in light and dark, and every one is visible, verifies **AC-2**, **AC-3**, **AC-4**.
- Failure case: the error and empty states render with no console errors and no missing sub components, verifies **AC-3**.
- Keyboard: tab through the gallery and the header, and every interactive control takes focus and shows a ring of at least 3:1, verifies **AC-5**.
- Measurement: every pair in the token map is re-measured against the real surfaces it sits on, verifies **AC-1**, **AC-6**.
- Clean sweep: `npm run check`, `npm run typecheck` and `npm run build` all pass with the unused rules gone and one `cn` in use, verifies **AC-7**.

## Build plan

Tracer Bullet reasoning: the token layer is the thin thread every primitive hangs off and every later feature will inherit, so it lands first and is proven in the running app before a single component is added. From there the primitives land in two batches, each one seen on the gallery route, rather than building all eight blind and styling them at the end.

1. Rewrite the shadcn token block in `src/styles.css` to the token map above, in both the light and the dark block, then add `--font-display`, `--shadow-card` and the surface text tokens (`--card-foreground`, `--popover-foreground`), and map them into `@theme inline` so `font-display` and `shadow-card` exist as utilities and `--shadow-sm` resolves to the card elevation. satisfies **AC-1**, **AC-4**, **AC-6**
2. Fix the two baseline failures in the same file: `--lagoon-deep` becomes `#24747c` so links pass, `--muted-foreground` points at `var(--sea-ink-soft)`, `a:hover` becomes `#1f6a72`, and the link underline derives from `--lagoon-deep` instead of the literal it uses today. satisfies **AC-6**
3. Delete the unused class layer (`.page-wrap`, `.display-title`, `.island-shell`, `.island-kicker`, `.feature-card`, `.nav-link`, `.rise-in`, `.site-footer`), keeping the one value worth preserving as the `--shadow-card` token. satisfies **AC-7**
4. Switch `src/components/ui/button.tsx` to the project's `cn` helper at `#/lib/utils`, drop the now unused `cn` package from `package.json`, and point the home page heading at the `font-display` utility. satisfies **AC-7**
5. Install Card, Badge, Avatar and Separator with the shadcn CLI, then read each added file and confirm the composition and the sub components are right, including the two documented corrections (the full strength ring, and `text-destructive-foreground` in place of a hardcoded white on a destructive fill). satisfies **AC-2**, **AC-5**
6. Install Skeleton, Empty, Alert and Spinner the same way, check each one against the registry's composition rules, and confirm Alert's error text against the dark surface. satisfies **AC-3**, **AC-6**
7. Add the gallery route at `src/routes/design.tsx`, rendering every primitive in a light section and a dark section, so the set can be looked at and so `/check verify` has a surface to drive. satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**
8. Write `design.md` at the repo root: the character, the build mandate, the composition and component rules, and pointers to `src/styles.css` for the values. satisfies **AC-8**
9. Walk the gallery and the header in both themes with a keyboard, fix whatever the walk finds (focus, contrast, missing states), and re-measure the token map. satisfies **AC-1**, **AC-4**, **AC-5**, **AC-6**

## Consequences

**Positive**:
- One token set led by the brand, so every shadcn primitive and the Clerk dialogs look native to Skild with no per component styling.
- The catalogue, and every later feature, builds from named primitives instead of restyling raw markup.
- Two real accessibility failures are fixed, and the values that pass are written down with their measurements, so the next person does not have to re-derive them.
- Dead CSS is gone, and the look it encoded survives as tokens.
- A later UI build has one written source of truth for the look, which is exactly what the workflow's UI track reads before designing a page.

**Negative / tradeoffs**:
- The shipped look changes: the header and hero buttons move from near black to teal, and the muted body text gets slightly darker.
- The tokens now point at Skild values, so running a shadcn preset command later would overwrite them, and a registry update needs a read before it merges.
- `design.md` is one more artifact to keep current, and a stale direction is worse than none.
- The development only gallery route ships in the bundle until it is gated or removed.
- The primitive set is narrow on purpose, so publish, search and moderation will each add their own pieces and each will want its own measurement pass.

**Neutral**:
- The dark theme stays unreachable until a switcher exists. The primitives are correct in it, and nothing can turn it on.
- The Clerk theme import and the `appearance` prop stay untouched; they simply inherit the mapped values.
- `--chart-*` and `--sidebar-*` stay exactly as they are, unused.

## Follow-up

- [ ] Add the theme switcher. The dark values are ready; the switch and its persistence are not built.
- [ ] Form controls (Input, Textarea, Field, Select, ToggleGroup) arrive with the publish feature, and `--input` is re-measured against whatever surface they sit on then.
- [ ] Self host Fraunces and Manrope instead of the Google Fonts `@import` in `src/styles.css`, to drop the third party request and the shift on first paint.
- [ ] Gate or remove the gallery route before deploy; feature 10 owns the deploy.
- [ ] `/sync` should carry the design system conventions into `AGENTS.md` (semantic tokens only, utilities for layout, where the primitives live), so later features follow them without reading this spec.
- [ ] Overlays and menus (Dialog, Sheet, DropdownMenu, Tooltip) arrive with the signed in area and with moderation.

## Migration plan

**Strategy**: no migration needed. This is a styling and component change with no stored data and no schema, and it lands in a single deploy.

**Rollback**: revert the commit. The token values, the deleted classes and the added components all come back in one step.

**Risks**: the shipped look changes, so a page nobody re-checks could turn out to have a colour that no longer suits its surface. The mitigation is the keyboard and visual walk in the final build task, done in both themes, which is also what `/check verify` runs.

## Rationale

The reasoning, the options weighed and the sources this decision rests on: see [rationale.md](rationale.md).

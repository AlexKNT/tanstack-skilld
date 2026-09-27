---
name: skild-design-system
source: extracted-from-code
character: "Skild is a calm coastal workshop. Deep sea ink sits on a soft green wash, one teal carries every action, and a warm serif leads the headings. The mood is quiet and legible rather than loud: generous space, hairline borders, and one soft step of elevation."
tokens: "the values live in `src/styles.css`, in the `:root` and `.dark` blocks, mapped into Tailwind through `@theme inline`. Read them there. They are not repeated in this file, so there is one place to change a value."
contrast: "light: body text 12.24:1 on white, secondary text 5.89:1 on the page and 6.25:1 on a card, links 4.77:1 on the page, a primary button label 5.43:1 on its fill, the focus ring 3.81:1 on white and 3.34:1 on the page, control boundaries 3.48:1. dark: body text 15.14:1, secondary text 11.00:1, the primary fill and the ring 10.76:1, control boundaries 3.65:1. Full table: docs/specs/0002-design-system/index.md"
---

## Build mandate

You are a senior product designer. Every page ships as a complete, professional surface: the brand in the header, real copy written for this product, a considered layout with real hierarchy, and every state the page can be in (loading, empty, error). Never a lone form on an empty page, never a bare control with nothing around it.

Read this file for the direction, and `src/styles.css` for the values. Compose the page in this system's language, then integrate it.

## Character & direction

The palette comes from the sea: ink, lagoon, palm, sand and foam, on a page that is a soft green wash rather than a flat colour. The system keeps that wash, so a page never looks like a plain white document.

The one move that defines the system is a single deeper teal carrying every action, with the bright lagoon left to highlights, icons and decoration. The bright lagoon fails as a fill behind white text and as a boundary against the page, so it is never asked to do either.

The second move is depth without weight: cards are slightly translucent so the wash shows through, floating panels are opaque so text never ghosts, and there is exactly one elevation step.

Type does the rest. Fraunces, a warm serif, holds page and section headings. Manrope, a humanist sans, holds everything else.

## Composition patterns

- Every page renders under the shared sticky header from the root route, inside one `<main>`. The content column is capped and centred (`mx-auto w-full max-w-5xl px-4`) with generous vertical padding.
- A page opens with a small uppercase kicker line, then the heading in `font-display`, then one supporting line in `text-muted-foreground`, then the content. Sections stack in a flex column with a `gap`, never with manual margins.
- A collection of things is a responsive grid of `Card`s. A card carries its own header (title, description, one action), body and footer, composed from the Card parts rather than one part holding everything.
- A detail page opens with an identity header and its key action, then sections divided by `Separator`.
- Loading, empty and error are first class surfaces, not afterthoughts. `Skeleton` inside a card for loading, `Empty` for nothing to show, `Alert` for a read that failed. The catalogue is the first real test of these.
- `/design` is the reference page: every primitive, rendered once on the light page and once on the dark page. Look there before inventing a new look for something.

## Component & usage rules

**Do**
- Take every colour, font, radius and shadow from a token. Use the named utility (`bg-primary`, `text-muted-foreground`, `bg-card`, `border-border`, `font-display`, `shadow-sm`).
- Keep one `cn` helper, at `#/lib/utils`, which is what `components.json` declares.
- Keep each primitive's registry API intact: its variants, its sizes, its `data-slot` attributes and `asChild`. `className` is for layout only.
- Use `Spinner` with `data-icon` and `disabled` for a pending button. `Button` has no loading prop.
- Use `lucide-react` icons as components, sized by the component. Decorative icons take `aria-hidden="true"`, and an icon only control needs an accessible name.
- Give every page one `<h1>`, a heading order that never skips a level, and a unique title.
- Measure a new colour pair against the surface it actually sits on before it lands, and record the figure in the spec that introduces it.

**Don't**
- Don't write a raw colour or an arbitrary value such as `text-[var(--lagoon-deep)]` or `bg-blue-500`. If the utility has no name, add the name to the tokens.
- Don't let the registry's `cn` import stand. The registry writes `from "cn"` and adds the `cn` package; repoint the import to `#/lib/utils` and keep the package out of `package.json`.
- Don't add a second elevation step, or a `dark:` colour override. The tokens already answer both.
- Don't soften the focus ring with an alpha value, and never remove an outline without replacing it.
- Don't edit a registry class string except for the two documented corrections: the focus ring draws at full strength, and a destructive fill uses `text-destructive-foreground` rather than the white the registry ships. Both carry a comment in the file, and both have to be re-applied after a registry update.
- Don't add `--text-*` tokens. Tailwind's own size steps are the scale.
- Don't ship placeholder copy, emoji, or an icon picked by a string lookup.

## Responsive & accessibility direction

Build from the smallest width up, cap the content column and centre it, and keep body copy around 16px. Every target is at least 44 by 44, reached with padding rather than by growing the control.

Both themes are first class. The dark values are complete and the `dark` class switches them on, though only `/design` can do that today and the switcher is a later feature.

Motion is short (about 180ms) and colour led. Every animation is guarded by `prefers-reduced-motion` in `src/styles.css`, which is also where the guard for the registry's own animations lives, so an update to a primitive cannot ship motion that ignores the setting.

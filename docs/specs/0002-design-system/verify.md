# Verify: design system & UI foundation · spec 0002 · updated 2026-09-27

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

**The tokens reach the app**

- [x] Visit `/` → the header's primary button is the deeper teal, not near black, and its label is white → AC-1
- [x] From the header, open Sign up → the dialog's primary button is the same teal with white text, and its footer link is the same teal → AC-1
- [x] Visit `/design` → a Light theme panel and a Dark theme panel each list Card, Badge, Avatar, Separator, Skeleton, Empty, Alert and Spinner, in that order → AC-2, AC-3
- [x] In each panel, look at the Avatar block → the first avatar shows a picture and the second shows the initials SK, with no image and no broken image icon → AC-2
- [x] In each panel, look at the Skeleton block → four placeholder bars render inside a card → AC-3
- [x] In each panel, look at the Empty block → an icon, a title, a description and a Publish a skill button render inside a dashed border → AC-3
- [x] In each panel, look at the Alert block → a default callout and a red error callout both render, each with an icon, a title and a body → AC-3
- [x] In each panel, look at the Spinner block → a bare spinner sits beside its label, and a disabled Publishing button carries a second spinner → AC-3

**Both themes**

- [x] On `/design`, compare the two panels → the dark one is a dark surface and every primitive in it renders on dark values with legible text → AC-4
- [x] On `/design`, open the browser console → no errors and no hydration warnings, only the pre existing Clerk development key warning → AC-3

**Keyboard and focus**

- [x] On `/design`, press Tab from the top of the page → focus moves in reading order: the header link, the two header buttons, then Open, Save, the linked badge and Publish a skill in the light panel, then the same in the dark panel. The disabled Publishing button is skipped → AC-5
- [x] While tabbing, check each stop → it shows a visible ring, about 3 px, drawn at full strength with no fade. Deeper teal on the light surface, light teal on the dark one → AC-5

**The gallery's own rule**

- [x] `npm run build` then `npm run preview`, and visit `/design` → the page shows the short line saying it is a development reference, not the gallery → spec 0002 gallery route

## Value sourcing (one per row of the spec's table)

- [x] Edit `--primary` in `src/styles.css` → every button and badge follows, no component edited. Revert → AC-1
- [x] Edit `--elevation-card` in the light block → the card's shadow follows, and no registry file is edited. Revert → AC-1
- [x] Edit `--ring` to a lighter teal → the focus ring follows and stays solid at full strength. Revert → AC-5
- [ ] Edit the card's title and body words in `src/routes/design.tsx` → the card shows exactly those words, since the primitive ships none → AC-2
- [ ] Point one `AvatarImage` `src` at a path that does not exist → the initials fallback appears in place of the broken image. Restore → AC-2
- [ ] Change a Badge's child text → the badge shows the new text and nothing else → AC-2
- [ ] Change the Empty block's title, description and action → the primitive follows, since it ships no product strings of its own → AC-3
- [ ] Change the gallery skeletons' `className` widths → the bars follow, nothing about their shape is baked in → AC-3
- [ ] Pass `className="size-6"` to a Spinner → it grows; the primitive's own size variant is what governs → AC-3
- [ ] Change the Alert title and body → the alert shows the new wording → AC-3

## Commands

- [x] `npm run check` → Biome reports no errors or fixes → AC-7
- [x] `npm run typecheck` → `tsc --noEmit` exits clean → AC-7
- [x] `npm run build` → the production build completes → AC-7
- [x] `grep -rn 'from "cn"' src` → no matches, and `cn` is not in `package.json` dependencies → AC-7
- [ ] `grep -rn 'page-wrap\|display-title\|island-shell\|island-kicker\|feature-card\|nav-link\|rise-in\|site-footer' src` → no matches → AC-7
- [x] `grep -rn '#[0-9a-fA-F]\{3,8\}\|bg-\[\|text-\[\|oklch(' src/components/ui` → no matches, so no colour is written inside a component → AC-4
- [x] Confirm `design.md` exists at the repo root, holds the character, the build mandate and the composition rules, and points at `src/styles.css` for the values → AC-8

## Acceptance-criteria coverage

- **AC-1** covered by the home button step, the Clerk dialog step, and the `--primary` and `--elevation-card` sourcing steps
- **AC-2** covered by the `/design` step, the Avatar initials step, and the card copy, avatar failure and badge label steps
- **AC-3** covered by the `/design` step, the Skeleton, Empty, Alert and Spinner steps, the console step, and the Empty, Skeleton, Spinner and Alert sourcing steps
- **AC-4** covered by the two theme panel steps and the component colour literal command
- **AC-5** covered by the Tab order step, the ring strength step, and the `--ring` sourcing step
- **AC-6** covered by the walk done during the build (every pair in the token map was re-measured against its real surface: body text 12.24:1 on white, secondary text 5.89:1 on the page, links 4.77:1, primary label 5.43:1, ring 3.81:1 on white and 3.34:1 on the page, input boundary 3.48:1, destructive 5.85:1; dark 15.14:1, 11.00:1, 10.76:1 and 3.65:1). Re-run with a contrast checker if any value moves
- **AC-7** covered by the three command steps and the two grep steps
- **AC-8** covered by the last two command steps

# Verify: signed in area · spec 0006 · updated 2026-10-15

_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict: PASS, re-run 2026-10-17.** Both gaps recorded on 2026-10-15 are closed. The Clerk profile calls now go through `useReverification`, so a call that needs a fresh verification opens Clerk's password prompt and then retries: a new address, the code, the verify step and Make primary all completed, and the current address changed. The loading clause of AC-7 is now observed: with the overview read held for five seconds, four `Skeleton` placeholders (matched by `[data-slot="skeleton"]`) reached the screen about 1.5 seconds into a client side navigation from `/` to `/account`. A fresh test user, deleted afterwards, proved the area end to end: the overview showed the name, email, joined date and a count of one skill; My skills started with the empty state and its publish link, then listed the created skill after publishing; the edit form prefilled `machine-learning, react`; a save landed on the detail page with an `Edited` line; an empty name was refused with `aria-invalid` and the message beside the field; the leave guard offered `Discard your changes?`; delete landed on `/account/skills?deleted=verify-harness-skill-two` and the public page answered 404; another author's edit address answered `Skill not found`; `/`, `/account`, `/account/skills` and `/?q=test` each measured 305 of 305 pixels at a 320 pixel viewport; and the four events `theme_changed`, `profile_updated`, `skill_updated` and `skill_deleted` arrived, the last two carrying the slug. Not exercised this run: the store failure surfaces of AC-7, the photo type and size refusals, and the crafted write half of AC-14; the first two passed in the 2026-10-15 run.

## UI / manual

- [x] Visit `/account` → one `h1` (`Your account`) inside the area layout, the shared header, and the `Account` sidebar linking Overview, My skills, Profile and Settings, vertical at 1280px → AC-1
- [x] Visit `/account/skills`, `/account/profile`, `/account/settings` → each renders under the same layout with exactly one `h1` (`My skills`, `Profile`, `Settings`) and no skipped heading level (the empty `h3` elements belong to the TanStack devtools, not the app) → AC-1
- [x] Signed out, request `/account`, `/account/skills` and `/account/skills/foo/edit` → `HTTP/1.1 307` with `location: /sign-in?redirect=<the path>`, and no area markup in the response → AC-2
- [x] Signed out, request `/account?tab=skills&page=2` → `redirect=%2Faccount%3Ftab%3Dskills%26page%3D2`, so the query string survives → AC-2
- [x] Sign out, request `/account/skills` → lands on `/sign-in?redirect=%2Faccount%2Fskills`; sign in → back on `/account/skills` with `h1` `My skills` → AC-2
- [x] Signed out, read the header → `Sign in`, `Sign up` and the theme control, and no `Your account` link; signed in → `Your account`, `Publish a skill`, the theme control and the avatar → AC-3
- [x] `/account` shows the avatar, the full name, the primary email, the joined date and the published count → AC-4
- [x] `/account/skills` lists only your own skills, newest edit first, with `Load more` → AC-5 (this run proved the ownership half: the test user saw only their own row while the public catalogue held 23; the ordering and `Load more` were exercised in the 2026-10-15 run)
- [x] An author with no skills sees the `Empty` state with its link to `/skills/new` → AC-6
- [x] Break the store (the hosted Postgres is gone) → `/account` shows `Your skill count could not be loaded.` with `Try again`, `/account/skills` shows `Your skills could not be loaded.` with `Try again`, and the edit route shows `The skill could not be loaded` with `Try again` → AC-7
- [x] Loading state shows `Skeleton` placeholders in the shape of the content → AC-7 (holding `/_serverFn/**` for requests to `account/data.ts` for five seconds, a client side navigation showed four `[data-slot="skeleton"]` elements about 1.5 seconds after the click)
- [x] `/account/skills/$slug/edit` renders the four prefilled fields in one `Card` → AC-8
- [x] Save a valid edit → lands on `/skills/<slug>` with an `Edited` date line → AC-10
- [x] A failed save keeps the typed values, shows field messages with `aria-invalid`, and offers the inline `Sign in` prompt when unauthenticated → AC-11 (empty name: `aria-invalid` on the field and `Give the skill a name of 80 characters or fewer.` beside it)
- [x] Leaving a half written edit warns before the in app navigation → AC-12 (`Discard your changes?`)
- [x] Delete through the modal, land on `/account/skills?deleted=<slug>`, then the public page answers 404 → AC-13
- [x] Another author's skill answers not found to the read, the update and the delete, by URL and by a crafted write → AC-14 (the read by URL answered `Skill not found`; the crafted write was not repeated this run)
- [x] Change the first and last name on `/account/profile` → the avatar alt becomes `Verify Area's logo`, so the write reached Clerk → AC-15
- [x] Choose a `.txt` for the photo → `Choose a PNG, JPEG, WebP, or GIF image.` in a `role="alert"` region → AC-15
- [x] Choose a 6 MB PNG for the photo → `Choose an image of 5 MB or smaller.` in a `role="alert"` region → AC-15
- [x] Choose a small valid PNG → the Clerk avatar changes from `type=default` to `type=proxy` → AC-15
- [x] Enter a new address, take the code, verify it, then make it primary → AC-15 (the password prompt from `useReverification` appeared, the code `424242` verified the `+clerk_test` address, and the current address changed after Make primary)
- [x] `/account/settings` offers `System`, `Light`, `Dark` with system selected and real `label` elements → AC-16
- [x] Click `Dark` → the root element gains `dark` and the cookie becomes `theme=dark` with no reload; the header control cycles and its accessible name tracks the value (`Theme: Dark` → `Theme: System` → `Theme: Light`) → AC-16
- [x] `curl -H "Cookie: theme=dark" http://localhost:3000/` → `<html class="dark" ...>`, so the first paint is already dark; `theme=light` and `theme=bogus` return no `dark` class, so an unknown value falls back to system; no cookie leaves it to the inline `prefers-color-scheme` script → AC-17
- [x] Keyboard walk the area at 1280px → Tab reaches the logo, the theme control, the account link, the publish link, the user menu, the four sidebar links and the retry button in order, each matching `:focus-visible` with a 3px `rgb(96, 215, 207)` ring → AC-18
- [x] Check the labels → every control carries one, and the icon only theme control's name states the current choice (`Theme: Dark`) → AC-18
- [x] Check the layout from 320px up → `/`, `/account`, `/account/skills` and `/?q=test` each measured `scrollWidth` 305 against `clientWidth` 305 at a 320 pixel viewport → AC-18
- [x] Confirm one migration, no new table and no new column, and that the trigger advances `updated_at` on a real update → AC-19 (introspection shows `tags`, `search_document` generated always, the `skills_tags_check` and `skills_visibility_allowed` constraints, both GIN indexes and `skills_set_updated_at`; an edit moved `updated_at`)

## Analytics

- [x] `theme_changed` → `{"theme":"dark"}`, read off the wire by intercepting PostHog and decompressing the batch → AC-20
- [x] `profile_updated` → `{"field":"name"}`, carrying which field changed and no value, with no name or email appearing in any event → AC-20
- [x] `skill_updated` and `skill_deleted`, each carrying the slug → AC-20 (both captured off the wire with `"slug":"verify-harness-skill-two"`)

## Siblings checked

- The overview read bundles the Clerk identity and the store count in one server function, so while the store is unreachable the identity is hidden too. AC-4 wants the identity from Clerk and the count from the store, so this is worth a look when the store is back: if the identity can render on its own, the page degrades better. Not changed here, since a fix belongs with whoever owns that read.

## Commands

- [x] `npm run dev` → Vite serves `http://localhost:3000`, which answers 200 → AC-1
- [x] `npm run typecheck` → exit 0 → AC-1 to AC-20
- [x] `npm run check`, `npm run build` → both exit 0 → AC-1 to AC-20

## Acceptance-criteria coverage

- AC-1 covered by the four page visits, the heading check and the sidebar check
- AC-2 covered by the three signed out requests, the query string request and the sign in round trip
- AC-3 covered by the header step in both signed in states
- AC-4 covered by the overview identity and count step
- AC-5 covered by the My skills ownership step, plus the 2026-10-15 ordering pass
- AC-6 covered by the empty state step
- AC-7 covered by the three failure surfaces from 2026-10-15 and the observed loading skeleton from this run
- AC-8 covered by the prefilled edit form
- AC-9 covered by the create step behind the publish form
- AC-10 covered by the save landing on the detail page with an `Edited` line
- AC-11 covered by the empty name refusal
- AC-12 covered by the leave guard
- AC-13 covered by the delete dialog and the public 404
- AC-14 covered by the other author's edit address answering `Skill not found`
- AC-15 covered by the name step, the photo steps from 2026-10-15 and the completed email flow
- AC-16 covered by the settings step and the header cycle
- AC-17 covered by the three cookie requests read against the server rendered class
- AC-18 covered by the 320 pixel measurements, the keyboard walk and the labels
- AC-19 covered by the schema introspection and the trigger moving `updated_at`
- AC-20 covered by the four captured events, the last two carrying the slug

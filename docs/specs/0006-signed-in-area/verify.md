# Verify: signed in area · spec 0006 · updated 2026-10-12

_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict: FAIL.** 5 criteria met, 1 failed (AC-18), 3 partly verified, 11 blocked.

**Blocker.** The hosted Postgres behind `DATABASE_URL` no longer exists, so every read that reaches the store fails. `http://localhost:3000/` answers 200 and renders the catalogue's own `The catalogue could not be loaded` Alert. Unblock by pointing `DATABASE_URL` at a reachable database with the migrations applied (`npm run db:migrate`), then re-run this file. Confirmed three ways: the pooler answers `error: (ENOTFOUND) tenant/user postgres.zvswcxjetzzmwnlzvmws not found`, `db.zvswcxjetzzmwnlzvmws.supabase.co` has no DNS record, and no local Postgres or Docker exists to stand in. AC-4 to AC-14 and AC-19 all sit behind this one blocker.

## UI / manual

- [x] Visit `/account` → one `h1` (`Your account`) inside the area layout, the shared header, and the `Account` sidebar linking Overview, My skills, Profile and Settings, vertical at 1280px → AC-1
- [x] Visit `/account/skills`, `/account/profile`, `/account/settings` → each renders under the same layout with exactly one `h1` (`My skills`, `Profile`, `Settings`) and no skipped heading level (the empty `h3` elements belong to the TanStack devtools, not the app) → AC-1
- [x] Signed out, request `/account`, `/account/skills` and `/account/skills/foo/edit` → `HTTP/1.1 307` with `location: /sign-in?redirect=<the path>`, and no area markup in the response → AC-2
- [x] Signed out, request `/account?tab=skills&page=2` → `redirect=%2Faccount%3Ftab%3Dskills%26page%3D2`, so the query string survives → AC-2
- [x] Sign out, request `/account/skills` → lands on `/sign-in?redirect=%2Faccount%2Fskills`; sign in → back on `/account/skills` with `h1` `My skills` → AC-2
- [x] Signed out, read the header → `Sign in`, `Sign up` and the theme control, and no `Your account` link; signed in → `Your account`, `Publish a skill`, the theme control and the avatar → AC-3
- [ ] `/account` shows the avatar, the full name, the primary email, the joined date and the published count → AC-4 (blocked: the count read fails and the page falls back to the Alert, so the Clerk identity is not rendered either)
- [ ] `/account/skills` lists only your own skills, newest edit first, with `Load more` → AC-5 (blocked)
- [ ] An author with no skills sees the `Empty` state with its link to `/skills/new` → AC-6 (blocked)
- [x] Break the store (the hosted Postgres is gone) → `/account` shows `Your skill count could not be loaded.` with `Try again`, `/account/skills` shows `Your skills could not be loaded.` with `Try again`, and the edit route shows `The skill could not be loaded` with `Try again` → AC-7
- [ ] Loading state shows `Skeleton` placeholders in the shape of the content → AC-7 (not observed: the skeletons exist at `src/routes/account.index.tsx` and `managed-skill-card.tsx`, but the read resolves or fails before the router mounts, so none reached the screen, even with `/_serverFn/**` stalled for 9 seconds)
- [ ] `/account/skills/$slug/edit` renders the four prefilled fields in one `Card` → AC-8 (blocked: the read fails, so the failure surface renders instead of the form)
- [ ] Save a valid edit → lands on `/skills/<slug>` with an `Edited` date line → AC-10 (blocked)
- [ ] A failed save keeps the typed values, shows field messages with `aria-invalid`, and offers the inline `Sign in` prompt when unauthenticated → AC-11 (blocked)
- [ ] Leaving a half written edit warns before the in app navigation → AC-12 (blocked)
- [ ] Delete through the modal, land on `/account/skills?deleted=<slug>`, then the public page answers 404 → AC-13 (blocked)
- [ ] Another author's skill answers not found to the read, the update and the delete, by URL and by a crafted write → AC-14 (blocked)
- [x] Change the first and last name on `/account/profile` → the avatar alt becomes `Verify Area's logo`, so the write reached Clerk → AC-15
- [x] Choose a `.txt` for the photo → `Choose a PNG, JPEG, WebP, or GIF image.` in a `role="alert"` region → AC-15
- [x] Choose a 6 MB PNG for the photo → `Choose an image of 5 MB or smaller.` in a `role="alert"` region → AC-15
- [x] Choose a small valid PNG → the Clerk avatar changes from `type=default` to `type=proxy` → AC-15
- [ ] Enter a new address, take the code, verify it, then make it primary → AC-15 (blocked: Clerk answers `You need to provide additional verification to perform this operation`, an instance level reverification requirement that the app surfaces in its alert; the code, verify and make primary steps were never reached)
- [x] `/account/settings` offers `System`, `Light`, `Dark` with system selected and real `label` elements → AC-16
- [x] Click `Dark` → the root element gains `dark` and the cookie becomes `theme=dark` with no reload; the header control cycles and its accessible name tracks the value (`Theme: Dark` → `Theme: System` → `Theme: Light`) → AC-16
- [x] `curl -H "Cookie: theme=dark" http://localhost:3000/` → `<html class="dark" ...>`, so the first paint is already dark; `theme=light` and `theme=bogus` return no `dark` class, so an unknown value falls back to system; no cookie leaves it to the inline `prefers-color-scheme` script → AC-17
- [x] Keyboard walk the area at 1280px → Tab reaches the logo, the theme control, the account link, the publish link, the user menu, the four sidebar links and the retry button in order, each matching `:focus-visible` with a 3px `rgb(96, 215, 207)` ring → AC-18
- [x] Check the labels → every control carries one, and the icon only theme control's name states the current choice (`Theme: Dark`) → AC-18
- [ ] Check the layout from 320px up → **fails**. The document is 406px wide against a 320px viewport, so the page scrolls sideways, and the signed in header row (theme control, `Your account`, `Publish a skill`, the user button) overflows with `Publish a skill` clipped. The same happens at 375px. The sidebar also wraps to two rows below 480px rather than the single row AC-1 describes → AC-18
- [ ] Confirm one migration, no new table and no new column, and that the trigger advances `updated_at` on a real update → AC-19 (blocked: the live schema is unreadable, so the index and the trigger cannot be confirmed to exist. `drizzle/0001_previous_alex_wilder.sql` is written and committed, but written is not applied)

## Analytics

- [x] `theme_changed` → `{"theme":"dark"}`, read off the wire by intercepting PostHog and decompressing the batch → AC-20
- [x] `profile_updated` → `{"field":"name"}`, carrying which field changed and no value, with no name or email appearing in any event → AC-20
- [ ] `skill_updated` and `skill_deleted`, each carrying the slug → AC-20 (blocked with the edit and delete paths)

## Siblings checked

- The overview read bundles the Clerk identity and the store count in one server function, so while the store is unreachable the identity is hidden too. AC-4 wants the identity from Clerk and the count from the store, so this is worth a look when the store is back: if the identity can render on its own, the page degrades better. Not changed here, since a fix belongs with whoever owns that read.

## Commands

- [x] `npm run dev` → Vite serves `http://localhost:3000`, which answers 200 → AC-1
- [x] `npm run typecheck` → exit 0 → AC-1 to AC-20
- [ ] `npm run check`, `npm run build` → not run in this pass

## Acceptance-criteria coverage

- AC-1 covered by the four page visits, the heading check and the sidebar check
- AC-2 covered by the three signed out requests, the query string request and the sign in round trip
- AC-3 covered by the header step in both signed in states
- AC-4 blocked with the store
- AC-5 blocked with the store
- AC-6 blocked with the store
- AC-7 covered by the three failure surfaces, which pass; the loading branch is unobserved
- AC-8 blocked with the store
- AC-9 blocked with the store, and it is the one criterion with no runtime step at all, since a write needs a working database
- AC-10 blocked with the store
- AC-11 blocked with the store
- AC-12 blocked with the store
- AC-13 blocked with the store
- AC-14 blocked with the store
- AC-15 covered by the name step, the three photo steps and the browser checks; the email flow is blocked at Clerk
- AC-16 covered by the settings step and the header cycle
- AC-17 covered by the three cookie requests read against the server rendered class
- AC-18 failed on the layout at 320px and 375px, and met on the keyboard and label half
- AC-19 blocked, and it is the one criterion that needs the live schema rather than the data
- AC-20 covered by the two captured events, with the two write events blocked

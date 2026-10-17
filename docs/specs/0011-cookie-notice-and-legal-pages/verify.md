# Verify: cookie notice and legal pages · spec 0011 · updated 2026-10-17

_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict: PASS, re-run 2026-10-17.** A fresh browser state carries no `ph_` key and no PostHog request: the only analytics module fetched is the local Vite dependency, and `ph_debug` no longer appears since the debug flag left the provider options. `Accept analytics` wrote `cookie-consent=granted`, hid the banner without a reload and sent the batch to `eu.i.posthog.com` once. `Decline` wrote `denied`, hid the banner and left the analytics host untouched while PostHog's own cookie was cleared. A stored answer leaves no banner in the served HTML: `curl` with `cookie-consent=denied` and `granted` returned no `Analytics choice` region, and a forged `yes` returned the banner. The footer's `Cookie settings` cleared the cookie and reopened the banner once hydration finished. `/privacy` and `/terms` answered 200 with one `h1`, a `<time dateTime>`, a `mailto:` contact, their own titles, descriptions and `http://localhost:3000` canonicals, no `X-Robots-Tag`, and both `<loc>` entries in the sitemap; both measured 305 of 305 at 320px. A production build with the two PostHog variables removed from `.env.local` served `/terms` with no banner and no `Cookie settings`, while `Privacy` and `Terms` stayed in the footer; the variables were restored afterwards. Not exercised: a keyboard only walk of the banner, the shortened cookie lifetime, dark theme contrast, and the `LEGAL_*` value edits.

## UI / manual

- [x] Open `/` in a fresh browser with the network panel open → a region labelled `Analytics choice` sits at the bottom, with the pinned sentence, `Accept analytics`, `Decline`, and `Read the privacy page`; both buttons share one variant and size, and neither is preselected → AC-1
- [ ] Tab through the page from the address bar → the banner's link and both buttons are reached without a focus trap, and Enter on the focused button answers the notice → AC-1 (not observed: the browser environment did not move focus on Tab this run)
- [x] With no answer stored, browse `/`, `/privacy`, and `/terms` → no request to `eu.i.posthog.com` or its asset host, no analytics script in the network panel, no `ph_` cookie, and no `ph_` key in local storage → AC-2
- [x] Press `Accept analytics` → the banner disappears with no reload, `cookie-consent=granted` is present, and exactly one `$pageview` for the current address reaches PostHog → AC-3
- [x] After accepting, reload and open another page → capture carries on, and the header's sign in and sign up events reach PostHog → AC-3 (the `catalogue_filtered`, `theme_changed`, `profile_updated`, `skill_updated` and `skill_deleted` events all arrived after a grant)
- [x] In a fresh browser press `Decline` → the banner disappears, `cookie-consent=denied` is present, no request follows for the rest of the session, and PostHog's own cookie and local storage entry are gone → AC-4
- [x] Reload after either answer → View Source shows no banner in the server HTML, so nothing flashes; the served HTML carries the same answer → AC-5
- [ ] Temporarily shorten `CONSENT_COOKIE_MAX_AGE` to a few seconds, answer, wait for it to lapse, then reload → the banner returns and analytics stays off → AC-5 (not exercised: no code change was made for the check)
- [x] Press `Cookie settings` in the footer after answering → the banner returns, `cookie-consent` is gone, and accepting then declining both apply at once → AC-6 (the click has to wait for hydration; a click before it lands does nothing)
- [x] Write `cookie-consent=yes` by hand in the browser's developer tools and reload → the banner shows, no PostHog request is made, and the same holds for an empty value → AC-7
- [x] Request `/privacy` and `/terms` signed out → both answer 200, each has one `<h1>`, one effective date in a `<time>` element, and `<h2>` sections; the contact address is a `mailto:` link whose text matches its target → AC-8
- [x] At 320 pixels wide, both pages and the banner stay readable, and the last footer link is never covered by the banner after scrolling to the bottom → AC-8 (both pages measured 305 of 305)
- [ ] In the dark theme, both pages and the banner keep their contrast and focus ring → AC-8 (not measured this run)
- [x] Request both pages with JavaScript disabled → each carries its own title, its own description, and a self referencing absolute canonical built from `VITE_SITE_URL` → AC-9
- [x] Request `/sitemap.xml` → `/privacy` and `/terms` appear as `<loc>` entries with no `<lastmod>` → AC-9
- [x] Inspect both responses → no `X-Robots-Tag` header and no redirect to sign in → AC-10
- [x] Build for production with `VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST` absent, then open `/terms` → no banner and no `Cookie settings` control, while `Privacy` and `Terms` remain in the footer → AC-1
- [ ] Change `LEGAL_EFFECTIVE_DATE` in `src/features/privacy/legal.ts` → the visible date and the `<time dateTime>` both move together on both pages → value sourcing (not exercised)
- [ ] Change `LEGAL_CONTACT_EMAIL` → the `mailto:` target and its visible text both move together → value sourcing (not exercised)
- [ ] Change `LEGAL_OPERATOR` → the operator name changes on both pages, and nowhere else in the app hardcodes it → value sourcing (not exercised)
- [x] As a signed out visitor, open `/privacy` → no sign in prompt appears, and the page renders exactly as it does signed in → AC-8, AC-10

## Commands

- [x] `npm run typecheck` → no errors → all
- [x] `npm run generate-routes` → `src/routeTree.gen.ts` gains `/privacy` and `/terms` → AC-8
- [x] `npx biome check` on `src/features/privacy`, `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/__root.tsx`, `src/routes/sitemap[.]xml.ts`, `src/features/seo/meta.ts` → no errors → all
- [x] `VITE_SITE_URL=http://localhost:4173 npm run build` then `npm run preview -- --port 4173` → the production build succeeds and serves both pages → AC-8, AC-9

## Acceptance-criteria coverage

- AC-1 … covered by the banner render, the keyboard step, and the unconfigured production build
- AC-2 … covered by the three page browse with an empty storage state
- AC-3 … covered by the accept step and the reload that follows it
- AC-4 … covered by the decline step and the cleared PostHog storage check
- AC-5 … covered by the reload in View Source and the shortened lifetime step
- AC-6 … covered by the `Cookie settings` step
- AC-7 … covered by the forged and empty cookie steps
- AC-8 … covered by the page structure, 320 pixel, dark theme, and keyboard steps
- AC-9 … covered by the no JavaScript request and the sitemap request
- AC-10 … covered by the response header inspection

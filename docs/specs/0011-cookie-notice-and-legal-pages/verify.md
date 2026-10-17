# Verify: cookie notice and legal pages · spec 0011 · updated 2026-10-17

_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open `/` in a fresh browser with the network panel open → a region labelled `Analytics choice` sits at the bottom, with the pinned sentence, `Accept analytics`, `Decline`, and `Read the privacy page`; both buttons share one variant and size, and neither is preselected → AC-1
- [ ] Tab through the page from the address bar → the banner's link and both buttons are reached without a focus trap, and Enter on the focused button answers the notice → AC-1
- [ ] With no answer stored, browse `/`, `/privacy`, and `/terms` → no request to `eu.i.posthog.com` or its asset host, no analytics script in the network panel, no `ph_` cookie, and no `ph_` key in local storage → AC-2
- [ ] Press `Accept analytics` → the banner disappears with no reload, `cookie-consent=granted` is present, and exactly one `$pageview` for the current address reaches PostHog → AC-3
- [ ] After accepting, reload and open another page → capture carries on, and the header's sign in and sign up events reach PostHog → AC-3
- [ ] In a fresh browser press `Decline` → the banner disappears, `cookie-consent=denied` is present, no request follows for the rest of the session, and PostHog's own cookie and local storage entry are gone → AC-4
- [ ] Reload after either answer → View Source shows no banner in the server HTML, so nothing flashes; the served HTML carries the same answer → AC-5
- [ ] Temporarily shorten `CONSENT_COOKIE_MAX_AGE` to a few seconds, answer, wait for it to lapse, then reload → the banner returns and analytics stays off → AC-5
- [ ] Press `Cookie settings` in the footer after answering → the banner returns, `cookie-consent` is gone, and accepting then declining both apply at once → AC-6
- [ ] Write `cookie-consent=yes` by hand in the browser's developer tools and reload → the banner shows, no PostHog request is made, and the same holds for an empty value → AC-7
- [ ] Request `/privacy` and `/terms` signed out → both answer 200, each has one `<h1>`, one effective date in a `<time>` element, and `<h2>` sections; the contact address is a `mailto:` link whose text matches its target → AC-8
- [ ] At 320 pixels wide, both pages and the banner stay readable, and the last footer link is never covered by the banner after scrolling to the bottom → AC-8
- [ ] In the dark theme, both pages and the banner keep their contrast and focus ring → AC-8
- [ ] Request both pages with JavaScript disabled → each carries its own title, its own description, and a self referencing absolute canonical built from `VITE_SITE_URL` → AC-9
- [ ] Request `/sitemap.xml` → `/privacy` and `/terms` appear as `<loc>` entries with no `<lastmod>` → AC-9
- [ ] Inspect both responses → no `X-Robots-Tag` header and no redirect to sign in → AC-10
- [ ] Build for production with `VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST` absent, then open `/terms` → no banner and no `Cookie settings` control, while `Privacy` and `Terms` remain in the footer → AC-1
- [ ] Change `LEGAL_EFFECTIVE_DATE` in `src/features/privacy/legal.ts` → the visible date and the `<time dateTime>` both move together on both pages → value sourcing
- [ ] Change `LEGAL_CONTACT_EMAIL` → the `mailto:` target and its visible text both move together → value sourcing
- [ ] Change `LEGAL_OPERATOR` → the operator name changes on both pages, and nowhere else in the app hardcodes it → value sourcing
- [ ] As a signed out visitor, open `/privacy` → no sign in prompt appears, and the page renders exactly as it does signed in → AC-8, AC-10

## Commands

- [ ] `npm run typecheck` → no errors → all
- [ ] `npm run generate-routes` → `src/routeTree.gen.ts` gains `/privacy` and `/terms` → AC-8
- [ ] `npx biome check` on `src/features/privacy`, `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/__root.tsx`, `src/routes/sitemap[.]xml.ts`, `src/features/seo/meta.ts` → no errors → all
- [ ] `VITE_SITE_URL=http://localhost:4173 npm run build` then `npm run preview -- --port 4173` → the production build succeeds and serves both pages → AC-8, AC-9

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

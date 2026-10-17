# Verify: SEO metadata and sitemap · spec 0010 · updated 2026-10-17

_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Run `npm run dev` with no `VITE_SITE_URL` set, then request `/` with JavaScript disabled → one title `Skild · Discover and share AI agent skills`, one description meta, and a self referencing canonical → AC-1, AC-5
- [ ] Request `/?q=test` and `/?tag=writing` → no canonical, `meta name="robots" content="noindex, nofollow"`, and the filtered grid still renders → AC-5
- [ ] Request `/skills/pdf-reader` → title `PDF Reader · Skild`, description equal to the stored summary, canonical for that address, `og:title`, `og:description`, `og:type` of `website`, `og:url`, `og:site_name` of `Skild`, `twitter:card` of `summary`, and no `og:image` → AC-2, AC-12
- [ ] On the same skill page, count `application/ld+json` → exactly one `SoftwareApplication` script whose `publisher.name` is the publisher's name, `dateModified` matches the row's `updated_at`, and `userInteractionCount` matches the upvote count → AC-13
- [ ] Request a slug that is not stored → 404 with `X-Robots-Tag: noindex, nofollow`, no social tags, no structured data, and the root title `Skild` → AC-3
- [ ] Hide a skill the sitemap lists, then request `/sitemap.xml` again → the slug is gone, and its page answers 404 with the same noindex header and no tags → AC-3, AC-7
- [ ] Force the detail read to fail (point `DATABASE_URL` at an unreachable host in a preview built for that host) → the page answers 200 with `X-Robots-Tag: noindex, nofollow`, no social tags, and no structured data → AC-3
- [ ] As a signed out visitor, request `/account`, `/admin/skills`, `/skills/new`, `/sign-in`, `/sign-up`, and `/design` → every reply, including the 307 redirect, carries `X-Robots-Tag: noindex, nofollow` → AC-4
- [ ] As a signed in user, and as an admin for the admin area, request the same paths → each page also carries the header → AC-4
- [ ] Request `/sitemap.xml` on the site host → 200, `Content-Type: application/xml; charset=utf-8`, a `<urlset>` with the home entry carrying `<loc>` alone, one `<loc>` and one `YYYY-MM-DD` `<lastmod>` per published skill, no `changefreq` or `priority`, `Cache-Control: public, max-age=3600`, and no `Set-Cookie` → AC-6, AC-9
- [ ] Empty the catalogue and request `/sitemap.xml` → the `<urlset>` still answers with the home entry alone → AC-6
- [ ] Break the store read behind `/sitemap.xml` → 503, `Cache-Control: no-store`, an empty body, and no `<urlset>` → AC-8
- [ ] Request `/robots.txt` on the site host → `User-agent: *`, the six `Disallow` lines including `/skills/new$`, a `Sitemap:` line, no `Disallow: /` or `Disallow: /skills/`, `Vary: Host`, a short `Cache-Control`, and no `Set-Cookie` → AC-10
- [ ] Request the app on another host, including the site's own host name on another port → every response carries the noindex header, and `/robots.txt` answers `Disallow: /` with no `Sitemap:` line and `Cache-Control: no-store` → AC-11
- [ ] Change `VITE_SITE_URL`, rebuild, then request a page → the canonical, the sitemap entries, the `Sitemap:` line, `og:url`, and the structured data URL all move to the new address → AC-14
- [ ] Build for production with `VITE_SITE_URL` absent and start the preview → the failure names `VITE_SITE_URL` as the server entry loads; a malformed value such as `ftp://example.com` fails the same way → AC-14
- [ ] Edit a published skill and request `/sitemap.xml` → that skill's `<lastmod>` moves to the edit date in UTC → AC-6
- [ ] Upvote a skill and request its page → `userInteractionCount` matches the new count → AC-13

## Commands

- [ ] `npm run generate-routes` → `src/routeTree.gen.ts` gains `/sitemap.xml` and `/robots.txt` → AC-6, AC-10
- [ ] `npm run typecheck` → no errors → all
- [ ] `npm run build` → the production build succeeds → all

## Acceptance-criteria coverage

- AC-1 … covered by the home page step · AC-2 … the skill page title and description step · AC-3 … the unknown, hidden, and failed read steps · AC-4 … the private path and redirect steps · AC-5 … the filtered view step · AC-6 … the sitemap steps and `generate-routes` · AC-7 … the hidden skill step · AC-8 … the store failure step · AC-9 … the sitemap headers step · AC-10 … the robots steps and `generate-routes` · AC-11 … the other host step · AC-12 … the skill page social tags step · AC-13 … the structured data and upvote steps · AC-14 … the address change and startup failure steps

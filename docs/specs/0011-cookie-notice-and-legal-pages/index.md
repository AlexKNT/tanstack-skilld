# 0011. Ask before analytics, and publish the privacy and terms pages

**Date**: 2026-10-17
**Status**: Accepted

## Summary

Analytics has to wait for a yes. Today PostHog loads with the app and starts capturing pageviews, exceptions, logs and the identity of signed in users before anyone is asked. This decision adds a small consent record in a cookie, a banner that asks once and remembers the answer for six months, a footer control to change the answer later, and two plain pages at `/privacy` and `/terms` that explain what is collected. No new dependency and no database change.

## Requirements

**User stories**:

- As a first time visitor, I want to be asked, in plain words, before an analytics service stores anything about me, so that the default is no.
- As a visitor who declined, I want the app to work exactly as it did and to stay silent about me, so that saying no costs me nothing.
- As a returning visitor, I want my answer remembered so that I am not asked again on every page.
- As a visitor who changed their mind, I want a way to change it without clearing cookies by hand.
- As a visitor, I want to read what is collected and the rules of the service, from any page.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: A visitor with no stored choice sees a banner at the bottom of every page. It names analytics as the only thing being asked about, says that the sign in and theme storage are necessary and not part of the question, and offers `Accept analytics` and `Decline` as two labelled buttons of equal visual weight with neither preselected. It never blocks the page, never traps focus, and sits in a labelled region. When the analytics environment variables are absent, no banner appears, because the only thing it asks about is not configured.
- **AC-2**: Before a stored choice says `granted`, no request of any kind reaches the PostHog host or its asset host from any page, no external analytics script is loaded, no event, exception, log or feature flag read is sent, and no identifier is written to the browser's storage. This holds for the first pageview, for browsing between pages, and after a reload.
- **AC-3**: Choosing `Accept analytics` writes the consent cookie with the value `granted`, hides the banner with no reload, and from that moment on the existing pageview and event capture works, including the header's sign in and sign up events. The page the visitor was on when they accepted is captured at most once.
- **AC-4**: Choosing `Decline` writes the consent cookie with the value `denied`, hides the banner with no reload, and no analytics request is made for the rest of the session. PostHog's stored consent and any identity it previously kept for this browser are cleared through its own reset step, so a stale grant cannot outlive this answer.
- **AC-5**: The answer survives reloads and new visits for six months, read on the server while rendering, so a returning visitor with a stored answer never sees the banner flash. Once the cookie is older than six months the banner returns and analytics stays off until answered again.
- **AC-6**: A `Cookie settings` control in the footer of every page clears the stored answer and reopens the banner with neither answer selected, and the next choice applies immediately in both directions.
- **AC-7**: A forged or unknown cookie value is treated as no answer: the banner shows and no analytics request is made. The value is narrowed to `granted` or `denied` on read, and anything else is discarded.
- **AC-8**: `GET /privacy` and `GET /terms` render at their own addresses without a session, reachable from a footer link on every page, each with exactly one `<h1>`, an effective date, and readable sections. Both are usable with the keyboard, meet the contrast and focus rules of the design system, and stay readable at 320 pixels wide.
- **AC-9**: Each legal page serves its own title and description in the HTML a crawler sees without running JavaScript, plus a self referencing absolute canonical built from the configured site address, and both addresses appear in `/sitemap.xml` with a location alone, since nothing supplies a timestamp for them.
- **AC-10**: Both legal pages are public: no redirect to sign in, and their responses carry no `X-Robots-Tag` noindex header, because their paths are not in the private path rules of spec 0010 and do not need to be added.

## Decision

**Chosen option**: Option 1: A first party consent cookie, and PostHog held back in place

Consent is recorded in a `cookie-consent` cookie that the server reads during the root load, and PostHog is initialised with every gate closed until that cookie says `granted`. The gate is decided from the cookie while the provider renders, not from an effect, because the provider calls `init()` in its own effect and a child effect cannot be trusted to run first.

**Implementation skills**: `tanstack-start-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-start-best-practices/`) · `tanstack-router-best-practices` (`deckardger/tanstack-agent-skills`, `.agents/skills/tanstack-router-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**:

| Record | Fields | Where | Rules |
|---|---|---|---|
| Consent choice | name `cookie-consent`, value `granted` or `denied` | first party cookie, not `httpOnly` (the browser writes it, the server reads it) | `Path=/`, `SameSite=Lax`, `Secure` wherever the page is served over https, `Max-Age=15552000` (180 days); any other value reads as no choice |
| Consent state in the app | the same value, plus `undefined` for no answer | a client store modelled on the theme's (`useSyncExternalStore`, a module cache, and the server answer as its server snapshot) | the banner, the footer control and the analytics gate all read one snapshot, so a choice applies without a reload |
| Legal page | `title`, `description`, `effectiveDate`, ordered `sections` of `{ heading, paragraphs }` | `src/features/privacy/legal.ts`, typed constants | two entries, Privacy and Terms; no database, no CMS |
| Legal constants | `LEGAL_OPERATOR`, `LEGAL_CONTACT_EMAIL`, `LEGAL_EFFECTIVE_DATE` | the same module, at the top | single source, never typed twice in the copy; placeholders until the engineer fills them |

**State transitions**:

```
no choice  --Accept-->  granted  --Cookie settings-->  no choice
    |                      |
    +-----Decline---------> denied --Cookie settings-->  no choice
```

`granted` and `denied` both expire back to `no choice` after 180 days. There is no other transition, and no state is reachable that is neither of the two values.

**Analytics gate configuration** (decided while the provider renders, from the resolved choice):

| PostHog option | Pending or denied | Granted |
|---|---|---|
| `opt_out_capturing_by_default` | `true` | `false` |
| `opt_out_persistence_by_default` | `true` | `false` |
| `capture_exceptions` | `false` | `true` |
| `disable_external_dependency_loading` | `true` | `false` |
| `advanced_disable_flags` | `true` | `true`, permanently |
| On load | `reset()`, which clears stored consent and identity | nothing |
| On the click | `reset()` then `opt_out_capturing()` | `opt_in_capturing()`, then the two relaxed options, then start exception autocapture once |

Feature flag loading stays off in both states because this app reads no flags, runs no surveys and no experiments, and the option cannot be relaxed later in the same page. `reset()` comes before `opt_out_capturing()` because it is what clears the stored consent, and posthog-js 1.434.15 exposes no argument on the opt out call.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `readConsentChoice` server function | GET | none | `ConsentChoice \| undefined`, narrowed on read | public | never throws; a missing or malformed cookie resolves to `undefined` |
| cookie write and the client store | browser | `granted`, `denied`, or a clear | the new snapshot every control reads | public | none; a value written by someone else is ignored on read |
| `/privacy` | GET | none | HTML, one page head | public | none |
| `/terms` | GET | none | HTML, one page head | public | none |
| `/sitemap.xml` | GET | none | the existing document plus two static entries | public | unchanged, still 503 when the store read fails |

No mutation endpoint is added: the answer lives in the visitor's browser, and the server only reads it.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Decide whether the banner shows | the visitor's choice, or none | the `cookie-consent` cookie, read by `readConsentChoice` in the root load and narrowed by `isConsentChoice` |
| Any control that must react without a reload | the current snapshot and its change | the client store in `use-consent.ts`, whose server snapshot is the answer the root load resolved |
| Banner copy and its link | the purpose named, the necessary storage named, the address of the privacy page | the pinned strings in `legal.ts` |
| Accept | the stored answer, then PostHog's state | the button, then `document.cookie`, then `opt_in_capturing()` and the relaxed options |
| Decline | the stored answer, PostHog's cleared state, and the cleared identity | the button, then `document.cookie`, then `reset()` and `opt_out_capturing()` |
| Footer `Cookie settings` | the empty state again | clearing the cookie with the same attributes and `Max-Age=0`, clearing the client store, then `reset()` and `opt_out_capturing()` |
| Legal page heading, title, description | the values the head and the page render | `PRIVACY_PAGE` and `TERMS_PAGE` in `legal.ts` |
| Legal page canonical | an absolute address | `absoluteSiteUrl("/privacy")` and `absoluteSiteUrl("/terms")` (spec 0010) |
| Legal page effective date and contact | the date under the heading and the address inside the text | `LEGAL_EFFECTIVE_DATE` and `LEGAL_CONTACT_EMAIL` in `legal.ts`, placeholders until filled |
| Whether the footer control and the banner appear at all | configured or not | one `isAnalyticsConfigured()` helper shared with the root document's existing check |
| Sitemap entries | two locations with no `lastmod` | constants beside the home entry in the sitemap route |

**Pinned copy** (so AC-1's claims are checkable rather than invented at build time):

- Banner region label: `Analytics choice`.
- Banner sentence: `We would like to use PostHog analytics to see how the site is used. Your theme and sign in storage are needed to run the site and are not part of this choice.`
- Buttons: `Accept analytics` and `Decline`, same variant and size, neither preselected.
- Link in the banner: `Read the privacy page`, pointing at `/privacy`.
- Footer link labels: `Privacy`, `Terms`, `Cookie settings`.

**Key invariants**:

- While the answer is not `granted`, PostHog sends nothing: no event, no exception, no log, no feature flag request, and no external script.
- While the answer is not `granted`, PostHog writes no identifier to browser storage; an earlier grant's identity is cleared on load.
- The gate is decided from the cookie while the provider renders. Nothing depends on a child effect running before the provider's own effect.
- An unknown cookie value is indistinguishable from no answer, everywhere.
- `Accept analytics` and `Decline` carry the same visual weight, and neither is selected before the visitor chooses.
- Nothing a person types reaches the analytics host before consent, and the existing `before_send` rule that strips the search term keeps applying after it.
- Accepting captures the current page at most once, never twice.
- The legal pages require no session and never appear in the private path rules of spec 0010.
- The operator name, the contact address and the effective date each live in one constant.

**Legal page rendering**:

- The page title is the `<h1>`; each section heading is an `<h2>`; body paragraphs follow. No section skips a level.
- The effective date renders once, under the heading, inside a `<time>` element whose `dateTime` is an ISO date and whose visible text is a fixed human format. Both are strings in `legal.ts`, so the server render and the hydration cannot disagree.
- The contact address renders as a `mailto:` link with the same address as its text.
- Both pages share one layout component, so heading order, spacing and the measure of the text are written once.

**Security model**:

Every surface here is public; no route requires a session. The consent cookie is writable by the visitor, so it is treated as untrusted input and narrowed on read, the same rule the theme cookie follows. The record holds no identifier, no account reference and no personal data, only which of two answers was given, so it adds nothing worth protecting and nothing to leak. The compliance scope is consent for non essential storage and access under GDPR and the ePrivacy rules, taken as the strictest reading of how consent practice is applied, in the EU and the UK; Clerk's session storage and the theme cookie are strictly necessary and stay outside the gate. Analytics identification of a signed in user also waits for consent, which means PostHog's own identity reset on decline is part of the security surface rather than a cleanup detail.

**Configuration required**:

No new environment variables. The existing `VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST` decide whether the banner and the footer control appear at all, through one `isAnalyticsConfigured()` helper that the root document also uses for its existing check. In development those variables are required, so the unconfigured case is verified on a production build. `VITE_SITE_URL` (spec 0010) supplies the absolute addresses for the canonicals and the sitemap.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a fresh browser loads the home page, the banner appears, `Accept analytics` is pressed, then the page is reloaded: no banner, and the pageview reaches PostHog, verifies **AC-1**, **AC-3**, **AC-5**
- Silent default: a fresh browser with no choice browses the home page and a skill page with the network panel open, and no request to the analytics or asset host, and no external analytics script, appears, verifies **AC-2**
- Failure case: a forged cookie value of `yes` is written by hand, then the page is loaded: the banner shows and no request is made, verifies **AC-7**
- Decline and reverse: `Decline` is pressed, no request follows, then the footer control reopens the banner and `Accept analytics` starts capture again, verifies **AC-4**, **AC-6**
- Double count: accepting on a skill page produces exactly one pageview for that address, verifies **AC-3**
- Expiry: with the lifetime temporarily shortened to a few seconds, the banner returns and capture stays off afterwards, verifies **AC-5**
- Auth/permission: a signed out visitor opens `/privacy` and `/terms` directly and reads both, and neither response carries a noindex header, verifies **AC-8**, **AC-10**
- Crawler view: `/privacy` and `/terms` each answer with their own title, description and canonical, and both appear in `/sitemap.xml`, verifies **AC-9**
- Keyboard and narrow screen: the banner is reached and answered with the keyboard alone, and both pages stay readable at 320 pixels, verifies **AC-1**, **AC-8**

## Build plan

Ordered as tracer bullets: the first task proves the whole pipe, from a cookie read on the server through the banner to PostHog actually staying quiet, before either half is filled in.

1. The thin thread: the consent module (cookie name, two values, lifetime, the narrowing), the client store, `readConsentChoice` in the root load beside the theme, the provider's gate options decided from that answer while it renders, the load time cleanup when it is not `granted`, and the banner with `Accept analytics` and `Decline`. Satisfies **AC-1**, **AC-2**, **AC-3**
2. The answer other than yes: `reset()` then `opt_out_capturing()` on decline, the six month lifetime with an expired cookie falling back to no choice, and the forged value treated as no answer. Then the accept path's exception and external loading gates, with one exception reported once. Satisfies **AC-4**, **AC-5**, **AC-7**
3. A footer on every page with the `Cookie settings` reset control and the two page links, plus the matching states for the banner's reappearance. Satisfies **AC-6**
4. The two pages on one shared layout, the typed page content, the drafted copy with markups in place of the operator name, contact address and effective date, and the heading, date and section structure. Satisfies **AC-8**
5. The page heads through the SEO module, the absolute canonicals, and the two static entries in `/sitemap.xml`. Satisfies **AC-9**, **AC-10**
6. The pass that proves it: the network panel on a fresh browser with no choice, keyboard only use of the banner and the footer control, both pages at 320 pixels and in both themes, and a production build started with the analytics variables absent. Satisfies **AC-1**, **AC-2**, **AC-8**

## Consequences

**Positive**:
- The app can honestly say it asks before analytics, and the answer is visible in the server render rather than patched in after hydration.
- The legal pages exist, are linked from every page, and are indexable, which is what a deploy needs before it can be public.
- No new dependency, no database change, and no third party script.
- The footer gives every route a home for the legal links, which the app did not have.

**Negative / tradeoffs**:
- Analytics now covers only visitors who accept. Counts drop, and the drop is not random: visitors in the EU and the UK decline more often, so the funnel the tutorial reads has a sampling bias that must be remembered when reading it.
- Declining also hides the sign in and sign up events for those visitors, so conversion numbers become a measure of consent rates as much as of interest.
- The banner takes screen space until it is answered, and a fixed bar needs matching page padding so the last link on a page is never covered.
- The legal text needs a human review before the site is public, and the placeholders will block a launch if they are forgotten.
- The consent record is per browser, so the same person on a phone and a laptop is asked twice.
- Feature flags, surveys and experiments stay unavailable for the life of a page, because the option that disables their loading cannot be relaxed after start. If this app ever wants them, the gate needs a different arrangement, not a flag to flip.

**Neutral**:
- PostHog's own stored consent and identity are now managed from this app's cookie, through its reset step, so the two can never disagree.
- Exception autocapture starts later than the library would otherwise start it, at the moment of consent, so an error thrown before the answer is deliberately not reported.
- Spec 0010 needs no change: the legal paths are public, so they stay out of the private path rules and out of the noindex header.
- The existing calls to `posthog.capture` in the header and the forms need no edit; while capture is disabled they are dropped.
- The pattern for a client writable preference cookie now appears twice in the repo, which makes it a candidate for a shared helper later.

## Follow-up

- [ ] Fill `LEGAL_OPERATOR`, `LEGAL_CONTACT_EMAIL` and `LEGAL_EFFECTIVE_DATE` with real values before deploy, and remove the placeholder markers.
- [ ] Have the drafted privacy and terms text reviewed by someone qualified before the site is publicly reachable.
- [ ] Confirm on a real network trace that exception autocapture reports an accepted visitor's error exactly once, and never before consent.
- [ ] Revisit the permanently disabled feature flag loading if flags, surveys or experiments are ever wanted; that change needs its own decision.
- [ ] Keep the privacy page's list of cookies and browser storage current, including PostHog's own keys and the consent cookie, if Clerk or the theme feature adds storage.
- [ ] Decide later whether an account level control is wanted, so a signed in person stops being asked on each device.

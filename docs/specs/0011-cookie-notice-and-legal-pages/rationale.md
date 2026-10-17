# 0011. Rationale

_Decision record for [index.md](./index.md): the context, the options considered, and the reasoning behind the choice._

## Context

The app currently collects more than most visitors would guess. PostHog starts at the root of the document, captures every pageview, attaches the signed in user's id and email, records exceptions, ships logs, and writes its own persistent identifiers in browser storage. The only other cookies in play are the theme choice and Clerk's session. Nobody is asked, and nothing in the UI explains any of it.

The strictest reading of consent practice in the EU and the UK, which also satisfies the milder regimes, is that storage or access for analytics needs a yes before it happens. A notice that only informs, or that arrives after the data has already left the browser, does not meet that bar. The practical consequence of not deciding is that the deploy ships an analytics pipeline nobody can justify, and a footer that links nowhere.

Two facts narrow the problem. First, Clerk's session storage and the theme cookie are strictly necessary: the app cannot sign someone in or render the right theme without them, so they stay outside this gate. Second, there is exactly one non essential vendor. That makes a consent management platform (a third party service that renders the banner and records choices) a candidate that is easy to reject on cost and operational grounds.

> ⚠️ Premise note: A banner on its own proves nothing. If PostHog's script still loads and calls its own endpoints before a choice is made, the notice is decoration and the data has already been sent. The load bearing requirement here is the absence of any request to the analytics host until the answer is `granted`, so **AC-2** is the criterion this feature lives or dies on, and the banner is the smaller half of the work. The build must verify it in the browser's network panel, not just in code review.

## Options considered

### Option 1: A first party consent cookie, and PostHog held back in place

The choice lives in one cookie the browser writes and the server reads while rendering, following the pattern the theme already uses. PostHog's provider stays mounted where it is, starts with capture disabled, and is switched on only when the cookie says `granted`. A small sync component reads the cookie and sets PostHog's own state on every load, so the cookie is the only source of truth. The banner and the two legal pages are ordinary components and routes.

**Pros**:
- No new dependency, no third party script, no recurring cost.
- The server knows the answer before the first paint, so a returning visitor never sees the banner flash.
- Reuses a pattern already proven in this codebase, including its "treat the cookie as untrusted" rule.
- The existing `usePostHog()` calls in the header and the forms keep working unchanged.

**Cons**:
- The consent record is a single browser cookie, so the same person on a second device is asked again, and clearing cookies forgets the answer.
- Getting to zero requests needs care in PostHog's own options, so the guarantee depends on the build verifying the network, not on a library doing it for us.

### Option 2: Inform and offer an opt out, with analytics on by default

The banner explains the cookies and offers a way to turn analytics off, but capture runs until someone says no.

**Pros**:
- The smallest change, and it keeps every visitor in the numbers.
- No risk of a drop in the funnel the tutorial is learning from.

**Cons**:
- It does not meet the bar this decision is being made to meet, so the notice would describe a practice that is not lawful in the EU and the UK.
- Turning analytics off after the first pageview has already sent that pageview, which makes the decline partly cosmetic.
- It requires the same banner, footer and pages anyway, so the saving is only the gate.

### Option 3: Mount the analytics provider only after consent

Render `PostHogProvider` only when the answer is `granted`, so nothing from the analytics library exists before then.

**Pros**:
- The strongest possible guarantee: the library is not on the page at all until the answer is yes.
- Impossible to leak through a library option that defaults badly.

**Cons**:
- Every component that calls `usePostHog()` today, including the header, the publish form and the upvote control, would need a fallback, which is a wider change than the gate itself.
- The first pageview after accepting is lost unless it is captured by hand, and events fired in the same tick as the acceptance are easy to miss.

### Option 4: Buy a consent management platform

Use a hosted service such as Cookiebot, Osano or Termly to render the banner, record choices, and manage categories.

**Pros**:
- The vendor keeps up with changing regulation, provides an audit trail, and offers a cookie scanner.
- A category model is ready if marketing or advertising tags arrive later.

**Cons**:
- Another third party script on every page, and that script itself runs before consent, which is the exact thing being fixed.
- A recurring cost and a dependency, for one analytics vendor and one cookie.
- The banner's look drifts from this project's design tokens.

## Rationale

Option 2 was rejected because it fails the only reason to build this: the notice would be describing data that has already left the browser. Option 3 gives a stronger guarantee but pays for it by changing every component that uses analytics, which is exactly the kind of widespread edit the tracer bullet approach is meant to avoid; the network check in AC-2 gets the same guarantee with a fraction of the blast radius. Option 4 would put a third party script ahead of the consent it is meant to collect.

A cookie rather than `localStorage` or a database row follows from the fact that the answer must be known while the document is rendered. The theme already proved this pattern in this repo, down to the rule that a client writable cookie is untrusted input, so the new record costs one module and one line in the root load. A consent table in Postgres would add a migration and a write path for a value with no audit requirement in this build, and would still need a cookie to tie the row to a browser without an account.

For the PostHog gate, the provider stays mounted because the alternative breaks the existing calls. The gate is four options decided from the cookie as the provider renders: capture off, browser storage off, exception autocapture off, and external dependency loading off, so no event and no analytics script can leave the page while the answer is pending. Feature flag loading stays off permanently, since this app uses no flags, surveys or experiments; that also removes the configuration request the library would otherwise make at start. The one thing an effect still does is clean up: when the answer is not `granted`, a load calls PostHog's own `reset()`, which clears its stored consent and any identity left by an earlier grant, so a grant cannot outlive the six month cookie. Accepting calls `opt_in_capturing()`, relaxes the exception and external loading gates, and starts exception autocapture once. Declining resets and then opts out, in that order, because reset clears the consent state the opt out would otherwise read.

The installed library corrects one assumption worth recording: opting out takes no arguments in posthog-js 1.434.15, and clearing what it persisted is `reset()`, not an option. The spec names the calls the installed types actually expose so the build does not invent them.

Two small calls belong to this decision. Accept and Decline carry equal weight and nothing is preselected, because a banner that makes `Accept` brighter than `Decline` is a dark pattern (an interface that nudges toward the answer the site prefers). Six months is the storage lifetime, shorter than the theme cookie's year, because an answer about analytics goes stale faster than a visual preference. Finally, the legal text is drafted from what this repo actually does with data, with the operator name, contact address and effective date left as clearly marked placeholders, since those values belong to the person running the site.

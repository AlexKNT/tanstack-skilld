# Verify: upvotes · spec 0007 · updated 2026-10-15

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verdict: PASS, 2026-10-15.** Every criterion is met against a live store, driven through the production build (`vite preview`) rather than the dev server, whose CSRF warning the browser relays back and forth with the server and floods the console. AC-9 holds: an anonymous call that carries the client's own `x-tsr-serverFn` header answers `{"ok":false,"code":"UNAUTHENTICATED","message":"Sign in to upvote a skill."}` with HTTP 200 and writes no row. An earlier run of this file recorded AC-9 as failing; that reading came from a replay that omitted that header, which makes the framework answer with a bare value rather than a response and Clerk's middleware throw, and it was never the app's own refusal path. The app now answers such a request with a named 400 instead of an unhandled 500 (see `src/start.ts`). One step stays unticked: `npm run check` cannot pass on a Windows working tree, where 19 files that predate this feature sit CRLF on disk and LF in git, so `npx biome check --staged` finds nothing to check. It passes on a Linux checkout, which is what CI runs. The `/test` step waits on a runner this project does not have yet.

## UI / manual

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] Signed out, send the write anyway (through the page's own tooling) → `UNAUTHENTICATED` and no row written → AC-9
- [x] 

## Commands

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [ ] `npm run check` → passes (run with `--staged` on Windows, where the working tree is CRLF and the index is LF) → build guard
- [x] 
- [ ] `/test`: a unit call to `validateSetUpvoteInput` with no `skillId` → `VALIDATION_FAILED` naming `skillId`; with a non boolean `upvoted` → the same, naming `upvoted` → AC-12

## Acceptance criteria coverage

- AC-1 → the migration command and the schema introspection, plus the cascade delete of a skill
- AC-2 → the store duplicate insert and the UI "same direction twice" step
- AC-3 → the signed in upvote step and the card step
- AC-4 → the withdraw step
- AC-5 → the signed out counts step, the signed in upvote step, and the introspection command
- AC-6 → the signed out counts step, the card step, and the session outage step
- AC-7 → the two account step
- AC-8 → the two signed out steps
- AC-9 → the signed out write step
- AC-10 → the signed in upvote step, where the button and the count settle without a second request
- AC-11 → the signed in upvote step and the failed write step
- AC-12 → the store refusal command, the not stored skill step, and the unit step
- AC-13 → the keyboard and live region step
- AC-14 → the analytics step
- AC-15 → the ordering step
- AC-16 → the second migration run

## Value sourcing coverage

Each row of the spec's value sourcing table, with the step that exercises it:

- the count shown on a card and a page, counted from the rows with zero when none match → the signed out counts step, the introspection command
- whether the viewer has voted, from the existence of the pair → the signed out counts step, the two account step
- the viewer segment of the catalogue and detail keys, from `readViewerId` in the root route with a signed out marker when there is none → the two account step
- the state the control asks for, being the inverse of what it was rendered from → the withdraw step
- the state the write reports, being the requested state once the store confirms it → the signed in upvote step
- the new count, read after the write → the signed in upvote step, where the number matches the store
- the page to come back to, passed as the return path the sign in page accepts → the detail page signed out step
- the event's slug, from the payload the control was rendered with → the analytics step
- the event's state, from the value the write returned → the analytics step
- the control's accessible name, from the skill's name plus the feature's own label → the keyboard step
- the announcement of the new count and of a failure, from the polite live region → the signed in upvote step, the failed write step, the keyboard step
- the read that replaces the previous person's state when someone signs in or out → the two account step
- the count and "no viewer" when the session cannot be read → the session outage step

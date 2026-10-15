# tanstack-skilld

## How to talk to me

Short. If a sentence isn't telling me something I need, cut it.

**Ask with an answer attached.** One specific question, and say which way you'd
go and why. "A or B, I'd take B because it keeps the parser standalone" is
answerable in two seconds. An open question isn't. Never pick a direction
silently, never build both.

**When you need something only I can give you** — a key, a token, a value in
`.env.local` — say exactly what and exactly where, then stop.

**No walls of text.** Don't summarise every file you touched or restate the plan
back to me. When a phase is done, say what it does and what the check should
show, in a few lines.

**Plain English.** If you're reaching for a bulleted breakdown of something
that's one sentence, it's one sentence.

**Say when something didn't work.** A failure worked around quietly costs me an
hour later.

## Stack

- **Language / Runtime**: TypeScript 6, strict mode, Node
- **Framework**: TanStack Start with React 19, Vite 8, and TanStack Router (file based routes in `src/routes`)
- **Key dependencies**: TanStack Query, Tailwind CSS 4, shadcn/ui, Clerk
- **Toolchain**: Biome for lint, format, and import sorting
- **Package manager**: npm

## Build approach

Tracer Bullet (prove the whole pipe works end to end before building any one part fully).

## Commands

```bash
npm install              # dependencies
npm run dev              # dev server on http://localhost:3000
npm run build            # production build
npm run preview          # preview the production build
npm run check            # Biome lint and format
npm run generate-routes  # rebuild src/routeTree.gen.ts
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title/index.md`.

## Rules

- Prefer pure functions and immutable data. No shared mutable state, no mutation in place.
- Push side effects to the edges. Transform data with `map`, `filter`, and `reduce`.
- Compose small functions instead of classes. Prefer `undefined` unions over `null`.
- Return explicit failures for expected errors, and handle them at one documented boundary.
- Keep types strict: no `any`, no non null assertions, narrow instead of casting.
- Named exports only, and give each exported function a short doc comment.
- Naming: kebab case files, PascalCase components, `use` prefixes on hooks, and `.server.ts` for a module that must never reach the browser.
- Validate required environment variables at startup.
- UI meets WCAG AA: labelled controls, visible focus, keyboard reachable.
- Folder by feature: a feature's routes, components, hooks, and server functions live together under `src/features/<feature>`. Shared pieces stay in `src/components`, `src/lib`, `src/hooks`, and `src/integrations`.
- Design system: build all UI to `design.md` (art direction and the maximalist product bar); token values live in CSS.
- Style with the semantic tokens in `src/styles.css` plus Tailwind utilities: no literal colour in a component, and no `dark:` colour override, since the tokens answer both themes.

## Tooling

- Lint and format with Biome (`npm run check`). Run lint, format, and typecheck before each commit.
- Tests: Vitest units plus integration tests on real flows. Runner set up later by `/test`.
- CI: lint, typecheck, and tests on every push.

## Git

- one branch: `main`, commit to it directly, no feature or topic branches
- integration: on
- commit: per-milestone

## Agent skills

- [clerk-tanstack-patterns](.agents/skills/clerk-tanstack-patterns/): `clerk/skills`, Clerk auth for TanStack Start
- [tanstack-start-best-practices](.agents/skills/tanstack-start-best-practices/): `deckardger/tanstack-agent-skills`, server functions, middleware, SSR
- [tanstack-router-best-practices](.agents/skills/tanstack-router-best-practices/): `deckardger/tanstack-agent-skills`, type safe routing and data loading
- [tanstack-query-best-practices](.agents/skills/tanstack-query-best-practices/): `deckardger/tanstack-agent-skills`, server state, caching, mutations
- [shadcn](.agents/skills/shadcn/): `shadcn-ui/ui`, adding and customizing components
- [workflow skills](.agents/skills/): `JavaScript-Mastery-Pro/skills`, architect, audit, check, debug, develop, document, scope, sync, test
- MCP servers: TanStack CLI (recommended)

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

- [src/features/account/AGENTS.md](src/features/account/AGENTS.md): the guarded signed in area, its ownership rule, and the profile flows
- [src/features/moderation/AGENTS.md](src/features/moderation/AGENTS.md): hiding a skill, the admin role and area, and the one place the visibility rule lives
- [src/features/theme/AGENTS.md](src/features/theme/AGENTS.md): the cookie backed theme choice and the before paint contract

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

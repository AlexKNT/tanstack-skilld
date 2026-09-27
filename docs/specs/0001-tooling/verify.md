# Verify: Coding standards & tooling · foundation D · updated 2026-09-27

_No spec governs this feature, so there are no `AC-N` ids. The criteria below are the `DW-N` items of the feature's `Done when` line in `docs/scope/scope.md`: lint, format, typecheck, and the test command pass on a clean checkout, and a push runs them. `/check verify tooling` runs these steps; `/test` can lock the durable ones._

## Commands

- [ ] `npm run check` → Biome reports no lint or format problems → DW-1
- [ ] `npm run typecheck` → `tsc --noEmit` exits clean → DW-1
- [ ] `npm run test --if-present` → exits 0. There is no test script yet, so this is a clean no op that starts doing work the moment `/test` adds a runner → DW-2
- [ ] `npm run build` → the client and the server bundles build with no errors → DW-2
- [ ] `git config core.hooksPath` → prints `.husky/_` → DW-3

## Manual

- [ ] Stage a deliberately misformatted file (for example, add a stray double blank line to `src/routes/index.tsx`), then `git commit` → the commit is blocked and Biome names the offending file → DW-3
- [ ] Commit valid work → the commit succeeds with no hook output → DW-3
- [ ] Remove `node_modules`, run `npm install`, then `git config core.hooksPath` → `.husky/_` is recreated, so a fresh clone needs no extra setup step → DW-3
- [ ] Push to `main` → the CI run shows Lint and format, Typecheck, Test, and Build all green → DW-4

## Acceptance-criteria coverage

- DW-1 lint, format, and typecheck pass → covered by the first two commands
- DW-2 the test command passes → covered by the guarded test command and the build
- DW-3 the checks run before each commit → covered by the hook path check and the blocked commit
- DW-4 a push runs them → covered by the CI run

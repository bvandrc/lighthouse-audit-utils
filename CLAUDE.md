## Project

`lighthouse-audit-utils` — programmatic Lighthouse audit utilities for CI:
check scores against thresholds, write HTML/JSON reports to disk, and log
recommendations to the terminal. Published to npm, bundled by tsdown.

- **Layout**: `src/` is the whole package. Two entrypoints: `src/index.ts`
  (`.`) and `src/playwright.ts` (`./playwright`).
- **Peers**: `lighthouse` is required; `@playwright/test` is optional and only
  needed by the `./playwright` entrypoint — keep it out of the main
  entrypoint's import graph.

## Code conventions

Conventions live outside this file, synced from
https://github.com/bvandrc/bvandrc-conventions — follow all of them:

@conventions/typescript.md — language-level TypeScript/JavaScript rules
@conventions/playwright.md — test layout, test IDs, and accessibility scans
@conventions/git.md — branch naming, formatting, and PR review practice

## Commands

- `pnpm build` — tsdown bundle. `pnpm start` — tsdown in watch mode.
- `pnpm format` — Biome check/fix. `pnpm check` — the full gate: Biome plus
  `pnpm ts:check` (`tsc --noEmit`); it's what CI runs.

## Repo conventions

- **Package manager**: pnpm. `npm install` writes a competing
  `package-lock.json` that CI ignores.
- **Convention files**: `conventions/` is synced from
  https://github.com/bvandrc/bvandrc-conventions by
  `.github/workflows/sync-conventions.yml` and overwritten on every sync. Edit
  a rule upstream, never in that directory.

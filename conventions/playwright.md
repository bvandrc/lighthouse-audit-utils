# Playwright conventions

Builds on the language-level rules in `./typescript.md`, and the suite-agnostic rules in `./ts-testing-all.md` — follow those too.

- **Layout**: All Playwright tests live in `playwright/`, split by project: `playwright/e2e/`, `playwright/a11y/`, `playwright/lighthouse/`, with shared helpers under `playwright/support/`. Type checking uses `playwright/tsconfig.json`, separate from the app's.
- **Accessibility tests**: axe runs at WCAG 2.1 AA plus best-practice on desktop and mobile, and violations fail CI. Cover each new meaningful UI state with a `checkA11y(page)` scan in `playwright/a11y/`.

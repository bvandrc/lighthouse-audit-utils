# Playwright conventions

Builds on the language-level rules in `./typescript.md` — follow those too.

- **Layout**: All Playwright tests live in `playwright/`, split by project: `playwright/e2e/`, `playwright/a11y/`, `playwright/lighthouse/`, with shared helpers under `playwright/support/`. Type checking uses `playwright/tsconfig.json`, separate from the app's.
- **Selectors**
  - **Test ID registry**: See the rule in `./all.md` — it holds for every suite, not just this one.
  - **Locators**: Reach for `data-testid` first. Text, role, and class-based locators break on copy edits, markup changes, and styling churn, so use them only where a testid isn't an option — third-party markup you don't control, or an assertion whose whole point is the visible text or the accessible role.
- **Accessibility tests**: axe runs at WCAG 2.1 AA plus best-practice on desktop and mobile, and violations fail CI. Cover each new meaningful UI state with a `checkA11y(page)` scan in `playwright/a11y/`.

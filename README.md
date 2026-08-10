# lighthouse-audit-utils

Programmatic [Lighthouse](https://github.com/GoogleChrome/lighthouse) audit utilities for CI and performance testing: score-threshold checking, HTML/JSON report writing, and a recommendations logger (ie, what is seen in a lighthouse report UI), all from a finished Lighthouse run in one call. Each step can be configured or disabled.

Running the audits from Playwright? [`lighthouse-audit-utils/playwright`](#playwright)
ships the CDP wiring as a fixture, so a test can audit whatever page it's on —
handy for Lighthouse CI-style performance budgets inside a Playwright suite.

```bash
npm install --save-dev lighthouse-audit-utils
```

`lighthouse` is a peer dependency; `@playwright/test` is an optional one, needed
only if using the [Playwright entrypoint](#playwright).

## Usage

`runAudit` audits a URL and handles the result:

```ts
import { runAudit } from 'lighthouse-audit-utils'

await runAudit({
  lighthouseArgs: {
    url: 'https://example.com',
    flags: { port, output: ['html', 'json'] },
  },
  reports: { directory: 'lighthouse', name: 'desktop' },
  thresholds: { performance: 90 },
})
```

`lighthouseArgs` is handed to `lighthouse()`, in the order it takes them:

| Option   | Default    | Description                                           |
| -------- | ---------- | ----------------------------------------------------- |
| `url`    | _required_ | The URL to audit                                      |
| `flags`  | _none_     | Settings for the run, e.g. the `port` Lighthouse uses |
| `config` | _none_     | Overrides the default config, e.g. `desktopConfig`    |

Everything else it takes is passed straight to `handleAuditResult` below, which returns `{ result, failures }`.

## `handleAuditResult`

Handles a run you've already made yourself — this is what `runAudit` calls with the result from the actual `lighthouse()` audit:

```ts
import lighthouse from 'lighthouse'
import { handleAuditResult } from 'lighthouse-audit-utils'

const result = await lighthouse(url, { port, output: ['html', 'json'] })
if (!result) throw new Error('Lighthouse returned no result')

await handleAuditResult({
  result,
  reports: { directory: 'lighthouse', name: 'desktop' },
  thresholds: { performance: 90 },
})
```

The three steps run in that order — reports, recommendations, thresholds — so a
failing run still prints its recommendations before throwing.

| Option            | Default    | Description                                                  |
| ----------------- | ---------- | ------------------------------------------------------------ |
| `result`          | _required_ | The full `RunnerResult` from a Lighthouse run                |
| `reports`         | _none_     | Where to write the reports; omit to skip writing them        |
| `recommendations` | _none_     | Recommendation logging options, or `false` to skip           |
| `thresholds`      | `100`      | Minimum scores (0-100) — one number for all, or per category |
| `ignoreError`     | `false`    | Return the threshold failures rather than throwing on them   |

```ts
// just the log
await handleAuditResult({ result, ignoreError: true })

// just the thresholds
await handleAuditResult({ result, recommendations: false })
```

### `reports`

| Option      | Default    | Description                                                    |
| ----------- | ---------- | -------------------------------------------------------------- |
| `directory` | _required_ | Directory to write into; created if it doesn't exist           |
| `name`      | _required_ | Base filename, e.g. `desktop` → `desktop.html`, `desktop.json` |

Each report is written to `<directory>/<name>.<format>`, using the formats the
run's `output` flag asked for.

### `thresholds`

One number applies to every category; an object sets them individually. Any
category you leave out has to score 100, so the strict case is the default:

```ts
await handleAuditResult({ result }) // every category must score 100
await handleAuditResult({ result, thresholds: 90 })
await handleAuditResult({ result, thresholds: { performance: 90 } })
```

Only the categories present that are scored in the lighthouse report are checked.

### `ignoreError`

Returns the threshold failures instead of throwing an error, so you can decide what to do with
them. `undefined` when everything passed.

### `recommendations`

| Option           | Default        | Description                                                    |
| ---------------- | -------------- | -------------------------------------------------------------- |
| `label`          | `reports.name` | Distinguishes runs of the same URL, e.g. `desktop`/`mobile`    |
| `maxItems`       | `5`            | Rows shown per audit before collapsing to "…and N more"        |
| `maxValueLength` | `120`          | Max length of a single value before it's truncated with an "…" |

Pass `recommendations: false` to skip the log entirely.

#### Output

The log is the same recommendations the report UI shows — failing audits, their
estimated savings, and the individual offending URLs/nodes — so a failing CI run
is actionable without downloading and opening the HTML report. Audits are
grouped by category and sorted by estimated savings, so the biggest wins come
first:

```
───── Lighthouse recommendations: desktop — https://example.com/ ─────

Performance: 87
  • Reduce unused JavaScript (Est savings of 1,010 KiB)
      unused-javascript · score 50
        - https://example.com/assets/vendor.css  ·  Transfer Size: 24.1 KiB
        - https://example.com/assets/fonts.css  ·  Transfer Size: 7.3 KiB
        - https://example.com/assets/dep-vendor-1.js  ·  Transfer Size: 372 KiB  ·  Est Savings: 343 KiB
        - https://example.com/assets/dep-vendor-2.js  ·  Transfer Size: 176 KiB  ·  Est Savings: 149 KiB
        - …and 2 more
  • Properly size images (Potential savings of 96 KiB)
      uses-responsive-images · score 62
        - https://example.com/hero.png  ·  Size: 142 KiB
        - …and 3 more
  • Render-blocking requests — est. savings: FCP 310 ms, LCP 310 ms
      render-blocking-insight · score 50
        - https://example.com/assets/index.css  ·  Transfer Size: 12.4 KiB  ·  Duration: 52 ms

Accessibility: 100 — nothing to flag
```

## Individual utilities

The three steps are also exported on their own, each taking the report first and
its options second:

```ts
writeReports(result, { directory, name })
logRecommendations(lhr, { label, maxItems, maxValueLength })
checkAgainstThresholds(lhr, { thresholds, ignoreError })
```

## Playwright

`lighthouse-audit-utils/playwright` ships the wiring as a fixture.

```ts
// fixtures.ts
import { desktopConfig } from 'lighthouse'
import { withLighthouse } from 'lighthouse-audit-utils/playwright'

export const lighthouseTest = withLighthouse({
  basePort: 9222,
  lighthouseArgs: {
    flags: { disableStorageReset: true, output: ['html', 'json'] },
    config: {
      extends: 'lighthouse:default',
      settings: { skipAudits: ['color-contrast'] },
    },
  },
  thresholds: { performance: 70 },
})

// a.spec.ts
lighthouseTest('home page', async ({ page, runAudit }) => {
  await page.goto('/')
  await runAudit({
    name: 'desktop',
    lighthouseArgs: { config: desktopConfig },
  })
  await runAudit({ name: 'mobile', thresholds: { performance: 60 } }) // merges over the fixture's value
})
```

- Each call to `runAudit` audits whatever page the test is currently on and writes its reports to the test's output directory.
- Run `runAudit` more than once for more than one form factor
  — wrap the calls in `test.step` if you want them grouped in the report.
- `withLighthouse(options, test)` takes the test to extend second, so you can layer
  it onto your own fixtures; omit it to start from Playwright's `test`.

| Option           | Required | Description                                                                              |
| ---------------- | -------- | ---------------------------------------------------------------------------------------- |
| `basePort`       | yes      | First worker's CDP port; each further worker gets the next one up                        |
| `lighthouseArgs` | no       | `flags` and `config` for `lighthouse()`; `url` and `flags.port` are set for you          |
| `reports`        | no       | `(context) => { directory, name }`, or `false` to skip writing them                      |
| `launchOptions`  | no       | Merged into the persistent context launch, which already sets the CDP port and `baseURL` |

Plus everything [`runAudit`](#usage) from `lighthouse-audit-utils` takes —
`thresholds`, `ignoreError`, `recommendations`.

The `runAudit` fixture takes `name` — which names that run's reports, so two
audits in one test don't overwrite each other — and `lighthouseArgs`,
`thresholds`, `ignoreError` and `recommendations`, to overwrite the overall fixture's:

```ts
const { result, failures } = await runAudit({
  name: 'logged-in',
  thresholds: { performance: 50 },
  lighthouseArgs: { config: { settings: { onlyCategories: ['performance'] } } },
})
```

`thresholds` merge when both are objects; anything else replaces, since a flat
number can't be partially overridden.

`context` is overridden to launch a persistent Chrome profile on the CDP port,
since Lighthouse navigates over that port itself rather than driving the
Playwright `page` — this way both see the same browser session.

### Doing it by hand

```ts
import { desktopConfig } from 'lighthouse'
import { runAudit } from 'lighthouse-audit-utils'

await runAudit({
  lighthouseArgs: {
    url: page.url(),
    flags: { port, output: ['html', 'json'] },
    config: desktopConfig,
  },
  reports: { directory: testInfo.outputPath('lighthouse'), name: 'desktop' },
  thresholds: { performance: 90 },
})
```

## Development

```bash
pnpm install
pnpm build       # tsup → dist/ (types via tsc)
pnpm start       # tsup watch
pnpm check       # biome + tsc
pnpm format      # biome check --fix
```

CI type-checks and builds against both supported peer majors, Lighthouse 12 and
13, on Node 22/24/26.

## License

MIT

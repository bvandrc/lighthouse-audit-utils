# lighthouse-audit-utils

Everything you'd do with a finished Lighthouse run, in one call: write the
reports to disk, print the fix list to the terminal, and fail the run if a
category scored below its threshold. Each step can be configured or disabled.

```bash
npm install --save-dev lighthouse-audit-utils
```

`lighthouse` is a peer dependency (used for its types).

## Usage

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
failing run still prints its fix list before throwing.

| Option            | Default    | Description                                                  |
| ----------------- | ---------- | ------------------------------------------------------------ |
| `result`          | _required_ | The full `RunnerResult` from a Lighthouse run                |
| `reports`         | _none_     | Where to write the reports; omit to skip writing them        |
| `recommendations` | _none_     | Recommendation logging options, or `false` to skip                  |
| `thresholds`      | `100`      | Minimum scores (0-100) — one number for all, or per category |
| `ignoreError`     | `false`    | Return the threshold failures rather than throwing on them              |


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

The log is the same fix list the report UI shows — failing audits, their
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

Accessibility: 100 — nothing to fix
```

## Example: Playwright

Lighthouse navigates over the CDP port itself, so launch a persistent context on
that port and point `lighthouse` at it.

```ts
import lighthouse, { desktopConfig } from 'lighthouse'
import { handleAuditResult } from 'lighthouse-audit-utils'

const result = await lighthouse(
  page.url(),
  { port, output: ['html', 'json'] },
  desktopConfig
)
if (!result) throw new Error('Lighthouse returned no result')

await handleAuditResult({
  result,
  reports: { directory: testInfo.outputPath('lighthouse'), name: 'desktop' },
  thresholds: { performance: 90 },
})
```

## Individual utilities

The three steps are also exported on their own, each taking the report first and
its options second:

```ts
writeReports(result, { directory, name })
logRecommendations(lhr, { label, maxItems, maxValueLength })
checkAgainstThresholds(lhr, { thresholds, ignoreError })
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

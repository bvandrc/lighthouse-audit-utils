# lighthouse-log-recommendations

Prints the same fix list the Lighthouse report UI shows — failing audits, their
estimated savings, and the individual offending URLs/nodes — straight to the
terminal, so a failing CI run is actionable from the log without downloading and
opening the HTML report.

```bash
npm install --save-dev lighthouse-log-recommendations
```

`lighthouse` is a peer dependency (used for its types).

## Usage

```ts
import { logRecommendations } from 'lighthouse-log-recommendations'

logRecommendations({
  lhr, // the `lhr` object from a Lighthouse run
})
```

### Options

| Option           | Default    | Description                                                    |
| ---------------- | ---------- | -------------------------------------------------------------- |
| `lhr`            | _required_ | The Lighthouse result object                                   |
| `label`          | _none_     | Distinguishes runs of the same URL, e.g. `desktop`/`mobile`    |
| `maxItems`       | `5`        | Rows shown per audit before collapsing to "…and N more"        |
| `maxValueLength` | `120`      | Max length of a single value before it's truncated with an "…" |

## Example: Playwright

With [`playwright-lighthouse`](https://github.com/abhinaba-ghosh/playwright-lighthouse),
pass `ignoreError: true` so a failed threshold doesn't throw before the report is
returned — re-throw it after logging instead.

```ts
import path from 'node:path'
import { playAudit } from 'playwright-lighthouse'

import { logRecommendations } from 'lighthouse-log-recommendations'

const directory = testInfo.outputPath('lighthouse')

const { lhr, comparisonError } = await playAudit({
  page,
  port,
  thresholds: { performance: 100 },
  reports: { formats: { html: true }, directory, name: 'desktop' },
  // ignoreError so the recommendations still print when a threshold fails (playAudit otherwise throws before returning the report)
  ignoreError: true,
})

logRecommendations({ lhr, label: 'desktop' })

if (comparisonError) throw new Error(comparisonError)
```

## Output

Audits are grouped by category and sorted by estimated savings, so the biggest
wins come first:

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

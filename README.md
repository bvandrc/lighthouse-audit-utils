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
  label: 'desktop',
  lhr, // the `lhr` object from a Lighthouse run
  reportPath: '/path/to/report.html',
})
```

### Options

| Option           | Default    | Description                                                    |
| ---------------- | ---------- | -------------------------------------------------------------- |
| `label`          | _required_ | Name for this run, shown in the header (e.g. `desktop`)        |
| `lhr`            | _required_ | The Lighthouse result object                                   |
| `reportPath`     | _required_ | Path printed at the end, pointing at the full HTML report      |
| `maxItems`       | `5`        | Rows shown per audit before collapsing to "…and N more"        |
| `maxValueLength` | `120`      | Max length of a single value before it's truncated with an "…" |

## Example: Playwright fixture

A Playwright fixture that runs desktop and mobile audits with
[`playwright-lighthouse`](https://github.com/abhinaba-ghosh/playwright-lighthouse)
and logs the recommendations for each. `ignoreError: true` matters here —
without it, `playAudit` throws on a failed threshold before returning the report,
so nothing gets logged; the threshold failure is re-thrown after logging instead.

```ts
import path from 'node:path'
import { test as baseTest } from '@playwright/test'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import {
  playAudit,
  type playwrightLighthouseConfig,
} from 'playwright-lighthouse'

import { logRecommendations } from 'lighthouse-log-recommendations'

// Manually set values that are passing as of initial commit.
const BASE_THRESHOLDS = {
  performance: 100,
  accessibility: 100,
  'best-practices': 100,
  seo: 100,
}

export const lighthouseTest = baseTest.extend<{
  /** Run both desktop and mobile Lighthouse audits against the current page. */
  runAudit: (options?: {
    thresholdOverrides?: playwrightLighthouseConfig['thresholds']
  }) => Promise<void>
}>({
  runAudit: async ({ page }, use, testInfo) => {
    await use(async ({ thresholdOverrides } = {}) => {
      const runAudit = async (
        label: string,
        config: Omit<playwrightLighthouseConfig, 'page' | 'port' | 'reports'>,
      ) => {
        const directory = testInfo.outputPath('lighthouse')

        const { lhr, comparisonError } = await playAudit({
          ...config,
          page,
          port: 9222, // the CDP port Chrome was launched with
          thresholds: { ...BASE_THRESHOLDS, ...thresholdOverrides },
          reports: {
            formats: { html: true, json: true },
            directory,
            name: label,
          },
          ignoreError: true,
        })

        logRecommendations({
          label,
          lhr,
          reportPath: path.join(directory, `${label}.html`),
        })

        if (comparisonError) throw new Error(comparisonError)
      }

      await baseTest.step('desktop', () =>
        runAudit('desktop', { config: { ...desktopConfig } }),
      )
      await baseTest.step('mobile', () => runAudit('mobile', {}))
    })
  },
})
```

Lighthouse navigates itself over the CDP port rather than driving the Playwright
`page`, so the browser has to be launched with `--remote-debugging-port` and both
Playwright and Lighthouse have to share that profile — typically via
`chromium.launchPersistentContext` in a `context` fixture override, with a port
derived from `workerInfo.parallelIndex` so parallel workers don't collide.

## Output

Audits are grouped by category and sorted by estimated savings, so the biggest
wins come first:

```
───── Lighthouse recommendations: desktop — https://example.com/ ─────

Performance: 87
  • Eliminate render-blocking resources — est. savings: LCP 420 ms, 31.4 KiB
      render-blocking-resources · score 45
        - https://example.com/assets/vendor.css  ·  Transfer Size: 24.1 KiB
        - https://example.com/assets/fonts.css  ·  Transfer Size: 7.3 KiB
  • Properly size images (Potential savings of 96 KiB)
      uses-responsive-images · score 62
        - https://example.com/hero.png  ·  Size: 142 KiB
        - …and 3 more

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

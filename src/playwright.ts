import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  test as baseTest,
  chromium,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestInfo,
  type TestType,
} from '@playwright/test'
import { toMerged } from 'es-toolkit'

import type { HandleAuditResultArgs } from './handle-audit-result'
import type { LighthouseArgs } from './run-audit'
import { runAudit as runLighthouse } from './run-audit'
import type { WriteReportsArgs } from './write-reports'

/** What `runAudit` takes on top of the overrides it shares with the fixture. */
export type RunAuditOptions = {
  /** Names this run's reports, so audits in the same test don't overwrite each other. */
  name?: string
} & AuditOverrides

/** Settable per fixture and again per `runAudit` call, the later one winning. */
type AuditOverrides = {
  /**
   * - Passed to `lighthouse()`, minus the `url` — that's whatever page the test
   *   is on.
   * - `flags` merge over the worker's `port`, the only one set for you
   * - `config` deep merges, so `settings` layer rather than replacing each other.
   * - Config arrays merge by index, so list settings like `skipAudits` are best
   *   set at one level only.
   */
  lighthouseArgs?: Omit<LighthouseArgs, 'url'>
} & Omit<HandleAuditResultArgs, 'result' | 'reports'>

export type LighthouseFixtures = {
  /**
   * Runs one Lighthouse audit against the current page. Call it again for a
   * second form factor, passing that form factor's `config` and `name`.
   */
  runAudit: (options?: RunAuditOptions) => ReturnType<typeof runLighthouse>
}

export type LighthouseWorkerFixtures = {
  /** CDP port Lighthouse connects to. Unique per worker so parallel workers don't collide. */
  lighthousePort: number
}

/** Everything the reports' location can be decided from. */
export type ReportsContext = {
  testInfo: TestInfo
  /** The `name` the `runAudit` call passed, if any. */
  name?: string
}

export type LighthouseFixtureOptions = {
  /** First worker's CDP port, e.g. `9222`; each further worker gets the next one up. */
  basePort: number
  /** Where each run's reports go. Pass `false` to skip writing them. */
  reports?: ((context: ReportsContext) => WriteReportsArgs) | false
  /** Merged into the persistent context launch, which already sets the CDP port and `baseURL`. */
  launchOptions?: Parameters<typeof chromium.launchPersistentContext>[1]
} & AuditOverrides

const defaultReports = ({ testInfo, name }: ReportsContext) => ({
  directory: testInfo.outputPath('lighthouse'),
  name: name ?? 'lighthouse',
})

/** Object thresholds merge; anything else replaces, since a flat number can't be partially overridden. */
const mergeThresholds = (
  base: AuditOverrides['thresholds'],
  override: AuditOverrides['thresholds']
): AuditOverrides['thresholds'] => {
  if (override === undefined) {
    return base
  }
  if (typeof override === 'number' || typeof base !== 'object') {
    return override
  }
  return { ...base, ...override }
}

type BaseTest = TestType<
  PlaywrightTestArgs & PlaywrightTestOptions,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>

/**
 * Adds a `runAudit` fixture that audits whatever page the test is currently on.
 *
 * Lighthouse navigates over the CDP port itself rather than driving the
 * Playwright `page`, so `context` is overridden to launch a persistent Chrome
 * profile reachable on that port — the page Playwright drives and the page
 * Lighthouse audits then live in the same profile.
 *
 * @param test the test to extend, so callers can layer this onto their own fixtures
 */
export const withLighthouse = <T extends BaseTest>(
  {
    basePort,
    reports = defaultReports,
    launchOptions,
    ...fixtureOverrides
  }: LighthouseFixtureOptions,
  test: T = baseTest as unknown as T
) =>
  test.extend<LighthouseFixtures, LighthouseWorkerFixtures>({
    runAudit: async ({ page, lighthousePort: port }, use, testInfo) => {
      // `lighthouseArgs` and `thresholds` merge with the fixture's rather than
      // replacing them, so a call only has to name what it changes.
      await use(({ name, lighthouseArgs, thresholds, ...callArgs } = {}) => {
        const {
          lighthouseArgs: baseArgs,
          thresholds: baseThresholds,
          ...handleArgs
        } = { ...fixtureOverrides, ...callArgs }

        return runLighthouse({
          lighthouseArgs: {
            url: page.url(),
            flags: { port, ...baseArgs?.flags, ...lighthouseArgs?.flags },
            config: toMerged(
              baseArgs?.config ?? {},
              lighthouseArgs?.config ?? {}
            ),
          },
          reports: reports ? reports({ testInfo, name }) : undefined,
          thresholds: mergeThresholds(baseThresholds, thresholds),
          ...handleArgs,
        })
      })
    },

    lighthousePort: [
      // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring for the fixtures arg
      async ({}, use, workerInfo) => {
        await use(basePort + workerInfo.parallelIndex)
      },
      { scope: 'worker' },
    ],

    context: async ({ lighthousePort: port, baseURL }, use) => {
      const userDataDir = path.join(
        os.tmpdir(),
        `pw-lighthouse-${port}-${Date.now()}`
      )

      const context = await chromium.launchPersistentContext(userDataDir, {
        baseURL,
        ...launchOptions,
        args: [
          `--remote-debugging-port=${port}`,
          ...(launchOptions?.args ?? []),
        ],
      })

      await use(context)
      await context.close()

      // Best-effort cleanup; a leftover profile dir doesn't affect test correctness.
      await rm(userDataDir, { recursive: true, force: true }).catch(
        () => undefined
      )
    },
  })

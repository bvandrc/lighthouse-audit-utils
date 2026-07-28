import lighthouse, { type Config, type Flags } from 'lighthouse'

import {
  type HandleAuditResultArgs,
  handleAuditResult,
} from './handle-audit-result'

/** What `lighthouse()` itself takes, in the order it takes it. */
export type LighthouseArgs = {
  /** The URL to audit */
  url: string
  /** Settings for the run, e.g. the `port` Lighthouse connects to */
  flags?: Flags
  /** Overrides the default config, e.g. `desktopConfig` */
  config?: Config
}

/**
 * Audits a URL and hands the result straight to {@link handleAuditResult}.
 *
 * @returns the run's result, plus the threshold failures if `ignoreError` kept
 * them from throwing
 */
export const runAudit = async ({
  lighthouseArgs: { url, flags, config },
  ...handleArgs
}: {
  /** Passed through to `lighthouse()` */
  lighthouseArgs: LighthouseArgs
} & Omit<HandleAuditResultArgs, 'result'>) => {
  const result = await lighthouse(url, flags, config)
  if (!result) {
    throw new Error(`Lighthouse returned no result for ${url}`)
  }

  const failures = await handleAuditResult({ result, ...handleArgs })

  return { result, failures }
}

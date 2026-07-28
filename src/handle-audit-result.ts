import type { RunnerResult } from 'lighthouse'

import { type FormattingArgs, logRecommendations } from './log-recommendations'
import { checkAgainstThresholds, type ThresholdsArgs } from './thresholds'
import { type WriteReportsArgs, writeReports } from './write-reports'

/**
 * Everything you'd do with a finished Lighthouse run:
 *  1. write the reports
 *  2. log the recommendations
 *  3. check the scores against the thresholds (goes last so reporting occurs before throwing).
 *
 * @returns the threshold failures, if `ignoreError` kept them from throwing
 */
export const handleAuditResult = async ({
  result,
  reports,
  thresholds,
  ignoreError,
  recommendations,
}: {
  /** The full `RunnerResult` from a Lighthouse run */
  result: RunnerResult
  /** Where to write the reports. Omit to skip writing them. */
  reports?: WriteReportsArgs
  /** Options for recommendations logging. Set to `false` to disable. */
  recommendations?:
    | (FormattingArgs & {
        /** Distinguishes runs of the same URL in one log. Defaults to `reports.name`. */
        label?: string
      })
    | false
} & ThresholdsArgs) => {
  if (reports) {
    await writeReports(result, reports)
  }

  if (recommendations !== false) {
    logRecommendations(result.lhr, {
      label: reports?.name,
      ...recommendations,
    })
  }

  const failures = checkAgainstThresholds(result.lhr, {
    thresholds,
    ignoreError,
  })

  return failures
}

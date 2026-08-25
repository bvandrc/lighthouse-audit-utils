import type { RunnerResult } from 'lighthouse'

import {
  type BudgetFailure,
  type BudgetsArgs,
  checkAgainstBudgets,
} from './budgets'
import { type FormattingArgs, logRecommendations } from './log-recommendations'
import {
  checkAgainstThresholds,
  type ThresholdFailure,
  type ThresholdsArgs,
} from './thresholds'
import { type WriteReportsArgs, writeReports } from './write-reports'

/** Either way a run can come up short: a category's score, or an audit's bytes. */
export type AuditFailure = ThresholdFailure | BudgetFailure

export type HandleAuditResultArgs = {
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
} & ThresholdsArgs &
  BudgetsArgs

/**
 * Everything you'd do with a finished Lighthouse run:
 *  1. write the reports
 *  2. log the recommendations
 *  3. check the budgets, then the scores against the thresholds (both go last
 *     so reporting occurs before throwing).
 *
 * Budgets are checked first: a category score barely moves on wasted bytes, so
 * when a run breaks both, the budget is the more specific thing to report.
 *
 * @returns the failures of both checks, if `ignoreError` kept them from throwing
 */
export const handleAuditResult = async ({
  result,
  reports,
  thresholds,
  budgets,
  ignoreError,
  recommendations,
}: HandleAuditResultArgs) => {
  if (reports) {
    await writeReports(result, reports)
  }

  if (recommendations !== false) {
    logRecommendations(result.lhr, {
      label: reports?.name,
      ...recommendations,
    })
  }

  const budgetFailures = checkAgainstBudgets(result.lhr, {
    budgets,
    ignoreError,
  })

  const thresholdFailures = checkAgainstThresholds(result.lhr, {
    thresholds,
    ignoreError,
  })

  const failures: AuditFailure[] = [
    ...(budgetFailures ?? []),
    ...(thresholdFailures ?? []),
  ]

  return failures.length ? failures : undefined
}

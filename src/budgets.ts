import type { RunnerResult } from 'lighthouse'

type Lhr = RunnerResult['lhr']

const BYTES_PER_KIB = 1024

/**
 * Byte-savings audits present in every supported Lighthouse major — all of
 * them report `overallSavingsBytes`. Any audit id that reports it can be
 * budgeted; these are just the known ones. Which a given run produces depends
 * on its major, since Lighthouse 13 replaced several opportunity audits with
 * insights (`legacy-javascript` became `legacy-javascript-insight`, and so on).
 */
export type SavingsAudit =
  | 'unminified-css'
  | 'unminified-javascript'
  | 'unused-css-rules'
  | 'unused-javascript'

/** Per-audit ceilings on wasted KiB, e.g. `{ 'unused-javascript': 700 }`. */
export type SavingsBudgets = Partial<
  Record<
    // `string & {}` keeps `SavingsAudit`'s autocomplete while still accepting
    // the ids it doesn't list -- a closed union would go stale across majors.
    SavingsAudit | (string & {}),
    number
  >
>

/** An audit that wasted more KiB than it was budgeted. */
export type BudgetFailure = {
  /** The audit's id as the run reported it — usually a `SavingsAudit`. */
  audit: string
  /** The ceiling this audit was checked against. */
  budgetKib: number
  /** What it actually wasted. */
  wastedKib: number
}

/**
 * The audit's wasted KiB, or `undefined` when it reported no savings — either
 * because it didn't apply to this page or because there was nothing to save.
 */
const getWastedKib = (lhr: Lhr, audit: string): number | undefined => {
  const details = lhr.audits[audit]?.details
  const bytes =
    details && 'overallSavingsBytes' in details
      ? details.overallSavingsBytes
      : undefined
  return bytes === undefined ? undefined : bytes / BYTES_PER_KIB
}

export type BudgetsArgs = {
  /**
   * Maximum wasted KiB per audit. Only the audits named are checked; budgeting
   * one the run never produced throws, so a budget can't pass on a blank.
   */
  budgets?: SavingsBudgets
  /** Return the failures rather than throwing them. */
  ignoreError?: boolean
}

/**
 * Checks each budgeted audit's estimated savings against its ceiling, throwing
 * an error describing the ones that went over. Pass `ignoreError` to get those
 * back instead, so the caller can log the recommendations before failing.
 *
 * Category scores barely move on bytes that are downloaded and never run, so a
 * budget is what keeps a page's payload from growing under a green report.
 */
export const checkAgainstBudgets = (
  /** The Lighthouse result object */
  lhr: Lhr,
  { budgets = {}, ignoreError }: BudgetsArgs
): BudgetFailure[] | undefined => {
  const missing = Object.keys(budgets).filter((audit) => !lhr.audits[audit])
  if (missing.length) {
    throw new Error(
      `This Lighthouse run has no ${missing.join(', ')} audit to budget. Check the run's \`onlyCategories\`/\`skipAudits\` settings, and that the audit still exists in this Lighthouse major.`
    )
  }

  const failures = Object.entries(budgets)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([audit, budgetKib]) => ({
      audit,
      budgetKib,
      wastedKib: getWastedKib(lhr, audit) ?? 0,
    }))
    .filter(({ wastedKib, budgetKib }) => wastedKib > budgetKib)

  if (!failures.length) {
    return undefined
  }

  if (!ignoreError) {
    throw new Error(
      [
        'Lighthouse budgets exceeded:',
        ...failures.map(
          ({ audit, budgetKib, wastedKib }) =>
            `${audit} wasted ${Math.round(wastedKib)} KiB, above the ${budgetKib} KiB budget`
        ),
      ].join('\n')
    )
  }

  return failures
}

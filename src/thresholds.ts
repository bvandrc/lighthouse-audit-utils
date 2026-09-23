import type { RunnerResult } from 'lighthouse'

type Lhr = RunnerResult['lhr']
type CategoryResult = Lhr['categories'][string]

export type Category =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'agentic-browsing'

/** Per-category minimums, or one number applied to every category. */
export type LighthouseThresholds = number | Partial<Record<Category, number>>

/** A category that scored below the minimum it was given. */
export type ThresholdFailure = {
  /** The category's id as the run reported it — usually a `Category`. */
  category: string
  /** The minimum this category was checked against (0-100). */
  minimum: number
  /** What it actually scored (0-100). */
  score: number
}

const thresholdFailureMessage = (failures: ThresholdFailure[]) =>
  [
    'Lighthouse thresholds not met:',
    ...failures.map(
      ({ category, minimum, score }) =>
        `${category} scored ${score}, below the ${minimum} threshold`
    ),
  ].join('\n')

export type ThresholdsArgs = {
  /**
   * Minimum category scores (0-100), either per category or one number for all
   * of them. If per category, any category omitted must score 100.
   */
  thresholds?: LighthouseThresholds
  /** Return the failures rather than throwing them. */
  ignoreError?: boolean
}

/**
 * Checks every category the run scored, throwing an error describing the ones
 * that fell short. Pass `ignoreError` to get those shortfalls back instead, so
 * the caller can log the recommendations before failing.
 */
export const checkAgainstThresholds = (
  /** The Lighthouse result object */
  lhr: Lhr,
  { thresholds = 100, ignoreError }: ThresholdsArgs
): ThresholdFailure[] | undefined => {
  const isFlat = typeof thresholds === 'number'
  const defaultMinimum = isFlat ? thresholds : 100
  const minimums: Record<string, number | undefined> = isFlat
    ? {}
    : (thresholds ?? {})

  const failures = Object.values(lhr.categories)
    .filter((c): c is CategoryResult & { score: number } => c.score !== null)
    .map(({ id, score }) => ({
      category: id,
      minimum: minimums[id] ?? defaultMinimum,
      score: score * 100,
    }))
    .filter(({ score, minimum }) => score < minimum)

  if (!failures.length) {
    return undefined
  }

  if (!ignoreError) {
    throw new Error(thresholdFailureMessage(failures))
  }

  return failures
}

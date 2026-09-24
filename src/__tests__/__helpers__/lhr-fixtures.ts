import { keyBy, startCase } from 'es-toolkit'
import type { RunnerResult } from 'lighthouse'

type Lhr = RunnerResult['lhr']
type Category = Lhr['categories'][string]
type Audit = Lhr['audits'][string]

/** Builds an audit result, scored and titled from its id unless overridden. */
export const buildAudit = (
  id: string,
  overrides: Partial<Omit<Audit, 'id'>> = {}
): Audit => ({
  id,
  title: `Audit ${id}`,
  description: `What ${id} checks`,
  score: 0,
  scoreDisplayMode: 'numeric',
  ...overrides,
})

/** Builds a category scoring the given audits, which it references in order. */
export const buildCategory = (
  id: string,
  score: number | null,
  auditIds: string[] = []
): Category => ({
  id,
  title: startCase(id),
  score,
  auditRefs: auditIds.map((auditId) => ({ id: auditId, weight: 1 })),
})

/**
 * The details of an audit that lists offenders, in the shape it reaches a
 * consumer: `FormattedIcu` has already resolved every label to a string.
 */
type TableDetails = Extract<NonNullable<Audit['details']>, { type: 'table' }>
type OpportunityDetails = Extract<
  NonNullable<Audit['details']>,
  { type: 'opportunity' }
>

/** A table of the offenders an audit found, as most audits carry. */
export const buildTableDetails = (
  headings: TableDetails['headings'],
  items: TableDetails['items']
): TableDetails => ({ type: 'table', headings, items })

/** An opportunity, the table variant carrying a byte saving of its own. */
export const buildOpportunityDetails = (
  headings: OpportunityDetails['headings'],
  items: OpportunityDetails['items'],
  overallSavingsBytes?: number
): OpportunityDetails => ({
  type: 'opportunity',
  headings,
  items,
  overallSavingsBytes,
})

/**
 * Builds a Lighthouse result carrying only what these utilities read.
 *
 * Audits passed as a list are keyed by their own id, which is how the real
 * `audits` record relates to the `auditRefs` a category holds.
 */
export const buildLighthouseLhr = ({
  categories = [],
  audits = [],
  finalDisplayedUrl = 'https://example.com/',
  output = 'html',
}: {
  categories?: Category[]
  audits?: Audit[]
  finalDisplayedUrl?: string
  /** The formats the run was asked for, which name the written reports. */
  output?: Lhr['configSettings']['output']
} = {}): Lhr => ({
  gatherMode: 'navigation',
  finalDisplayedUrl,
  fetchTime: '2026-01-01T00:00:00.000Z',
  lighthouseVersion: '13.0.0',
  audits: keyBy(audits, (a) => a.id),
  categories: keyBy(categories, (c) => c.id),
  // `output` is the only setting anything here reads, and `ConfigSettings` is
  // `Required<…>` over a field set that moves between Lighthouse majors -- both
  // of which CI runs against. Spelling it out would pin the fixture to one.
  configSettings: { output } as Lhr['configSettings'],
  runWarnings: [],
  userAgent: 'fixture',
  environment: {
    hostUserAgent: 'fixture',
    networkUserAgent: 'fixture',
    benchmarkIndex: 1000,
  },
  timing: { entries: [], total: 0 },
  i18n: { rendererFormattedStrings: {} },
})

/**
 * Builds the `RunnerResult` a finished run hands back.
 *
 * `report` is positional: `writeReports` pairs each entry with the format at
 * the same index of the run's `output`.
 */
export const buildRunnerResult = (
  result: Lhr,
  report: string | string[] = '<html></html>'
): RunnerResult => ({
  lhr: result,
  report,
  artifacts: {} as RunnerResult['artifacts'],
})

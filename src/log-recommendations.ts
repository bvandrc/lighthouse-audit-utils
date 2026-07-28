import type { RunnerResult } from 'lighthouse'
import type Details from 'lighthouse/types/lhr/audit-details'

type Lhr = RunnerResult['lhr']
type Audit = Lhr['audits'][string]
type AuditDetails = NonNullable<Audit['details']>

/** resolves to values that are only non-zero numbers */
const resolveMetricSavings = (audit: Audit) =>
  Object.entries(audit.metricSavings ?? {}).filter(([, ms]) => !!ms) as [
    string,
    number,
  ][]

const maxMetricSavings = (audit: Audit) =>
  Math.max(0, ...resolveMetricSavings(audit).map(([, ms]) => ms))

/** CLS savings are a unitless shift score; every other metric is milliseconds. */
const metricValueType = (metric: string): Details.ItemValueType =>
  metric === 'CLS' ? 'numeric' : 'ms'

/** Columns worth repeating alongside an item's identity (URL, node, ...). */
const MEASURE_TYPES: Details.ItemValueType[] = [
  'bytes',
  'ms',
  'timespanMs',
  'numeric',
]

export type FormattingArgs = {
  /**
   * Rows shown per audit before collapsing to "…and N more"
   * @default 5
   */
  maxItems?: number
  /**
   * Max length of a single value before it's truncated with an "…"
   * @default 120
   */
  maxValueLength?: number
}

const formatValue = (
  value: Details.ItemValue | undefined,
  valueType: Details.ItemValueType,
  maxValueLength: number
): string => {
  if (value === undefined || typeof value === 'boolean') {
    return ''
  }

  if (typeof value === 'number') {
    if (valueType === 'bytes') {
      // Keep a decimal on small values so sub-KiB assets don't read as "0 KiB".
      const kib = value / 1024
      const rounded = kib >= 100 ? Math.round(kib) : Math.round(kib * 10) / 10
      return `${rounded} KiB`
    }
    if (valueType === 'ms' || valueType === 'timespanMs') {
      return `${Math.round(value)} ms`
    }
    return String(Math.round(value * 100) / 100)
  }

  // `IcuMessage` is the only object value without a `type` tag.
  const text = (() => {
    if (typeof value === 'string') {
      return value
    }
    if (!('type' in value)) {
      return ''
    }
    switch (value.type) {
      case 'url':
        return value.value
      case 'link':
        return value.url || value.text
      case 'code':
        return String(value.value)
      case 'node':
        return value.nodeLabel ?? value.selector ?? value.snippet ?? ''
      case 'source-location':
        return `${value.url}:${value.line}:${value.column}`
      default:
        return ''
    }
  })()

  // Node labels and snippets carry the element's own line breaks — flatten them
  // so one item stays on one line.
  const singleLine = text.replace(/\s+/g, ' ').trim()

  return singleLine.length > maxValueLength
    ? `${singleLine.slice(0, maxValueLength)}…`
    : singleLine
}

/**
 * The individual offenders the report UI lists under an audit — the specific
 * render-blocking scripts, oversized images, failing DOM nodes, and so on.
 */
const formatItems = (
  details: AuditDetails | undefined,
  { maxItems, maxValueLength }: Required<FormattingArgs>
): string[] => {
  if (details?.type !== 'opportunity' && details?.type !== 'table') {
    return []
  }

  const [identity, ...measures] = details.headings.filter(({ key }) => !!key)
  if (!identity) {
    return []
  }

  const lines = details.items.slice(0, maxItems).map((item) => {
    const columns = [
      formatValue(item[identity.key ?? ''], identity.valueType, maxValueLength),
      ...measures
        .filter(({ valueType }) => MEASURE_TYPES.includes(valueType))
        .map(
          (heading) =>
            `${heading.label}: ${formatValue(item[heading.key ?? ''], heading.valueType, maxValueLength)}`
        ),
    ]
    return `        - ${columns.filter(Boolean).join('  ·  ')}`
  })

  const remaining = details.items.length - maxItems
  if (remaining > 0) {
    lines.push(`        - …and ${remaining} more`)
  }
  return lines
}

/**
 * Print the same fix list the Lighthouse report UI shows, so a failing run is
 * actionable from the terminal/CI log without opening the HTML report.
 */
export const logRecommendations = (
  /** The Lighthouse result object   */
  lhr: Lhr,
  {
    label,
    maxItems = 5,
    maxValueLength = 120,
  }: {
    /** Distinguishes runs of the same URL in one log (e.g. `desktop`/`mobile`). */
    label?: string
  } & FormattingArgs
) => {
  const lines = [
    '',
    `───── Lighthouse recommendations${label ? `: ${label}` : ''} — ${lhr.finalDisplayedUrl} ─────`,
  ]

  for (const category of Object.values(lhr.categories)) {
    const categoryScoreValue =
      category.score === null ? 'N/A' : Math.round(category.score * 100)
    const categoryLine = `${category.title}: ${categoryScoreValue}`

    const failing = category.auditRefs
      .map(({ id }) => lhr.audits[id])
      .filter((audit) => !!audit && audit.score !== null && audit.score < 1)
      .sort(
        (a, b) =>
          maxMetricSavings(b) - maxMetricSavings(a) ||
          (a.score ?? 0) - (b.score ?? 0)
      )

    if (!failing.length) {
      lines.push('', `${categoryLine} — nothing to fix`)
      continue
    }

    lines.push('', categoryLine)

    for (const audit of failing) {
      const displayValue = audit.displayValue ? ` (${audit.displayValue})` : ''

      const savingsValue: string = (() => {
        // Most opportunities already spell out their savings in `displayValue`.
        if (audit.displayValue?.toLowerCase().includes('savings')) {
          return ''
        }

        const overallSavingsBytes =
          audit.details?.type === 'opportunity'
            ? audit.details.overallSavingsBytes
            : undefined
        const estSavings = [
          ...resolveMetricSavings(audit).map(
            ([metric, value]) =>
              `${metric} ${formatValue(value, metricValueType(metric), maxValueLength)}`
          ),
          formatValue(overallSavingsBytes, 'bytes', maxValueLength),
        ].filter(Boolean)

        return estSavings.length
          ? ` — est. savings: ${estSavings.join(', ')}`
          : ''
      })()

      const scoreValue =
        audit.score === null ? 'N/A' : Math.round(audit.score * 100)

      lines.push(`  • ${audit.title}${displayValue}${savingsValue}`)
      lines.push(`      ${audit.id} · score ${scoreValue}`)
      lines.push(...formatItems(audit.details, { maxItems, maxValueLength }))
    }
  }

  lines.push('')
  console.log(lines.join('\n'))
}

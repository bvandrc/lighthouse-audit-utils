import { noop } from 'es-toolkit'

import { logRecommendations } from '../log-recommendations'
import {
  audit,
  category,
  lhr,
  opportunityDetails,
  tableDetails,
} from './__helpers__/lhr-fixtures'

/** The one string `logRecommendations` printed, as the terminal would show it. */
const logged = () => {
  const [call] = vi.mocked(console.log).mock.calls
  return call?.[0] as string
}

const FAILING_AUDIT = audit('render-blocking-resources', {
  title: 'Eliminate render-blocking resources',
  score: 0.3,
})

describe('logRecommendations', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(noop)
  })

  it('heads the output with the audited URL', () => {
    logRecommendations(
      lhr({ finalDisplayedUrl: 'https://example.com/pricing' }),
      {}
    )

    expect(logged()).toContain(
      '───── Lighthouse recommendations — https://example.com/pricing ─────'
    )
  })

  it('adds the label that tells two runs of one URL apart', () => {
    logRecommendations(lhr(), { label: 'mobile' })

    expect(logged()).toContain('Lighthouse recommendations: mobile —')
  })

  it('says so rather than going quiet when a category has nothing failing', () => {
    logRecommendations(
      lhr({
        categories: [category('seo', 1, ['passing'])],
        audits: [audit('passing', { score: 1 })],
      }),
      {}
    )

    expect(logged()).toContain('Seo: 100 — nothing to flag')
  })

  it("reports a category's score, and N/A where it has none", () => {
    logRecommendations(lhr({ categories: [category('performance', null)] }), {})

    expect(logged()).toContain('Performance: N/A')
  })

  it('lists an audit under its title, id, and score', () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, [FAILING_AUDIT.id])],
        audits: [FAILING_AUDIT],
      }),
      {}
    )

    expect(logged()).toContain('  • Eliminate render-blocking resources')
    expect(logged()).toContain('      render-blocking-resources · score 30')
  })

  it('leaves out the audits that passed, and the ones with no score to fail', () => {
    logRecommendations(
      lhr({
        categories: [
          category('performance', 0.4, ['passed', 'informative', 'failed']),
        ],
        audits: [
          audit('passed', { score: 1, title: 'Passed audit' }),
          // Informative audits carry no score, so there is nothing to be below.
          audit('informative', {
            score: null,
            scoreDisplayMode: 'informative',
            title: 'Informative audit',
          }),
          audit('failed', { score: 0.2, title: 'Failed audit' }),
        ],
      }),
      {}
    )

    expect(logged()).toContain('Failed audit')
    for (const absent of ['Passed audit', 'Informative audit']) {
      expect(logged(), absent).not.toContain(absent)
    }
  })

  it('orders the audits by what they would save, worst first', () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['small', 'large'])],
        audits: [
          audit('small', { score: 0.5, metricSavings: { LCP: 20 } }),
          audit('large', { score: 0.5, metricSavings: { LCP: 900 } }),
        ],
      }),
      {}
    )

    expect(logged().indexOf('Audit large')).toBeLessThan(
      logged().indexOf('Audit small')
    )
  })

  it('states the estimated savings in each metric’s own unit', () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['savings'])],
        audits: [
          audit('savings', {
            score: 0.1,
            // CLS is a unitless layout-shift score; the rest are milliseconds.
            metricSavings: { LCP: 1234.6, CLS: 0.25 },
          }),
        ],
      }),
      {}
    )

    expect(logged()).toContain('est. savings: LCP 1235 ms, CLS 0.25')
  })

  it("falls back to an opportunity's overall byte saving", () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['unused-css'])],
        audits: [
          audit('unused-css', {
            score: 0.1,
            details: opportunityDetails(
              [{ key: 'url', valueType: 'url', label: 'URL' }],
              [{ url: 'https://example.com/a.css', wastedBytes: 51_200 }],
              51_200
            ),
          }),
        ],
      }),
      {}
    )

    expect(logged()).toContain('est. savings: 50 KiB')
  })

  it("does not repeat savings the audit's own display value already gives", () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['dup'])],
        audits: [
          audit('dup', {
            score: 0.1,
            displayValue: 'Potential savings of 40 KiB',
            metricSavings: { LCP: 500 },
          }),
        ],
      }),
      {}
    )

    expect(logged()).toContain('(Potential savings of 40 KiB)')
    expect(logged()).not.toContain('est. savings')
  })

  it("lists an audit's offenders with each measure column labelled", () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['images'])],
        audits: [
          audit('images', {
            score: 0.2,
            details: tableDetails(
              [
                { key: 'url', valueType: 'url', label: 'URL' },
                { key: 'wastedBytes', valueType: 'bytes', label: 'Savings' },
                // A non-measure column is identity-only, so it is not repeated.
                { key: 'note', valueType: 'text', label: 'Note' },
              ],
              [
                {
                  url: 'https://example.com/hero.png',
                  wastedBytes: 204_800,
                  note: 'ignored',
                },
              ]
            ),
          }),
        ],
      }),
      {}
    )

    expect(logged()).toContain(
      '        - https://example.com/hero.png  ·  Savings: 200 KiB'
    )
    expect(logged()).not.toContain('ignored')
  })

  it('keeps a decimal on sub-KiB savings so they do not read as 0 KiB', () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['tiny'])],
        audits: [
          audit('tiny', {
            score: 0.2,
            details: tableDetails(
              [
                { key: 'url', valueType: 'url', label: 'URL' },
                { key: 'wastedBytes', valueType: 'bytes', label: 'Savings' },
              ],
              [{ url: 'https://example.com/a.css', wastedBytes: 300 }]
            ),
          }),
        ],
      }),
      {}
    )

    expect(logged()).toContain('Savings: 0.3 KiB')
  })

  it('collapses the offenders past `maxItems` into a count', () => {
    logRecommendations(
      lhr({
        categories: [category('performance', 0.4, ['many'])],
        audits: [
          audit('many', {
            score: 0.2,
            details: tableDetails(
              [{ key: 'url', valueType: 'url', label: 'URL' }],
              Array.from({ length: 7 }, (_, i) => ({
                url: `https://example.com/${i}.js`,
              }))
            ),
          }),
        ],
      }),
      { maxItems: 2 }
    )

    expect(logged()).toContain('https://example.com/1.js')
    expect(logged()).not.toContain('https://example.com/2.js')
    expect(logged()).toContain('        - …and 5 more')
  })

  it('flattens a node label onto one line and truncates it', () => {
    logRecommendations(
      lhr({
        categories: [category('accessibility', 0.4, ['contrast'])],
        audits: [
          audit('contrast', {
            score: 0,
            details: tableDetails(
              [{ key: 'node', valueType: 'node', label: 'Element' }],
              [
                {
                  node: {
                    type: 'node',
                    nodeLabel: 'Buy\n  now, while\tstocks last',
                  },
                },
              ]
            ),
          }),
        ],
      }),
      { maxValueLength: 12 }
    )

    expect(logged()).toContain('        - Buy now, whi…')
  })
})

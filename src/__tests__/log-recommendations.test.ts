import { noop } from 'es-toolkit'

import { logRecommendations } from '../log-recommendations'
import {
  buildAudit,
  buildCategory,
  buildLighthouseLhr,
  buildOpportunityDetails,
  buildTableDetails,
} from './__helpers__/lhr-fixtures'

/** The last string `logRecommendations` printed, as the terminal would show it. */
const logged = () => {
  const calls = vi.mocked(console.log).mock.calls
  return calls.at(-1)?.[0] as string
}

const FAILING_AUDIT = buildAudit('render-blocking-resources', {
  title: 'Eliminate render-blocking resources',
  score: 0.3,
})

describe('logRecommendations', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(noop)
  })

  it('heads the output with the audited URL, and the label if there is one', () => {
    logRecommendations(
      buildLighthouseLhr({ finalDisplayedUrl: 'https://example.com/pricing' }),
      {}
    )
    expect(logged()).toContain(
      '───── Lighthouse recommendations — https://example.com/pricing ─────'
    )

    // The label is what tells two runs of one URL apart in a single log.
    logRecommendations(buildLighthouseLhr(), { label: 'mobile' })
    expect(logged()).toContain('Lighthouse recommendations: mobile —')
  })

  it('says so rather than going quiet when a category has nothing failing', () => {
    logRecommendations(
      buildLighthouseLhr({
        categories: [buildCategory('seo', 1, ['passing'])],
        audits: [buildAudit('passing', { score: 1 })],
      }),
      {}
    )

    expect(logged()).toContain('Seo: 100 — nothing to flag')
  })

  it("reports a category's score, and N/A where it has none", () => {
    logRecommendations(
      buildLighthouseLhr({ categories: [buildCategory('performance', null)] }),
      {}
    )

    expect(logged()).toContain('Performance: N/A')
  })

  it('lists an audit under its title, id, and score', () => {
    logRecommendations(
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, [FAILING_AUDIT.id])],
        audits: [FAILING_AUDIT],
      }),
      {}
    )

    expect(logged()).toContain('  • Eliminate render-blocking resources')
    expect(logged()).toContain('      render-blocking-resources · score 30')
  })

  it('leaves out the audits that passed, and the ones with no score to fail', () => {
    logRecommendations(
      buildLighthouseLhr({
        categories: [
          buildCategory('performance', 0.4, [
            'passed',
            'informative',
            'failed',
          ]),
        ],
        audits: [
          buildAudit('passed', { score: 1, title: 'Passed audit' }),
          // Informative audits carry no score, so there is nothing to be below.
          buildAudit('informative', {
            score: null,
            scoreDisplayMode: 'informative',
            title: 'Informative audit',
          }),
          buildAudit('failed', { score: 0.2, title: 'Failed audit' }),
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['small', 'large'])],
        audits: [
          buildAudit('small', { score: 0.5, metricSavings: { LCP: 20 } }),
          buildAudit('large', { score: 0.5, metricSavings: { LCP: 900 } }),
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['savings'])],
        audits: [
          buildAudit('savings', {
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['unused-css'])],
        audits: [
          buildAudit('unused-css', {
            score: 0.1,
            details: buildOpportunityDetails(
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['dup'])],
        audits: [
          buildAudit('dup', {
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['images'])],
        audits: [
          buildAudit('images', {
            score: 0.2,
            details: buildTableDetails(
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['tiny'])],
        audits: [
          buildAudit('tiny', {
            score: 0.2,
            details: buildTableDetails(
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
      buildLighthouseLhr({
        categories: [buildCategory('performance', 0.4, ['many'])],
        audits: [
          buildAudit('many', {
            score: 0.2,
            details: buildTableDetails(
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
      buildLighthouseLhr({
        categories: [buildCategory('accessibility', 0.4, ['contrast'])],
        audits: [
          buildAudit('contrast', {
            score: 0,
            details: buildTableDetails(
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

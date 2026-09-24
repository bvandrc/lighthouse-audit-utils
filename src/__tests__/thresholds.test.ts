import { checkAgainstThresholds } from '../thresholds'
import { buildCategory, buildLighthouseLhr } from './__helpers__/lhr-fixtures'

const SCORES = {
  performance: 0.82,
  accessibility: 1,
  seo: 0.9,
}

const REPORT = buildLighthouseLhr({
  categories: Object.entries(SCORES).map(([id, score]) =>
    buildCategory(id, score)
  ),
})

describe('checkAgainstThresholds', () => {
  it('treats a score exactly at the minimum as clearing it', () => {
    expect(checkAgainstThresholds(REPORT, { thresholds: 82 })).toBeUndefined()
  })

  it('reports the score out of 100, not the 0-1 the run carries', () => {
    const failures = checkAgainstThresholds(REPORT, {
      thresholds: 95,
      ignoreError: true,
    })

    expect(failures).toEqual([
      { category: 'performance', minimum: 95, score: 82 },
      { category: 'seo', minimum: 95, score: 90 },
    ])
  })

  it('holds a category omitted from a per-category object to 100', () => {
    const failures = checkAgainstThresholds(REPORT, {
      // `seo` is left out, so its 90 is a shortfall against the implied 100.
      thresholds: { performance: 80 },
      ignoreError: true,
    })

    expect(failures).toEqual([{ category: 'seo', minimum: 100, score: 90 }])
  })

  it('skips a category the run did not score', () => {
    const report = buildLighthouseLhr({
      categories: [
        buildCategory('performance', null),
        buildCategory('seo', 0.5),
      ],
    })

    expect(
      checkAgainstThresholds(report, { thresholds: 40, ignoreError: true })
    ).toBeUndefined()
  })

  it('names every shortfall in the error, not just the first', () => {
    // Both categories, in the order the run reported them.
    expect(() => checkAgainstThresholds(REPORT, { thresholds: 95 })).toThrow(
      /performance[\s\S]*seo/
    )
  })
})

import { noop } from 'es-toolkit'

import { handleAuditResult } from '../handle-audit-result'
import { category, lhr, runnerResult } from './__helpers__/lhr-fixtures'

const FAILING_RESULT = runnerResult(
  lhr({ categories: [category('performance', 0.5)] })
)

describe('handleAuditResult', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(noop)
  })

  it('logs the recommendations before the thresholds throw', async () => {
    await expect(
      handleAuditResult({ result: FAILING_RESULT, thresholds: 90 })
    ).rejects.toThrow('Lighthouse thresholds not met')

    // The point of the ordering: a failing run still says why it failed.
    expect(console.log).toHaveBeenCalledOnce()
  })

  it('stays quiet when recommendations are turned off', async () => {
    await handleAuditResult({
      result: FAILING_RESULT,
      thresholds: 10,
      recommendations: false,
    })

    expect(console.log).not.toHaveBeenCalled()
  })

  it('hands back the shortfalls when told not to throw them', async () => {
    const failures = await handleAuditResult({
      result: FAILING_RESULT,
      thresholds: 90,
      ignoreError: true,
    })

    expect(failures).toEqual([
      { category: 'performance', minimum: 90, score: 50 },
    ])
  })

  it('resolves to nothing when every category clears its minimum', async () => {
    await expect(
      handleAuditResult({ result: FAILING_RESULT, thresholds: 50 })
    ).resolves.toBeUndefined()
  })
})

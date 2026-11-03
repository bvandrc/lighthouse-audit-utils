import { noop } from 'es-toolkit'
import { vol } from 'memfs'

import { handleAuditResult } from '../handle-audit-result'
import {
  buildCategory,
  buildLighthouseLhr,
  buildRunnerResult,
} from './__helpers__/lhr-fixtures'

const FAILING_RESULT = buildRunnerResult(
  buildLighthouseLhr({ categories: [buildCategory('performance', 0.5)] })
)

vi.mock('node:fs/promises', async () => {
  const { fs } = await import('memfs')
  return { ...fs.promises, default: fs.promises }
})

/** The last string `handleAuditResult` printed, as the terminal would show it. */
const getLastLog = (): string => vi.mocked(console.log).mock.calls.at(-1)?.[0]

describe('handleAuditResult', () => {
  beforeEach(() => {
    vol.reset()
    vi.spyOn(console, 'log').mockImplementation(noop)
  })

  it('writes the reports, and labels the log with their name', async () => {
    await handleAuditResult({
      result: FAILING_RESULT,
      thresholds: 10,
      reports: { directory: '/out', name: 'home' },
    })

    expect(Object.keys(vol.toJSON())).toEqual(['/out/home.html'])
    expect(getLastLog()).toContain('Lighthouse recommendations: home —')
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
})

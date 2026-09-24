import { vol } from 'memfs'

import { writeReports } from '../write-reports'
import {
  buildLighthouseLhr,
  buildRunnerResult,
} from './__helpers__/lhr-fixtures'

vi.mock('node:fs/promises', async () => {
  const { fs } = await import('memfs')
  return { ...fs.promises, default: fs.promises }
})

describe('writeReports', () => {
  beforeEach(() => {
    vol.reset()
  })

  it('names each report for the format at its own index', async () => {
    await writeReports(
      buildRunnerResult(buildLighthouseLhr({ output: ['html', 'json'] }), [
        '<html>',
        '{}',
      ]),
      { directory: '/out', name: 'home' }
    )

    expect(vol.toJSON()).toEqual({
      '/out/home.html': '<html>',
      '/out/home.json': '{}',
    })
  })

  it('handles the single-format run, where neither value is a list', async () => {
    await writeReports(
      buildRunnerResult(buildLighthouseLhr({ output: 'json' }), '{"a":1}'),
      {
        directory: '/reports',
        name: 'pricing',
      }
    )

    expect(vol.toJSON()).toEqual({ '/reports/pricing.json': '{"a":1}' })
  })
})

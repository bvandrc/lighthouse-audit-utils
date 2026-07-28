import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { RunnerResult } from 'lighthouse'

export type WriteReportsArgs = { directory: string; name: string }

/**
 * Writes each report to `<directory>/<name>.<format>`, using the formats the
 * run's `output` flag asked for.
 */
export const writeReports = async (
  result: RunnerResult,
  { directory, name }: WriteReportsArgs
) => {
  const formats = [result.lhr.configSettings.output].flat()

  await mkdir(directory, { recursive: true })
  await Promise.all(
    [result.report]
      .flat()
      .map((report, i) =>
        writeFile(path.join(directory, `${name}.${formats[i]}`), report)
      )
  )
}

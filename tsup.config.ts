import { defineConfig } from 'tsup'
import pkg from './package.json' with { type: 'json' }

export default defineConfig((_options) => [
  {
    entry: {
      index: 'src/index.ts',
    },
    target: 'es2023',
    format: ['esm'],
    clean: true,
    dts: false, // emitted by `tsc -p tsconfig.build.json` — tsup's dts step doesn't work on TypeScript 7
    minify: false,
    sourcemap: true,
    splitting: true,
    treeshake: true,
    banner: { js: `\n// ${pkg.name} ${pkg.version}` },
  },
])

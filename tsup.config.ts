import { defineConfig } from 'tsup'
import pkg from './package.json' with { type: 'json' }

export default defineConfig((_options) => [
  {
    entry: {
      index: 'src/index.ts',
      playwright: 'src/playwright.ts',
    },
    target: 'es2023',
    format: ['esm'],
    clean: true,
    // Used for very basic (primitive) utilities, so the utilized functions are
    // bundled directly into our code, to avoid an additional dependency for
    // users of this package. It's a devDependency, which tsup already bundles —
    // this just says so out loud.
    noExternal: ['es-toolkit'],
    dts: false, // emitted by `tsc -p tsconfig.build.json` — tsup's dts step doesn't work on TypeScript 7
    minify: false,
    sourcemap: true,
    splitting: true,
    treeshake: true,
    banner: { js: `\n// ${pkg.name} ${pkg.version}` },
  },
])

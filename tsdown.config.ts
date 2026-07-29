import { defineConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    playwright: 'src/playwright.ts',
  },
  target: 'es2023',
  format: ['esm'],
  clean: true,
  // Used for very basic (primitive) utilities, so the utilized functions are
  // bundled directly into our code, to avoid an additional dependency for
  // users of this package. It's a devDependency, which tsdown already bundles —
  // this just says so out loud.
  deps: { alwaysBundle: ['es-toolkit'] },
  dts: {
    // declaration maps are omitted: rolldown-plugin-dts always strips sourcesContent,
    // so they'd only resolve if src were published
    sourcemap: false,
  },
  // emit .js/.d.ts rather than tsdown's default .mjs/.d.mts — package is type: module
  fixedExtension: false,
  minify: false,
  sourcemap: true,
  treeshake: true,
  banner: { js: `\n// ${pkg.name} ${pkg.version}` },
})

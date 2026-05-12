import { build } from 'esbuild';

await build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'bundle/index.mjs',
  banner: {
    js: [
      '#!/usr/bin/env node',
      '// Banner: polyfill require() for CJS deps bundled into ESM (neo4j-driver-core)',
      'import { createRequire as __cr } from "node:module";',
      'const require = __cr(import.meta.url);',
    ].join('\n'),
  },
  // All deps bundled inline — no external node_modules needed at runtime
  external: [],
  resolveExtensions: ['.js', '.mjs', '.json'],
  minify: false,
  sourcemap: true,
});

console.log('Bundled → bundle/index.mjs');

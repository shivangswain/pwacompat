// Builds dist/: the drop-in script, the ES module and type declarations.
// Output is deterministic, so CI can rebuild and compare.

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const banner = `/*! pwacompat v${pkg.version} | Apache-2.0 | ${pkg.homepage} */`;
// Safari 16.4 is the first release where every iOS browser can add to the Home Screen.
const target = ['es2022', 'safari16.4', 'ios16.4'];

rmSync('dist', { recursive: true, force: true });

const common = {
  bundle: true,
  target,
  legalComments: 'none',
  banner: { js: banner },
  logLevel: 'warning',
};

await build({
  ...common,
  entryPoints: ['src/auto.ts'],
  outfile: 'dist/pwacompat.min.js',
  format: 'iife',
  minify: true,
  sourcemap: 'linked',
  sourcesContent: true,
});

await build({
  ...common,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/pwacompat.mjs',
  format: 'esm',
});

const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { stdio: 'inherit' });

// tsc keeps the source's './x.ts' specifiers in declarations; './x.js' resolves everywhere.
for (const file of readdirSync('dist/types')) {
  const path = `dist/types/${file}`;
  writeFileSync(path, readFileSync(path, 'utf8').replace(/(from\s+'\.{1,2}\/[^']+)\.ts'/g, "$1.js'"));
}
rmSync('dist/types/auto.d.ts');

console.log(`built pwacompat v${pkg.version}`);

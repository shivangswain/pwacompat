// Collects release assets from dist/ into release/: the built files, the npm
// package tarball, SHA-256 checksums, SRI hashes and release notes. GitHub
// and GitLab both publish exactly these files.
//
// Set RELEASE_TAG (GitHub) or CI_COMMIT_TAG (GitLab) to check that the tag
// matches package.json before anything is published.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;
const tag = process.env.RELEASE_TAG || process.env.CI_COMMIT_TAG || '';
if (tag && tag !== `v${version}`) {
  console.error(`Tag ${tag} does not match package.json version ${version}.`);
  process.exit(1);
}

// npm pack's bytes depend on the npm (and so Node) version, so releases use the
// exact version in .nvmrc. CI fails on any other; local builds only warn.
const node = readFileSync('.nvmrc', 'utf8').trim();
if (process.versions.node !== node) {
  const message = `Node ${process.versions.node} is not the pinned ${node} (.nvmrc); the npm tarball will not match a release build.`;
  if (process.env.CI) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`warning: ${message}`);
}
const commit = process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const BUILT = ['pwacompat.min.js', 'pwacompat.min.js.map', 'pwacompat.mjs'];
for (const file of BUILT) {
  if (!existsSync(`dist/${file}`)) {
    console.error(`dist/${file} is missing; run "npm run build" first.`);
    process.exit(1);
  }
}

rmSync('release', { recursive: true, force: true });
mkdirSync('release/assets', { recursive: true });
for (const file of BUILT) {
  copyFileSync(`dist/${file}`, `release/assets/${file}`);
}
// The npm tarball carries the type declarations for anyone installing from a release URL.
// Under `npm run`, call npm's own CLI through Node so no shell is involved.
const packArgs = ['pack', '--pack-destination', 'release/assets', '--ignore-scripts', '--silent'];
const npmCli = process.env.npm_execpath;
execFileSync(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...packArgs] : packArgs, {
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: !npmCli && process.platform === 'win32',
});

const assets = readdirSync('release/assets').sort();
const digest = (file, algorithm, encoding) => createHash(algorithm).update(readFileSync(`release/assets/${file}`)).digest(encoding);
const sums = assets.map((file) => `${digest(file, 'sha256', 'hex')}  ${file}`).join('\n') + '\n';
writeFileSync('release/assets/SHA256SUMS', sums);

const sri = Object.fromEntries(
  assets.filter((file) => /\.m?js$/.test(file)).map((file) => [file, `sha384-${digest(file, 'sha384', 'base64')}`]),
);
writeFileSync('release/assets/sri.json', JSON.stringify(sri, null, 2) + '\n');

// Release notes: this version's CHANGELOG section plus install snippet and checksums.
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const section = changelog.match(new RegExp(`^## \\[?${version.replaceAll('.', '\\.')}\\]?[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
if (!section) {
  console.error(`CHANGELOG.md has no "## ${version}" section.`);
  process.exit(1);
}

const notes = `${section[1].trim()}

### Install

Download \`pwacompat.min.js\` from this release and serve it from your own origin. Pin it with Subresource Integrity:

\`\`\`html
<link rel="manifest" href="/manifest.webmanifest">
<script async src="/js/pwacompat.min.js"
        integrity="${sri['pwacompat.min.js']}"
        crossorigin="anonymous"></script>
\`\`\`

Bundler users can install the tarball: \`npm install ./pwacompat-${version}.tgz\`, then \`import { pwacompat } from 'pwacompat'\`.

### Checksums (SHA-256)

\`\`\`
${sums.trim()}
\`\`\`

Verify a download with \`sha256sum -c SHA256SUMS\`.

### Reproduce

Built from commit \`${commit}\` with Node ${node}. With that Node version:

\`\`\`sh
git checkout v${version}
npm ci --ignore-scripts && npm run build && npm run release:assets
sha256sum -c release/assets/SHA256SUMS
\`\`\`
`;
writeFileSync('release/notes.md', notes);
writeFileSync('release/release.env', `VERSION=${version}\n`);

console.log(`release/ ready for v${version}:\n  ${assets.concat('SHA256SUMS', 'sri.json').join('\n  ')}`);

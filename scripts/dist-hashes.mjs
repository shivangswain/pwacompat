// Lists the SHA-256 of every file in dist/, or checks dist/ against a list.
//   node scripts/dist-hashes.mjs > dist.sha256
//   node scripts/dist-hashes.mjs --check dist.sha256

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const files = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `${entry.parentPath.replaceAll('\\', '/')}/${entry.name}`)
  .sort();
const listing = files
  .map((file) => `${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${file}`)
  .join('\n') + '\n';

const check = process.argv.indexOf('--check');
if (check === -1) {
  process.stdout.write(listing);
} else {
  const expected = readFileSync(process.argv[check + 1], 'utf8').replaceAll('\r\n', '\n');
  if (expected !== listing) {
    const want = new Set(expected.trim().split('\n'));
    const got = new Set(listing.trim().split('\n'));
    for (const line of want) if (!got.has(line)) console.error(`expected ${line}`);
    for (const line of got) if (!want.has(line)) console.error(`got      ${line}`);
    console.error('dist/ is not byte-identical to the reference build.');
    process.exit(1);
  }
  console.log(`dist/ matches: ${files.length} files byte-identical.`);
}

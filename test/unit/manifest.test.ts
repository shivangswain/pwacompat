import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appStoreIdFrom, bestIcon, iconsFor, largestIconSize, normalizeManifest } from '../../src/manifest.ts';

const BASE = 'https://example.test/assets/manifest.webmanifest';

describe('largestIconSize', () => {
  it('parses single, multiple, any and missing sizes', () => {
    assert.equal(largestIconSize('192x192'), 192);
    assert.equal(largestIconSize('16x16 32x32  48X48'), 48);
    assert.equal(largestIconSize('any'), Infinity);
    assert.equal(largestIconSize(''), 0);
    assert.equal(largestIconSize('bogus'), 0);
  });
});

describe('normalizeManifest', () => {
  it('survives an icon without sizes (v2 discarded the whole manifest)', () => {
    const m = normalizeManifest({ theme_color: 'red', icons: [{ src: 'a.png' }] }, BASE);
    assert.equal(m.themeColor, 'red');
    assert.equal(m.icons.length, 1);
    assert.equal(m.icons[0]?.largest, 0);
    assert.equal(m.icons[0]?.sizes, '');
  });

  it('resolves icon URLs against the manifest, not the page', () => {
    const m = normalizeManifest({ icons: [{ src: 'icon-64.png', sizes: '64x64' }] }, BASE);
    assert.equal(m.icons[0]?.src, 'https://example.test/assets/icon-64.png');
  });

  it('drops icons with unsafe or missing src', () => {
    const m = normalizeManifest({
      icons: [{ src: 'javascript:alert(1)' }, { sizes: '48x48' }, null, 7, { src: 'ok.png' }],
    }, BASE);
    assert.deepEqual(m.icons.map((i) => i.src), ['https://example.test/assets/ok.png']);
  });

  it('reads purposes, defaults to any, and drops icons with only unknown purposes', () => {
    const m = normalizeManifest({
      icons: [
        { src: 'a.png' },
        { src: 'b.png', purpose: 'MASKABLE any' },
        { src: 'c.png', purpose: 'monochrome' },
        { src: 'd.png', purpose: 'unknown' },
      ],
    }, BASE);
    assert.deepEqual(m.icons.map((i) => i.purposes), [['any'], ['maskable', 'any'], ['monochrome']]);
  });

  it('tolerates non-array icons and non-object input', () => {
    assert.deepEqual(normalizeManifest({ icons: 'nope' }, BASE).icons, []);
    assert.deepEqual(normalizeManifest(null, BASE).icons, []);
    assert.equal(normalizeManifest('string', BASE).name, undefined);
  });

  it('normalises display and ignores unknown values', () => {
    assert.equal(normalizeManifest({ display: 'Standalone' }, BASE).display, 'standalone');
    assert.equal(normalizeManifest({ display: 'window-controls-overlay' }, BASE).display, undefined);
  });

  it('only exposes an App Store id when prefer_related_applications is true', () => {
    const related = [{ platform: 'itunes', id: '1234567890' }];
    assert.equal(normalizeManifest({ related_applications: related }, BASE).appStoreId, undefined);
    assert.equal(normalizeManifest({ related_applications: related, prefer_related_applications: true }, BASE).appStoreId, '1234567890');
  });

  it('caps the number of icons processed', () => {
    const icons = Array.from({ length: 500 }, (_, i) => ({ src: `${i}.png` }));
    assert.equal(normalizeManifest({ icons }, BASE).icons.length, 64);
  });
});

describe('appStoreIdFrom', () => {
  it('reads the /id<digits> path segment, not the first "id" anywhere', () => {
    assert.equal(appStoreIdFrom({ platform: 'itunes', url: 'https://apps.apple.com/us/app/paid4you/id1234567890' }), '1234567890');
    assert.equal(appStoreIdFrom({ platform: 'itunes', url: 'https://apps.apple.com/app/id42?mt=8' }), '42');
  });

  it('rejects ids that would inject Smart App Banner parameters', () => {
    assert.equal(appStoreIdFrom({ platform: 'itunes', id: '1, app-argument=https://evil.test' }), undefined);
  });

  it('accepts numeric ids and ignores other platforms or missing data', () => {
    assert.equal(appStoreIdFrom({ platform: 'itunes', id: 987 }), '987');
    assert.equal(appStoreIdFrom({ platform: 'play', id: '123' }), undefined);
    assert.equal(appStoreIdFrom({ platform: 'itunes' }), undefined);
    assert.equal(appStoreIdFrom({ platform: 'itunes', url: 'not a url' }), undefined);
  });
});

describe('icon selection', () => {
  const m = normalizeManifest({
    icons: [
      { src: 'any-192.png', sizes: '192x192' },
      { src: 'any-512.png', sizes: '512x512' },
      { src: 'mask-512.png', sizes: '512x512', purpose: 'maskable' },
      { src: 'mono-96.png', sizes: '96x96', purpose: 'monochrome' },
    ],
  }, BASE);

  it('filters by purpose, largest first', () => {
    assert.deepEqual(iconsFor(m, 'any').map((i) => i.largest), [512, 192]);
    assert.equal(iconsFor(m, 'maskable').length, 1);
  });

  it('picks the smallest icon that is big enough, else the largest', () => {
    assert.equal(bestIcon(iconsFor(m, 'any'), 180)?.largest, 192);
    assert.equal(bestIcon(iconsFor(m, 'any'), 300)?.largest, 512);
    assert.equal(bestIcon(iconsFor(m, 'any'), 1024)?.largest, 512);
    assert.equal(bestIcon([], 180), undefined);
  });
});

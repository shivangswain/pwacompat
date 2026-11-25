import { expect, test } from '@playwright/test';
import { byRel, DEVICES, inspectImage, meta, open, png, serve } from './harness.ts';

const NAVY: [number, number, number, number] = [44, 62, 80, 255];

const APP = {
  name: 'Test App',
  short_name: 'Test',
  display: 'standalone',
  theme_color: '#2c3e50',
  background_color: '#2c3e50',
  icons: [
    { src: 'any-192.png', sizes: '192x192' },
    { src: 'any-512.png', sizes: '512x512' },
  ],
};

// Tags iOS reads from the manifest, or that only other browsers use.
const OMITTED_META = [
  'apple-mobile-web-app-capable',
  'apple-mobile-web-app-title',
  'mobile-web-app-capable',
  'x5-orientation',
  'x5-page-mode',
  'x5-fullscreen',
  'screen-orientation',
  'browsermode',
  'full-screen',
  'msapplication-TileImage',
  'msapplication-starturl',
  'application-name',
];

for (const build of ['iife', 'esm'] as const) {
  test.describe(`${build} build`, () => {
    test('does nothing outside Apple platforms', async ({ page }) => {
      const served = await serve(page, DEVICES.androidChrome, [{ manifest: APP, build }]);
      const out = await open(page, '/index.html', { expectRun: false });
      expect(served.manifestRequests).toEqual([]);
      expect(out.tags).toEqual([]);
    });

    test('does nothing inside an installed iOS app', async ({ page }) => {
      const served = await serve(page, { ...DEVICES.iPhone17Pro, standalone: true }, [{ manifest: APP, build }]);
      const out = await open(page, '/index.html', { expectRun: false });
      expect(served.manifestRequests).toEqual([]);
      expect(out.tags).toEqual([]);
    });

    test('iPhone 17 Pro: one portrait launch image at device resolution', async ({ page }) => {
      await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP, build }]);
      const out = await open(page);
      expect(out.result?.device).toContain('17 Pro');

      const splash = byRel(out.tags, 'apple-touch-startup-image');
      expect(splash).toHaveLength(1);
      expect(splash[0]?.['media']).toBe(
        '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      );
      const image = await inspectImage(page, splash[0]?.['href'] ?? '', [[0, 0]]);
      expect([image.width, image.height]).toEqual([1206, 2622]);
      expect(image.pixels[0]).toEqual(NAVY);

      expect(meta(out.tags, 'theme-color')).toBe('#2c3e50');
      expect(meta(out.tags, 'apple-mobile-web-app-status-bar-style')).toBe('black');
      expect(byRel(out.tags, 'icon').map((t) => t['sizes'])).toEqual(['512x512', '192x192']);
    });

    test('adds no capable, title or non-Apple meta tags', async ({ page }) => {
      await serve(page, DEVICES.iPhone17Pro, [{ manifest: { ...APP, display: 'minimal-ui' }, build }]);
      const out = await open(page);
      for (const name of OMITTED_META) {
        expect(out.metaNames).not.toContain(name);
      }
    });
  });
}

test.describe('launch images', () => {
  test('iPad Pro 13-inch gets portrait and landscape', async ({ page }) => {
    await serve(page, DEVICES.iPadPro13, [{ manifest: APP }]);
    const out = await open(page);
    expect(out.result?.platform).toBe('ipad');
    const splash = byRel(out.tags, 'apple-touch-startup-image');
    expect(splash.map((t) => t['media']?.match(/orientation: (\w+)/)?.[1])).toEqual(['portrait', 'landscape']);
    const landscape = await inspectImage(page, splash[1]?.['href'] ?? '');
    expect([landscape.width, landscape.height]).toEqual([2752, 2064]);
  });

  test('a landscape-locked app only gets a landscape image', async ({ page }) => {
    await serve(page, DEVICES.iPadPro13, [{ manifest: { ...APP, orientation: 'landscape' } }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-startup-image').map((t) => t['media']?.endsWith('(orientation: landscape)'))).toEqual([true]);
  });

  test('unsupported devices get none, but still get the other tags', async ({ page }) => {
    await serve(page, DEVICES.iPhoneSE, [{ manifest: APP }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-startup-image')).toEqual([]);
    expect(out.result?.skipped['splash']).toMatch(/supported device/);
    expect(meta(out.tags, 'theme-color')).toBe('#2c3e50');
  });

  test('display: browser gets none', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: { ...APP, display: 'browser' } }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-startup-image')).toEqual([]);
  });

  test("the page's own launch images are left alone", async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP, head: '<link rel="apple-touch-startup-image" href="/mine.png">' }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-startup-image')).toEqual([]);
    expect(out.result?.skipped['splash']).toMatch(/already has launch images/);
  });

  test('can be switched off or restyled from the manifest link', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [
      { path: '/off.html', manifest: APP, linkAttrs: 'data-pwacompat-splash="false"' },
      { path: '/red.html', manifest: APP, manifestPath: '/red.json', linkAttrs: 'data-pwacompat-splash-background="#ff0000" data-pwacompat-cache="false"' },
    ]);
    const off = await open(page, '/off.html');
    expect(byRel(off.tags, 'apple-touch-startup-image')).toEqual([]);
    expect(off.result?.skipped['splash']).toBe('disabled');

    const red = await open(page, '/red.html');
    const href = byRel(red.tags, 'apple-touch-startup-image')[0]?.['href'] ?? '';
    expect((await inspectImage(page, href)).pixels[0]).toEqual([255, 0, 0, 255]);
  });

  test('ES module options override link attributes', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{
      manifest: APP, build: 'esm', options: { splash: true, themeColor: false }, linkAttrs: 'data-pwacompat-splash="false"',
    }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-startup-image')).toHaveLength(1);
    expect(meta(out.tags, 'theme-color')).toBeUndefined();
  });
});

test.describe('macOS Safari', () => {
  test('only gets theme colour and favicons; Safari reads the rest from the manifest', async ({ page }) => {
    await serve(page, DEVICES.macSafari, [{ manifest: { ...APP, icons: [...APP.icons, { src: 'mask.png', sizes: '512x512', purpose: 'maskable' }] } }]);
    const out = await open(page);
    expect(out.result?.platform).toBe('mac');
    expect(out.tags.map((t) => t['rel'] ?? t['name'])).toEqual(['icon', 'icon', 'theme-color']);
  });
});

test.describe('icons', () => {
  const PURPOSES = {
    ...APP,
    icons: [
      { src: 'any-192.png', sizes: '192x192' },
      { src: 'mask-512.png', sizes: '512x512', purpose: 'maskable' },
      { src: 'mono-96.png', sizes: '96x96', purpose: 'monochrome' },
    ],
  };

  test('favicons come from "any" icons and the touch icon from "maskable"', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: PURPOSES }], { 'mask-512.png': png(512, [255, 200, 0, 255]) });
    const out = await open(page);
    expect(byRel(out.tags, 'icon').map((t) => t['href'])).toEqual(['https://app.test/any-192.png']);
    const touch = byRel(out.tags, 'apple-touch-icon');
    expect(touch).toHaveLength(1);
    const image = await inspectImage(page, touch[0]?.['href'] ?? '', [[90, 90]]);
    expect([image.width, image.height]).toEqual([180, 180]);
    expect(image.pixels[0]).toEqual([255, 200, 0, 255]);
  });

  test('without a maskable icon, no touch icon by default (iOS reads manifest icons itself)', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-icon')).toEqual([]);
    expect(out.result?.skipped['touchIcon']).toMatch(/no maskable icon/);
  });

  test('touch-icon="any" fills transparent pixels with background_color', async ({ page }) => {
    await serve(
      page,
      DEVICES.iPhone17Pro,
      [{ manifest: { ...APP, background_color: '#ff0000' }, linkAttrs: 'data-pwacompat-touch-icon="any"' }],
      { 'any-192.png': png(192, [0, 0, 255, 255], 40), 'any-512.png': png(512, [0, 0, 255, 255], 100) },
    );
    const out = await open(page);
    const href = byRel(out.tags, 'apple-touch-icon')[0]?.['href'] ?? '';
    const image = await inspectImage(page, href, [[0, 0], [90, 90]]);
    expect(image.pixels).toEqual([[255, 0, 0, 255], [0, 0, 255, 255]]);
  });

  test("the page's own apple-touch-icon and favicon are left alone", async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{
      manifest: PURPOSES,
      head: '<link rel="apple-touch-icon" href="/mine.png"><link rel="icon" href="/favicon.ico">',
    }]);
    const out = await open(page);
    expect(byRel(out.tags, 'apple-touch-icon')).toEqual([]);
    expect(byRel(out.tags, 'icon')).toEqual([]);
  });

  test('an icon without sizes is still used', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: { theme_color: 'red', display: 'standalone', icons: [{ src: 'a.png' }] } }]);
    const out = await open(page);
    expect(meta(out.tags, 'theme-color')).toBe('red');
    expect(byRel(out.tags, 'icon')).toHaveLength(1);
    expect(out.warnings).toEqual([]);
  });

  test('manifest strings never become CSS selectors', async ({ page }) => {
    const sizes = '1"],link[rel="manifest';
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: { icons: [{ src: 'evil.png', sizes }, { src: 'ok.png', sizes: '64x64' }] } }]);
    const out = await open(page);
    // Both added: the crafted value is only ever an attribute value.
    expect(byRel(out.tags, 'icon').map((t) => t['sizes'])).toEqual(['64x64', sizes]);
  });
});

test.describe('status bar and Smart App Banner', () => {
  test('light themes get dark status bar text', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: { ...APP, theme_color: '#b0b0b0' } }]);
    const out = await open(page);
    expect(meta(out.tags, 'apple-mobile-web-app-status-bar-style')).toBe('default');
  });

  test('viewport-fit=cover gets black-translucent', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP, head: '<meta name="viewport" content="width=device-width, viewport-fit=cover">' }]);
    const out = await open(page);
    expect(meta(out.tags, 'apple-mobile-web-app-status-bar-style')).toBe('black-translucent');
  });

  test('Smart App Banner needs prefer_related_applications and a numeric id', async ({ page }) => {
    const related = [{ platform: 'itunes', url: 'https://apps.apple.com/us/app/paid4you/id1234567890' }];
    await serve(page, DEVICES.iPhone17Pro, [
      { path: '/yes.html', manifestPath: '/yes.json', manifest: { ...APP, related_applications: related, prefer_related_applications: true } },
      { path: '/no.html', manifestPath: '/no.json', manifest: { ...APP, related_applications: related } },
      { path: '/bad.html', manifestPath: '/bad.json', manifest: { ...APP, prefer_related_applications: true, related_applications: [{ platform: 'itunes' }, { platform: 'itunes', id: '1, app-argument=https://evil.test' }] } },
    ]);
    expect(meta((await open(page, '/yes.html')).tags, 'apple-itunes-app')).toBe('app-id=1234567890');
    expect(meta((await open(page, '/no.html')).tags, 'apple-itunes-app')).toBeUndefined();
    const bad = await open(page, '/bad.html');
    expect(meta(bad.tags, 'apple-itunes-app')).toBeUndefined();
    expect(byRel(bad.tags, 'apple-touch-startup-image')).toHaveLength(1); // the rest still ran
  });
});

test.describe('failure handling', () => {
  test('a page without a manifest gets a warning, not an exception', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: null }]);
    const out = await open(page, '/index.html', { expectRun: false });
    expect(errors).toEqual([]);
    expect(out.warnings.join()).toMatch(/no <link rel="manifest"/);
  });

  test('an HTTP error is reported and nothing is added', async ({ page }) => {
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP, manifestStatus: 404 }]);
    const out = await open(page, '/index.html', { expectRun: false });
    expect(out.tags).toEqual([]);
    expect(out.warnings.join()).toMatch(/HTTP 404/);
  });

  test('a full sessionStorage neither blocks the manifest nor throws', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const fill = `<script>
      for (let size = 1 << 20; size >= 1; size >>= 1) {
        for (let i = 0; ; i++) { try { sessionStorage.setItem('f' + size + '_' + i, 'x'.repeat(size)); } catch { break; } }
      }</script>`;
    await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP, head: fill }]);
    const out = await open(page);
    expect(errors).toEqual([]);
    expect(meta(out.tags, 'theme-color')).toBe('#2c3e50');
    expect(byRel(out.tags, 'apple-touch-startup-image')).toHaveLength(1);
  });
});

test.describe('session cache', () => {
  test('two apps on one origin keep their own manifests', async ({ page }) => {
    const served = await serve(page, DEVICES.iPhone17Pro, [
      { path: '/a/index.html', manifest: { ...APP, theme_color: '#ff0000' } },
      { path: '/b/index.html', manifest: { ...APP, theme_color: '#0000ff', display: 'browser' } },
    ]);
    expect(meta((await open(page, '/a/index.html')).tags, 'theme-color')).toBe('#ff0000');
    const b = await open(page, '/b/index.html');
    expect(meta(b.tags, 'theme-color')).toBe('#0000ff');
    expect(byRel(b.tags, 'apple-touch-startup-image')).toEqual([]);
    expect(served.manifestRequests).toEqual(['/a/manifest.json', '/b/manifest.json']);
  });

  test('a second page view reuses the manifest and launch image', async ({ page }) => {
    const served = await serve(page, DEVICES.iPhone17Pro, [{ manifest: APP }]);
    const first = await open(page);
    const second = await open(page);
    expect(served.manifestRequests).toHaveLength(1);
    expect(byRel(second.tags, 'apple-touch-startup-image')[0]?.['href'])
      .toBe(byRel(first.tags, 'apple-touch-startup-image')[0]?.['href']);
  });
});

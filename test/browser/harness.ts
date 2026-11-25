import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

export const ORIGIN = 'https://app.test';

/** What the page reports about the environment. */
export interface Profile {
  userAgent: string;
  vendor: string;
  maxTouchPoints: number;
  width: number;
  height: number;
  scale: number;
  standalone?: boolean;
}

const APPLE = 'Apple Computer, Inc.';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15';

export const DEVICES = {
  iPhone17Pro: { userAgent: IOS_UA, vendor: APPLE, maxTouchPoints: 5, width: 402, height: 874, scale: 3 },
  iPhoneSE: { userAgent: IOS_UA, vendor: APPLE, maxTouchPoints: 5, width: 375, height: 667, scale: 2 },
  // iPadOS asks for the desktop site and reports a Mac user agent.
  iPadPro13: { userAgent: MAC_UA, vendor: APPLE, maxTouchPoints: 5, width: 1032, height: 1376, scale: 2 },
  macSafari: { userAgent: MAC_UA, vendor: APPLE, maxTouchPoints: 0, width: 1512, height: 982, scale: 2 },
  androidChrome: {
    userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
    vendor: 'Google Inc.', maxTouchPoints: 5, width: 412, height: 915, scale: 2.625,
  },
} satisfies Record<string, Profile>;

/** Encodes a square RGBA PNG; pixels within `inset` of the edge are transparent. */
export function png(size: number, rgba: [number, number, number, number], inset = 0): Buffer {
  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = x >= inset && y >= inset && x < size - inset && y < size - inset;
      if (inside) {
        raw.set(rgba, y * row + 1 + x * 4);
      }
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export interface App {
  /** Page path, e.g. '/index.html'. */
  path?: string;
  /** Manifest JSON; `null` for a page without a manifest link. */
  manifest?: object | null;
  manifestPath?: string;
  manifestStatus?: number;
  /** Extra attributes on the manifest link. */
  linkAttrs?: string;
  /** Extra markup in <head>, before the library. */
  head?: string;
  build?: 'iife' | 'esm';
  /** Options for the ES module build's `pwacompat()` call. */
  options?: object;
}

const BOOTSTRAP = `
window.__warnings = [];
const warn = console.warn;
console.warn = (...args) => { window.__warnings.push(args.map(String).join(' ')); warn.apply(console, args); };
document.addEventListener('pwacompat', (e) => {
  const d = e.detail;
  window.__result = { platform: d.platform, device: d.device && d.device.models, skipped: d.skipped, added: d.added.length };
}, true);`;

function html(app: App): string {
  const manifestPath = app.manifestPath ?? new URL('manifest.json', ORIGIN + (app.path ?? '/index.html')).pathname;
  const link = app.manifest === null ? '' : `<link rel="manifest" href="${manifestPath}" ${app.linkAttrs ?? ''}>`;
  const lib = app.build === 'esm'
    ? `<script type="module">import { pwacompat } from '/pwacompat.mjs'; pwacompat(${JSON.stringify(app.options ?? {})});</script>`
    : '<script src="/pwacompat.min.js"></script>';
  return `<!doctype html><html><head><title>Test App</title><script>${BOOTSTRAP}</script>${link}${app.head ?? ''}${lib}</head><body></body></html>`;
}

const DIST = new URL('../../dist/', import.meta.url);

export interface Served {
  /** Manifest requests made by page script (pwacompat), not by the browser. */
  manifestRequests: string[];
}

/** Serves apps, the built library and icons on https://app.test, emulating `profile`. */
export async function serve(page: Page, profile: Profile, apps: App[], icons: Record<string, Buffer> = {}): Promise<Served> {
  const served: Served = { manifestRequests: [] };
  await page.addInitScript((p: Profile) => {
    const def = (obj: object, key: string, value: unknown) => Object.defineProperty(obj, key, { get: () => value, configurable: true });
    def(Navigator.prototype, 'userAgent', p.userAgent);
    def(Navigator.prototype, 'vendor', p.vendor);
    def(Navigator.prototype, 'maxTouchPoints', p.maxTouchPoints);
    if (p.standalone !== undefined) {
      def(Navigator.prototype, 'standalone', p.standalone);
    }
    def(Screen.prototype, 'width', p.width);
    def(Screen.prototype, 'height', p.height);
    def(window, 'devicePixelRatio', p.scale);
  }, profile);

  const pages = new Map<string, App>();
  const manifests = new Map<string, App>();
  for (const app of apps) {
    const path = app.path ?? '/index.html';
    pages.set(path, app);
    if (app.manifest !== null) {
      manifests.set(app.manifestPath ?? new URL('manifest.json', ORIGIN + path).pathname, app);
    }
  }

  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const app = pages.get(pathname);
    if (app) {
      return route.fulfill({ contentType: 'text/html', body: html(app) });
    }
    const owner = manifests.get(pathname);
    if (owner) {
      // WebKit fetches the manifest itself on load; count only the library's fetch().
      if (route.request().resourceType() === 'fetch') {
        served.manifestRequests.push(pathname);
      }
      return route.fulfill({
        status: owner.manifestStatus ?? 200,
        contentType: 'application/manifest+json',
        body: JSON.stringify(owner.manifest ?? {}),
      });
    }
    if (pathname === '/pwacompat.min.js' || pathname === '/pwacompat.mjs') {
      return route.fulfill({ contentType: 'text/javascript', body: readFileSync(new URL(pathname.slice(1), DIST)) });
    }
    const name = pathname.split('/').pop() ?? '';
    if (name.endsWith('.png')) {
      return route.fulfill({ contentType: 'image/png', body: icons[name] ?? png(192, [0, 128, 255, 255]) });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
  return served;
}

export interface Outcome {
  result: { platform: string; device: string | null; skipped: Record<string, string>; added: number } | null;
  /** Elements pwacompat added, as attribute maps with a `tag` key. */
  tags: Array<Record<string, string>>;
  /** Every <meta name> in <head>. */
  metaNames: string[];
  warnings: string[];
}

/** Opens a page and waits for pwacompat to finish (or to stay quiet for `quietMs`). */
export async function open(page: Page, path = '/index.html', { expectRun = true, quietMs = 750 } = {}): Promise<Outcome> {
  await page.goto(ORIGIN + path);
  if (expectRun) {
    await page.waitForFunction(() => '__result' in window, null, { timeout: 20_000 });
  } else {
    await page.waitForTimeout(quietMs);
  }
  return page.evaluate(() => {
    const w = window as unknown as { __result?: Outcome['result']; __warnings: string[] };
    return {
      result: w.__result ?? null,
      tags: [...document.head.querySelectorAll('[data-pwacompat]')].map((el) => ({
        tag: el.localName,
        ...Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])),
      })),
      metaNames: [...document.head.querySelectorAll('meta[name]')].map((m) => m.getAttribute('name') ?? ''),
      warnings: w.__warnings,
    };
  });
}

export const byRel = (tags: Outcome['tags'], rel: string) => tags.filter((t) => t['rel'] === rel);
export const meta = (tags: Outcome['tags'], name: string) => tags.find((t) => t.tag === 'meta' && t['name'] === name)?.['content'];

/** Decodes an image URL in the page: natural size plus RGBA at the given points. */
export async function inspectImage(page: Page, href: string, points: Array<[number, number]> = [[0, 0]]) {
  return page.evaluate(async ({ href, points }) => {
    const img = new Image();
    img.src = href;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      pixels: points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]),
    };
  }, { href, points });
}

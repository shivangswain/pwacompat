/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain: rewritten in TypeScript for v3.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, hasTransparency, loadImage, releaseCanvas } from './canvas.ts';
import { parseColor, prefersLightText, type RGB } from './color.ts';
import { findDevice, splashOrientations, startupImageMedia } from './devices.ts';
import { addLink, addMeta, findManifestLink, linksWithRel, metaContent, viewportFitCover } from './dom.ts';
import { bestIcon, iconsFor, normalizeManifest, type Manifest } from './manifest.ts';
import { resolveOptions } from './options.ts';
import { detectPlatform, isStandalone } from './platform.ts';
import { DEFAULT_SPLASH_FONT, drawSplash, type SplashStyle } from './splash.ts';
import { createStore, hash, isPngDataUrl, type Store } from './storage.ts';
import type { ApplePlatform, Orientation, PwaCompatOptions, PwaCompatResult, ResolvedOptions } from './types.ts';

export type {
  AppleDevice,
  ApplePlatform,
  Orientation,
  PwaCompatOptions,
  PwaCompatResult,
  TouchIconMode,
} from './types.ts';
export { APPLE_DEVICES, findDevice, startupImageMedia } from './devices.ts';

/** iOS's largest Home Screen icon size (iPhone @3x). */
const TOUCH_ICON_SIZE = 180;
const WHITE = '#ffffff';

interface Context {
  readonly link: HTMLLinkElement;
  readonly manifest: Manifest;
  /** Hash of the raw manifest text, so cached images follow manifest changes. */
  readonly manifestHash: string;
  readonly opts: ResolvedOptions;
  readonly store: Store;
  readonly platform: ApplePlatform;
  readonly result: PwaCompatResult;
}

function warn(...args: unknown[]): void {
  console.warn('[pwacompat]', ...args);
}

/** Resolves on the next idle period, so large canvas work doesn't block input. */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 2000 });
    } else {
      setTimeout(resolve, 50);
    }
  });
}

async function loadManifest(link: HTMLLinkElement, store: Store): Promise<{ manifest: Manifest; text: string } | null> {
  const url = link.href;
  const key = `manifest:${url}`;
  let text = store.get(key);
  const cached = text !== null;
  if (text === null) {
    try {
      const response = await fetch(url, {
        credentials: link.crossOrigin === 'use-credentials' ? 'include' : 'same-origin',
      });
      if (!response.ok) {
        warn(`manifest request failed: HTTP ${response.status}`, url);
        return null;
      }
      text = await response.text();
    } catch (err) {
      warn('could not fetch the manifest', url, err);
      return null;
    }
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    warn('manifest is not valid JSON', url, err);
    return null;
  }
  // Cache only after the manifest parsed, so a bad response isn't kept.
  if (!cached) {
    store.set(key, text);
  }
  return { manifest: normalizeManifest(json, url), text };
}

function addFavicons({ manifest, opts, result }: Context): void {
  if (!opts.favicons) {
    result.skipped['favicons'] = 'disabled';
    return;
  }
  if (linksWithRel('icon').length > 0) {
    result.skipped['favicons'] = 'page already has a favicon';
    return;
  }
  const seen = new Set<string>();
  for (const icon of iconsFor(manifest, 'any')) {
    if (seen.has(icon.sizes)) {
      continue;
    }
    seen.add(icon.sizes);
    const attrs: Record<string, string> = { rel: 'icon', href: icon.src };
    if (icon.sizes) {
      attrs['sizes'] = icon.sizes;
    }
    if (icon.type) {
      attrs['type'] = icon.type;
    }
    result.added.push(addLink(attrs));
  }
}

function addThemeColor({ manifest, opts, result }: Context): void {
  if (!opts.themeColor || !manifest.themeColor) {
    result.skipped['themeColor'] = opts.themeColor ? 'no theme_color' : 'disabled';
    return;
  }
  const meta = addMeta('theme-color', manifest.themeColor);
  if (meta) {
    result.added.push(meta);
  } else {
    result.skipped['themeColor'] = 'page already has theme-color';
  }
}

function addStatusBar({ manifest, opts, result }: Context): void {
  if (!opts.statusBar) {
    result.skipped['statusBar'] = 'disabled';
    return;
  }
  const theme = manifest.themeColor ?? metaContent('theme-color');
  const rgb = theme ? parseColor(theme) : null;
  const content = viewportFitCover() ? 'black-translucent' : rgb && prefersLightText(rgb) ? 'black' : 'default';
  const meta = addMeta('apple-mobile-web-app-status-bar-style', content);
  if (meta) {
    result.added.push(meta);
  } else {
    result.skipped['statusBar'] = 'page already sets the status bar style';
  }
}

function addSmartAppBanner({ manifest, opts, result }: Context): void {
  if (!opts.smartAppBanner || !manifest.appStoreId) {
    result.skipped['smartAppBanner'] = opts.smartAppBanner ? 'no preferred App Store app' : 'disabled';
    return;
  }
  const meta = addMeta('apple-itunes-app', `app-id=${manifest.appStoreId}`);
  if (meta) {
    result.added.push(meta);
  }
}

/** Draws an icon square, filling transparent pixels with `background`. */
async function renderTouchIcon(src: string, background: string): Promise<string> {
  const img = await loadImage(src);
  const ctx = createContext(TOUCH_ICON_SIZE, TOUCH_ICON_SIZE, true);
  if (!ctx) {
    throw new Error('canvas unavailable');
  }
  try {
    const ratio = Math.min(TOUCH_ICON_SIZE / img.naturalWidth, TOUCH_ICON_SIZE / img.naturalHeight);
    const w = img.naturalWidth * ratio;
    const h = img.naturalHeight * ratio;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (TOUCH_ICON_SIZE - w) / 2, (TOUCH_ICON_SIZE - h) / 2, w, h);
    if (hasTransparency(ctx)) {
      // iOS shows transparency as black; paint the background behind the icon.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, TOUCH_ICON_SIZE, TOUCH_ICON_SIZE);
    }
    return ctx.canvas.toDataURL('image/png');
  } finally {
    releaseCanvas(ctx);
  }
}

async function addTouchIcon({ manifest, manifestHash, opts, store, result }: Context): Promise<void> {
  const mode = opts.touchIcon;
  if (mode === false) {
    result.skipped['touchIcon'] = 'disabled';
    return;
  }
  if (linksWithRel('apple-touch-icon').length > 0 || linksWithRel('apple-touch-icon-precomposed').length > 0) {
    result.skipped['touchIcon'] = 'page already has an apple-touch-icon';
    return;
  }
  const source = bestIcon(iconsFor(manifest, 'maskable'), TOUCH_ICON_SIZE) ??
    (mode === 'any' ? bestIcon(iconsFor(manifest, 'any'), TOUCH_ICON_SIZE) : undefined);
  if (!source) {
    result.skipped['touchIcon'] = mode === 'maskable'
      ? 'no maskable icon (iOS uses the manifest icons itself)'
      : 'no usable icon';
    return;
  }
  const background = manifest.backgroundColor && parseColor(manifest.backgroundColor) ? manifest.backgroundColor : WHITE;
  const key = `touch:${hash([manifestHash, source.src, background].join('\n'))}`;
  let href = store.get(key);
  if (!isPngDataUrl(href)) {
    try {
      href = await renderTouchIcon(source.src, background);
      store.set(key, href);
    } catch (err) {
      // Not readable (e.g. no CORS): link the original file rather than nothing.
      warn('could not process icon, linking it unchanged', source.src, err);
      href = source.src;
    }
  }
  result.added.push(addLink({ rel: 'apple-touch-icon', sizes: `${TOUCH_ICON_SIZE}x${TOUCH_ICON_SIZE}`, href }));
}

function splashStyle({ link, manifest, opts }: Context): SplashStyle {
  const requested = opts.splashBackground ?? manifest.backgroundColor;
  const parsed: RGB | null = requested ? parseColor(requested) : null;
  const background = parsed && requested ? requested : WHITE;
  const color = opts.splashColor ?? (prefersLightText(parsed ?? [255, 255, 255]) ? '#ffffff' : '#000000');
  const cssFont = getComputedStyle(link).getPropertyValue('--pwacompat-splash-font').trim();
  const title = opts.splashTitle ? (manifest.name ?? manifest.shortName ?? (document.title.trim() || null)) : null;
  return {
    background,
    color,
    font: opts.splashFont ?? (cssFont || DEFAULT_SPLASH_FONT),
    title,
    iconSize: opts.splashIconSize,
  };
}

function readCachedSplash(value: string | null, orientations: Orientation[]): Record<Orientation, string> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return orientations.every((o) => isPngDataUrl(parsed[o])) ? (parsed as Record<Orientation, string>) : null;
  } catch {
    return null;
  }
}

async function addSplash(c: Context): Promise<void> {
  const { manifest, manifestHash, opts, store, result } = c;
  if (!opts.splash) {
    result.skipped['splash'] = 'disabled';
    return;
  }
  if (manifest.display === 'browser') {
    result.skipped['splash'] = 'display is browser';
    return;
  }
  if (linksWithRel('apple-touch-startup-image').length > 0) {
    result.skipped['splash'] = 'page already has launch images';
    return;
  }
  const device = findDevice(screen.width, screen.height, devicePixelRatio);
  result.device = device;
  if (!device) {
    result.skipped['splash'] = 'not a current iPhone or iPad without a Home button';
    return;
  }

  const orientations = splashOrientations(device.kind, manifest.orientation);
  const style = splashStyle(c);
  const icon = bestIcon(iconsFor(manifest, 'any'), style.iconSize * device.scale) ??
    bestIcon(iconsFor(manifest, 'maskable'), style.iconSize * device.scale);
  const key = `splash:${hash(JSON.stringify([manifestHash, device, orientations, style, icon?.src ?? null]))}`;

  const append = (orientation: Orientation, href: string) => {
    result.added.push(addLink({ rel: 'apple-touch-startup-image', media: startupImageMedia(device, orientation), href }));
  };

  const cached = readCachedSplash(store.get(key), orientations);
  if (cached) {
    orientations.forEach((o) => append(o, cached[o]));
    return;
  }

  await document.fonts?.ready;
  await idle();
  const img = icon ? await loadImage(icon.src).catch((err: unknown) => {
    warn('launch image will have no icon', icon.src, err);
    return null;
  }) : null;
  const ctx = createContext(1, 1);
  if (!ctx) {
    result.skipped['splash'] = 'canvas unavailable';
    return;
  }
  const images: Partial<Record<Orientation, string>> = {};
  try {
    for (const orientation of orientations) {
      await idle();
      const portrait = orientation === 'portrait';
      drawSplash(ctx, portrait ? device.width : device.height, portrait ? device.height : device.width, device.scale, style, img);
      const href = ctx.canvas.toDataURL('image/png');
      images[orientation] = href;
      append(orientation, href);
    }
  } finally {
    releaseCanvas(ctx);
  }
  store.set(key, JSON.stringify(images));
}

/**
 * Reads the page's Web App Manifest and adds what Apple platforms need but
 * don't take from the manifest. Does nothing outside iOS, iPadOS and macOS
 * Safari, or inside an installed web app.
 *
 * Resolves when all work is done (launch images are drawn during idle time).
 * The same result is dispatched as a `pwacompat` event on the manifest link.
 */
export async function pwacompat(options: PwaCompatOptions = {}): Promise<PwaCompatResult | null> {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }
  const platform = detectPlatform(navigator);
  if (!platform || isStandalone()) {
    return null;
  }
  const link = options.manifestLink ?? findManifestLink();
  if (!link || !link.href) {
    warn('no <link rel="manifest" href="…"> in <head>');
    return null;
  }
  const opts = resolveOptions(options, (name) => link.getAttribute(name));
  const store = createStore(opts.cache);
  const loaded = await loadManifest(link, store);
  if (!loaded) {
    return null;
  }

  const result: PwaCompatResult = { platform, device: null, added: [], skipped: {} };
  const c: Context = { link, manifest: loaded.manifest, manifestHash: hash(loaded.text), opts, store, platform, result };

  const run = async (feature: string, fn: (c: Context) => void | Promise<void>) => {
    try {
      await fn(c);
    } catch (err) {
      result.skipped[feature] = 'error';
      warn(`${feature} failed`, err);
    }
  };

  await run('favicons', addFavicons);
  await run('themeColor', addThemeColor);
  if (platform === 'mac') {
    // Safari on macOS reads icons, name and display from the manifest and
    // shows no launch image, so nothing else is needed.
    result.skipped['splash'] = 'macOS shows no launch image';
  } else {
    await run('statusBar', addStatusBar);
    await run('smartAppBanner', addSmartAppBanner);
    await run('touchIcon', addTouchIcon);
    await run('splash', addSplash);
  }

  link.dispatchEvent(new CustomEvent<PwaCompatResult>('pwacompat', { detail: result }));
  return result;
}

export { detectPlatform, isStandalone };

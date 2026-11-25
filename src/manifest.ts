/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain: rewritten in TypeScript for v3.
 * SPDX-License-Identifier: Apache-2.0
 */

export type IconPurpose = 'any' | 'maskable' | 'monochrome';

export interface ManifestIcon {
  /** Absolute URL, resolved against the manifest URL. */
  readonly src: string;
  /** The `sizes` value as written, or `''` when absent. */
  readonly sizes: string;
  /** Largest edge in pixels; `Infinity` for `any`, `0` when unknown. */
  readonly largest: number;
  readonly purposes: readonly IconPurpose[];
  readonly type: string | undefined;
}

/** The manifest members pwacompat uses, validated and normalised. */
export interface Manifest {
  readonly name: string | undefined;
  readonly shortName: string | undefined;
  readonly display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser' | undefined;
  readonly orientation: string | undefined;
  readonly themeColor: string | undefined;
  readonly backgroundColor: string | undefined;
  readonly icons: readonly ManifestIcon[];
  /** Numeric App Store id, only when `prefer_related_applications` is true. */
  readonly appStoreId: string | undefined;
}

const DISPLAY_MODES = ['fullscreen', 'standalone', 'minimal-ui', 'browser'] as const;
const PURPOSES: readonly IconPurpose[] = ['any', 'maskable', 'monochrome'];
const ICON_PROTOCOLS = new Set(['https:', 'http:', 'data:', 'blob:']);
const MAX_ICONS = 64;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function words(value: string): string[] {
  return value.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Largest edge in a `sizes` value: `"48x48 96x96"` → 96, `"any"` → Infinity, missing → 0. */
export function largestIconSize(sizes: string): number {
  let largest = 0;
  for (const token of words(sizes)) {
    if (token === 'any') {
      return Infinity;
    }
    const match = /^(\d+)x(\d+)$/.exec(token);
    if (match) {
      largest = Math.max(largest, Number(match[1]), Number(match[2]));
    }
  }
  return largest;
}

function normalizeIcon(raw: unknown, base: string): ManifestIcon | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const icon = raw as Record<string, unknown>;
  const src = str(icon['src']);
  if (!src) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(src, base);
  } catch {
    return null;
  }
  if (!ICON_PROTOCOLS.has(url.protocol)) {
    return null;
  }
  const sizes = str(icon['sizes']) ?? '';
  const declared = str(icon['purpose']);
  // Unknown purposes are ignored; an icon with none left is ignored (spec).
  const purposes = declared ? words(declared).filter((p): p is IconPurpose => PURPOSES.includes(p as IconPurpose)) : ['any' as const];
  if (purposes.length === 0) {
    return null;
  }
  return { src: url.href, sizes, largest: largestIconSize(sizes), purposes, type: str(icon['type']) };
}

/**
 * Extracts a numeric App Store id from a `related_applications` entry: its
 * `id`, or the `/id<digits>` path segment of its `url`. Anything else is
 * rejected, so a crafted value can't add Smart App Banner parameters.
 */
export function appStoreIdFrom(app: unknown): string | undefined {
  if (typeof app !== 'object' || app === null) {
    return undefined;
  }
  const entry = app as Record<string, unknown>;
  if (entry['platform'] !== 'itunes') {
    return undefined;
  }
  const id = typeof entry['id'] === 'number' ? String(entry['id']) : str(entry['id']);
  if (id !== undefined) {
    return /^\d+$/.test(id) ? id : undefined;
  }
  const url = str(entry['url']);
  if (!url) {
    return undefined;
  }
  try {
    const match = /\/id(\d+)(?:\/|$)/.exec(new URL(url).pathname);
    return match?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Validates and normalises a parsed manifest. Bad or missing members are
 * dropped one by one, so one malformed field never discards the rest.
 */
export function normalizeManifest(raw: unknown, manifestUrl: string): Manifest {
  const m = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const icons = Array.isArray(m['icons'])
    ? m['icons'].slice(0, MAX_ICONS).map((icon) => normalizeIcon(icon, manifestUrl)).filter((icon) => icon !== null)
    : [];

  const display = str(m['display'])?.toLowerCase();
  const related = Array.isArray(m['related_applications']) ? m['related_applications'] : [];
  const appStoreId = m['prefer_related_applications'] === true
    ? related.map(appStoreIdFrom).find((id) => id !== undefined)
    : undefined;

  return {
    name: str(m['name']),
    shortName: str(m['short_name']),
    display: DISPLAY_MODES.find((mode) => mode === display),
    orientation: str(m['orientation'])?.toLowerCase(),
    themeColor: str(m['theme_color']),
    backgroundColor: str(m['background_color']),
    icons,
    appStoreId,
  };
}

/** Icons with a given purpose, largest first. */
export function iconsFor(manifest: Manifest, purpose: IconPurpose): ManifestIcon[] {
  return manifest.icons
    .filter((icon) => icon.purposes.includes(purpose))
    .sort((a, b) => (b.largest === a.largest ? 0 : b.largest > a.largest ? 1 : -1));
}

/**
 * The best icon to draw at `target` pixels: the smallest one at least that
 * big, otherwise the largest. Vector (`any`-sized) icons always fit.
 */
export function bestIcon(icons: readonly ManifestIcon[], target: number): ManifestIcon | undefined {
  const sorted = [...icons].sort((a, b) => (a.largest === b.largest ? 0 : a.largest > b.largest ? 1 : -1));
  return sorted.find((icon) => icon.largest >= target) ?? sorted.at(-1);
}

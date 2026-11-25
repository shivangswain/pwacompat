/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PwaCompatOptions, ResolvedOptions, TouchIconMode } from './types.ts';

export const DEFAULT_SPLASH_ICON_SIZE = 128;
const MIN_SPLASH_ICON_SIZE = 48;
const MAX_SPLASH_ICON_SIZE = 512;

/** Reads one attribute; `null` when absent. */
export type AttributeReader = (name: string) => string | null;

function bool(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  const v = value.trim().toLowerCase();
  if (v === 'false' || v === 'off' || v === 'no' || v === '0') {
    return false;
  }
  if (v === '' || v === 'true' || v === 'on' || v === 'yes' || v === '1') {
    return true;
  }
  return undefined;
}

function touchIconMode(value: string | null): TouchIconMode | undefined {
  const v = value?.trim().toLowerCase();
  if (v === 'maskable' || v === 'any') {
    return v;
  }
  return bool(value ?? null) === false ? false : undefined;
}

function text(value: string | null): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function clampIconSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_SPLASH_ICON_SIZE;
  }
  return Math.min(MAX_SPLASH_ICON_SIZE, Math.max(MIN_SPLASH_ICON_SIZE, Math.round(value)));
}

/**
 * Merges options passed in code with `data-pwacompat-*` attributes on the
 * manifest link. Code wins; unrecognised attribute values are ignored.
 */
export function resolveOptions(options: PwaCompatOptions, attr: AttributeReader): ResolvedOptions {
  const a = (name: string) => attr(`data-pwacompat-${name}`);
  const iconSize = options.splashIconSize ?? (text(a('splash-icon-size')) !== undefined ? Number(a('splash-icon-size')) : undefined);
  return {
    favicons: options.favicons ?? bool(a('favicons')) ?? true,
    themeColor: options.themeColor ?? bool(a('theme-color')) ?? true,
    statusBar: options.statusBar ?? bool(a('status-bar')) ?? true,
    touchIcon: options.touchIcon ?? touchIconMode(a('touch-icon')) ?? 'maskable',
    splash: options.splash ?? bool(a('splash')) ?? true,
    splashTitle: options.splashTitle ?? bool(a('splash-title')) ?? true,
    splashIconSize: clampIconSize(iconSize),
    splashFont: options.splashFont ?? text(a('splash-font')),
    splashBackground: options.splashBackground ?? text(a('splash-background')),
    splashColor: options.splashColor ?? text(a('splash-color')),
    smartAppBanner: options.smartAppBanner ?? bool(a('smart-app-banner')) ?? true,
    cache: options.cache ?? bool(a('cache')) ?? true,
  };
}

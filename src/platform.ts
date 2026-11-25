/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApplePlatform } from './types.ts';

declare global {
  interface Navigator {
    /** iOS/iPadOS only: true when running from the Home Screen. */
    readonly standalone?: boolean;
  }
}

/** The navigator fields platform detection reads, so it can be tested without a browser. */
export interface NavigatorLike {
  readonly userAgent: string;
  readonly vendor: string;
  readonly maxTouchPoints: number;
}

const NON_SAFARI_MAC = /\b(?:Chrome|Chromium|Edg|Firefox|OPR)\//;

/**
 * Returns the Apple platform this browser can install web apps on, or `null`.
 *
 * Every browser on iOS/iPadOS is WebKit and can add to the Home Screen
 * (iOS 16.4+), so any iPhone or iPad qualifies. iPadOS asks for desktop sites
 * by default and reports itself as a Mac; touch support gives it away. On
 * macOS only Safari can add a web app to the Dock.
 */
export function detectPlatform(nav: NavigatorLike): ApplePlatform | null {
  const ua = nav.userAgent || '';
  if (/\biPad\b/.test(ua)) {
    return 'ipad';
  }
  if (/\b(?:iPhone|iPod)\b/.test(ua)) {
    return 'iphone';
  }
  if (!/\bMacintosh\b/.test(ua)) {
    return null;
  }
  if (nav.maxTouchPoints > 1) {
    return 'ipad';
  }
  return /^Apple\b/.test(nav.vendor || '') && !NON_SAFARI_MAC.test(ua) ? 'mac' : null;
}

/** True when the page is already running as an installed web app. */
export function isStandalone(): boolean {
  if (navigator.standalone === true) {
    return true;
  }
  return typeof matchMedia === 'function' &&
    matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches;
}

/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppleDevice, Orientation } from './types.ts';

/**
 * Devices that get launch images: all-screen iPhones and iPads supported by
 * iOS 27 and iPadOS 27. Sizes are portrait CSS pixels (published resolution
 * divided by scale).
 */
const devices: AppleDevice[] = [
  { kind: 'iphone', width: 440, height: 956, scale: 3, models: 'iPhone 16 Pro Max, 17 Pro Max, 18 Pro Max' },
  { kind: 'iphone', width: 430, height: 932, scale: 3, models: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus' },
  { kind: 'iphone', width: 428, height: 926, scale: 3, models: 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus' },
  { kind: 'iphone', width: 420, height: 912, scale: 3, models: 'iPhone Air' },
  { kind: 'iphone', width: 414, height: 896, scale: 3, models: 'iPhone 11 Pro Max' },
  { kind: 'iphone', width: 414, height: 896, scale: 2, models: 'iPhone 11' },
  { kind: 'iphone', width: 402, height: 874, scale: 3, models: 'iPhone 16 Pro, 17, 17 Pro, 18 Pro' },
  { kind: 'iphone', width: 393, height: 852, scale: 3, models: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { kind: 'iphone', width: 390, height: 844, scale: 3, models: 'iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e, 17e' },
  { kind: 'iphone', width: 375, height: 812, scale: 3, models: 'iPhone 11 Pro, 12 mini, 13 mini' },
  { kind: 'ipad', width: 1032, height: 1376, scale: 2, models: 'iPad Pro 13-inch (M4, M5)' },
  { kind: 'ipad', width: 1024, height: 1366, scale: 2, models: 'iPad Pro 12.9-inch (4th–6th gen), iPad Air 13-inch (M2–M4)' },
  { kind: 'ipad', width: 834, height: 1210, scale: 2, models: 'iPad Pro 11-inch (M4, M5)' },
  { kind: 'ipad', width: 834, height: 1194, scale: 2, models: 'iPad Pro 11-inch (2nd–4th gen)' },
  { kind: 'ipad', width: 820, height: 1180, scale: 2, models: 'iPad Air 11-inch (4th, 5th gen, M2–M4), iPad (10th gen, A16)' },
  { kind: 'ipad', width: 756, height: 1158, scale: 2, models: 'iPad mini (A20 Pro)' },
  { kind: 'ipad', width: 744, height: 1133, scale: 2, models: 'iPad mini (6th gen, A17 Pro)' },
];

/** Devices that get launch images. */
export const APPLE_DEVICES: readonly AppleDevice[] = Object.freeze(devices.map((d) => Object.freeze(d)));

/** Finds the device for a screen size, in either orientation. */
export function findDevice(width: number, height: number, scale: number): AppleDevice | null {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  return APPLE_DEVICES.find((d) => d.width === short && d.height === long && d.scale === scale) ?? null;
}

/**
 * The media query iOS matches a launch image against. `device-width` and
 * `device-height` are always the portrait values; only `orientation` changes.
 */
export function startupImageMedia(device: AppleDevice, orientation: Orientation): string {
  return `(device-width: ${device.width}px) and (device-height: ${device.height}px)` +
    ` and (-webkit-device-pixel-ratio: ${device.scale}) and (orientation: ${orientation})`;
}

/**
 * Orientations that need a launch image. iPhone Home Screens don't rotate, so
 * an iPhone only needs landscape when the app is locked to landscape.
 */
export function splashOrientations(kind: AppleDevice['kind'], manifestOrientation: string | undefined): Orientation[] {
  const o = manifestOrientation ?? '';
  if (o.startsWith('portrait')) {
    return ['portrait'];
  }
  if (o.startsWith('landscape')) {
    return ['landscape'];
  }
  return kind === 'ipad' ? ['portrait', 'landscape'] : ['portrait'];
}

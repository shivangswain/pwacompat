/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain: rewritten in TypeScript for v3.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from './canvas.ts';

export type RGB = readonly [r: number, g: number, b: number];

/** WCAG 2 relative luminance of an sRGB colour (0–255 channels), from 0 (black) to 1 (white). */
export function relativeLuminance(rgb: RGB): number {
  // A plain array on purpose: mapping a Uint8ClampedArray would round each
  // linear value back to 0 or 1 (v2's contrast bug).
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two luminances, from 1 to 21. */
export function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** True when white text contrasts at least as well as black text on this background. */
export function prefersLightText(background: RGB): boolean {
  const lum = relativeLuminance(background);
  return contrastRatio(lum, 1) >= contrastRatio(lum, 0);
}

let colorContext: CanvasRenderingContext2D | null | undefined;

/**
 * Parses any CSS colour the browser understands. Returns `null` for invalid
 * input instead of silently treating it as black.
 */
export function parseColor(color: string): RGB | null {
  colorContext ??= createContext(1, 1, true);
  const ctx = colorContext;
  if (!ctx) {
    return null;
  }
  // An invalid assignment is ignored, so two different sentinels expose it.
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const first = ctx.fillStyle;
  ctx.fillStyle = '#fff';
  ctx.fillStyle = color;
  if (ctx.fillStyle !== first) {
    return null;
  }
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

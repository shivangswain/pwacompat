/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain: rewritten in TypeScript for v3.
 * SPDX-License-Identifier: Apache-2.0
 */

export type Measure = (text: string) => number;

const ELLIPSIS = '…';

/** Shortens `line` with an ellipsis until it fits, or when `ellipsis` is forced. */
function fit(line: string, maxWidth: number, measure: Measure, ellipsis: boolean): string {
  if (!ellipsis && measure(line) <= maxWidth) {
    return line;
  }
  const chars = [...line];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(chars.slice(0, mid).join('').trimEnd() + ELLIPSIS) <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return chars.slice(0, lo).join('').trimEnd() + ELLIPSIS;
}

/**
 * Greedy word wrap into at most `maxLines` lines no wider than `maxWidth`.
 * A word wider than a line, or text that needs more lines, is cut with an
 * ellipsis instead of being drawn off-screen.
 */
export function wrapText(text: string, maxWidth: number, measure: Measure, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let next = 0;
  for (; next < words.length; next++) {
    const word = words[next] as string;
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      break;
    }
  }
  const overflow = lines.length === maxLines && next < words.length;
  if (!overflow && current) {
    lines.push(current);
  }
  return lines.map((line, i) => fit(line, maxWidth, measure, overflow && i === lines.length - 1));
}

export interface SplashStyle {
  readonly background: string;
  readonly color: string;
  readonly font: string;
  readonly title: string | null;
  /** Icon box size in CSS pixels. */
  readonly iconSize: number;
}

/** Fallback when a custom font can't be parsed by canvas. */
export const DEFAULT_SPLASH_FONT = '600 24px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const ICON_TITLE_GAP = 24;

/**
 * Draws a launch image of `width` × `height` CSS pixels at `scale` onto the
 * context's canvas (which is resized): background, centred icon, and the
 * title wrapped underneath.
 */
export function drawSplash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  style: SplashStyle,
  icon: HTMLImageElement | null,
): void {
  ctx.canvas.width = Math.round(width * scale);
  ctx.canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, width, height);

  ctx.font = DEFAULT_SPLASH_FONT;
  ctx.font = style.font; // ignored by canvas when invalid
  const lines = style.title ? wrapText(style.title, width * 0.8, (t) => ctx.measureText(t).width) : [];
  const metrics = ctx.measureText('Hg');
  const ascent = metrics.actualBoundingBoxAscent || 20;
  const descent = metrics.actualBoundingBoxDescent || 5;
  const lineHeight = (ascent + descent) * 1.25;

  let iconWidth = 0;
  let iconHeight = 0;
  if (icon && icon.naturalWidth > 0 && icon.naturalHeight > 0) {
    const ratio = Math.min(style.iconSize / icon.naturalWidth, style.iconSize / icon.naturalHeight);
    iconWidth = icon.naturalWidth * ratio;
    iconHeight = icon.naturalHeight * ratio;
  }
  const gap = iconHeight && lines.length ? ICON_TITLE_GAP : 0;
  let y = (height - (iconHeight + gap + lines.length * lineHeight)) / 2;

  if (icon && iconHeight) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(icon, (width - iconWidth) / 2, y, iconWidth, iconHeight);
    y += iconHeight + gap;
  }
  ctx.fillStyle = style.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const line of lines) {
    ctx.fillText(line, width / 2, y + ascent);
    y += lineHeight;
  }
}

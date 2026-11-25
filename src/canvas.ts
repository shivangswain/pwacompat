/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain.
 * SPDX-License-Identifier: Apache-2.0
 */

/** Creates a 2D context, or `null` when canvas is unavailable. */
export function createContext(width: number, height: number, willReadFrequently = false): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently });
}

/** Releases a canvas's backing store; iOS keeps large canvases alive otherwise. */
export function releaseCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.canvas.width = 0;
  ctx.canvas.height = 0;
}

/** Loads an image so its pixels can be read back (CORS-enabled for other origins). */
export function loadImage(src: string, timeoutMs = 10_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error(`timed out loading ${src}`)), timeoutMs);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`could not load ${src}`));
    };
    img.src = src;
  });
}

/** True when any pixel in the context is not fully opaque. */
export function hasTransparency(ctx: CanvasRenderingContext2D): boolean {
  const { data } = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) {
      return true;
    }
  }
  return false;
}

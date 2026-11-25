/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain: rewritten in TypeScript for v3.
 * SPDX-License-Identifier: Apache-2.0
 */

// Entry point for the drop-in <script> build: runs once the page has loaded,
// configured by data-pwacompat-* attributes on the manifest link.

import { pwacompat } from './index.ts';

function start(): void {
  void pwacompat();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'complete') {
    start();
  } else {
    addEventListener('load', start, { once: true });
  }
}

/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain: rewritten in TypeScript for v3.
 * SPDX-License-Identifier: Apache-2.0
 */

const PREFIX = 'pwacompat:v3:';

/** A sessionStorage cache that never throws (private mode, full quota, sandboxed frames). */
export interface Store {
  get(key: string): string | null;
  /** Returns false when the value could not be stored. */
  set(key: string, value: string): boolean;
}

const noop: Store = { get: () => null, set: () => false };

export function createStore(enabled: boolean): Store {
  if (!enabled) {
    return noop;
  }
  let storage: Storage;
  try {
    storage = window.sessionStorage;
  } catch {
    return noop;
  }
  return {
    get(key) {
      try {
        return storage.getItem(PREFIX + key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItem(PREFIX + key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** FNV-1a 32-bit hash, for cache keys. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** True for a PNG data URL, the only thing pwacompat caches as an image. */
export function isPngDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/png;base64,');
}

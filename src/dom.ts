/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain.
 * SPDX-License-Identifier: Apache-2.0
 */

/** `<head>` helpers. Elements are matched by attribute values, not by selectors built from manifest data. */

/** Marks elements pwacompat added. */
export const MARKER = 'data-pwacompat';

export function findManifestLink(): HTMLLinkElement | null {
  for (const link of document.head.querySelectorAll('link')) {
    if (link.relList.contains('manifest') && link.getAttribute('href')) {
      return link;
    }
  }
  return null;
}

/** Links in `<head>` whose `rel` contains `rel`. */
export function linksWithRel(rel: string): HTMLLinkElement[] {
  return [...document.head.querySelectorAll('link')].filter((link) => link.relList.contains(rel));
}

export function hasMeta(name: string): boolean {
  const wanted = name.toLowerCase();
  return [...document.head.querySelectorAll('meta')].some((meta) => (meta.getAttribute('name') ?? '').toLowerCase() === wanted);
}

export function metaContent(name: string): string | null {
  const wanted = name.toLowerCase();
  const meta = [...document.head.querySelectorAll('meta')].find((m) => (m.getAttribute('name') ?? '').toLowerCase() === wanted);
  return meta?.getAttribute('content') ?? null;
}

function append<T extends Element>(el: T, attrs: Record<string, string>): T {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  el.setAttribute(MARKER, '');
  document.head.append(el);
  return el;
}

/** Adds `<meta name content>` unless a meta with that name exists. */
export function addMeta(name: string, content: string): HTMLMetaElement | null {
  if (hasMeta(name)) {
    return null;
  }
  return append(document.createElement('meta'), { name, content });
}

export function addLink(attrs: Record<string, string>): HTMLLinkElement {
  return append(document.createElement('link'), attrs);
}

/** True when the viewport meta opts into drawing under the status bar. */
export function viewportFitCover(): boolean {
  return /(?:^|[\s,;])viewport-fit\s*=\s*cover\b/i.test(metaContent('viewport') ?? '');
}

/*
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright 2026 Shivang P Swain.
 * SPDX-License-Identifier: Apache-2.0
 */

/** Which manifest icons may be turned into an `apple-touch-icon`. */
export type TouchIconMode = 'maskable' | 'any' | false;

/**
 * Options for {@link pwacompat}. Every feature can be switched off, and nothing
 * already present in `<head>` is ever replaced.
 *
 * The same options can be set without JavaScript as `data-pwacompat-*`
 * attributes on the manifest `<link>`, e.g. `data-pwacompat-splash="false"`.
 * Options passed in code win over attributes.
 */
export interface PwaCompatOptions {
  /** The manifest `<link>`. Defaults to the first `link[rel~="manifest"]` in `<head>`. */
  manifestLink?: HTMLLinkElement | null;
  /** Add `<link rel="icon">` from the manifest's `any` icons when the page has no favicon. Default `true`. */
  favicons?: boolean;
  /** Add `<meta name="theme-color">` from `theme_color`. Default `true`. */
  themeColor?: boolean;
  /** iOS/iPadOS: add `apple-mobile-web-app-status-bar-style`. Default `true`. */
  statusBar?: boolean;
  /**
   * iOS/iPadOS: which manifest icons may become an `apple-touch-icon`.
   * An `apple-touch-icon` overrides the manifest's icons on iOS, so by default
   * only full-bleed `maskable` icons are used.
   *
   * - `'maskable'` (default): only `maskable` icons.
   * - `'any'`: fall back to `any` icons, filling transparent pixels with `background_color`.
   * - `false`: never add one.
   */
  touchIcon?: TouchIconMode;
  /** iOS/iPadOS: generate a launch image for the current device. Default `true`. */
  splash?: boolean;
  /** Draw the app name on the launch image. Default `true`. */
  splashTitle?: boolean;
  /** Icon size on the launch image, in CSS pixels (48–512). Default `128`. */
  splashIconSize?: number;
  /** Canvas `font` for the launch image title. Default: the `--pwacompat-splash-font` CSS variable, then the system font. */
  splashFont?: string;
  /** Launch image background. Default: `background_color`, then white. */
  splashBackground?: string;
  /** Launch image title colour. Default: black or white, whichever contrasts more with the background. */
  splashColor?: string;
  /** iOS/iPadOS: add a Smart App Banner, only when the manifest sets `prefer_related_applications: true`. Default `true`. */
  smartAppBanner?: boolean;
  /** Cache the manifest and generated images in `sessionStorage`. Default `true`. */
  cache?: boolean;
}

/** Fully resolved options. */
export interface ResolvedOptions {
  favicons: boolean;
  themeColor: boolean;
  statusBar: boolean;
  touchIcon: TouchIconMode;
  splash: boolean;
  splashTitle: boolean;
  splashIconSize: number;
  splashFont: string | undefined;
  splashBackground: string | undefined;
  splashColor: string | undefined;
  smartAppBanner: boolean;
  cache: boolean;
}

/** An Apple platform that can install web apps. */
export type ApplePlatform = 'iphone' | 'ipad' | 'mac';

/** An iPhone or iPad screen: portrait size in CSS pixels and pixel ratio. */
export interface AppleDevice {
  readonly kind: 'iphone' | 'ipad';
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly models: string;
}

export type Orientation = 'portrait' | 'landscape';

/** What a run did, delivered as the resolved value and as a `pwacompat` event on the manifest link. */
export interface PwaCompatResult {
  platform: ApplePlatform;
  /** The matched device, when launch images were considered. */
  device: AppleDevice | null;
  /** Elements added to `<head>`, in order. */
  added: Element[];
  /** Why a feature did nothing, keyed by feature name. */
  skipped: Record<string, string>;
}

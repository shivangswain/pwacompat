# PWACompat

[![CI](https://github.com/shivangswain/pwacompat/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/shivangswain/pwacompat/actions/workflows/ci.yml)
[![GitLab pipeline](https://gitlab.com/shivangswain/pwacompat/badges/master/pipeline.svg)](https://gitlab.com/shivangswain/pwacompat/-/pipelines)
[![Latest release](https://img.shields.io/github/v/release/shivangswain/pwacompat?sort=semver)](https://github.com/shivangswain/pwacompat/releases/latest)

PWACompat reads your [Web App Manifest](https://developer.mozilla.org/docs/Web/Manifest) and adds the tags iOS, iPadOS and macOS Safari need but don't take from it, chiefly launch images. It never replaces tags already in your page, and every feature can be switched off.

## What it adds

| Platform | Tags |
| --- | --- |
| iPhone and iPad ([supported devices](#launch-images)) | `apple-touch-startup-image` drawn for the current device |
| iOS and iPadOS | `apple-touch-icon` from a `maskable` icon, `apple-mobile-web-app-status-bar-style`, `apple-itunes-app` when `prefer_related_applications` is true |
| iOS, iPadOS and macOS Safari | `theme-color`, `<link rel="icon">` favicons |

Other browsers and installed web apps are left untouched. Added elements carry a `data-pwacompat` attribute.

## Install

### Script

Download `pwacompat.min.js` from the [latest release](https://github.com/shivangswain/pwacompat/releases/latest), serve it from your origin, and pin it with the `integrity` hash from the release notes:

```html
<link rel="manifest" href="/manifest.webmanifest">
<script async src="/js/pwacompat.min.js"
        integrity="sha384-…"
        crossorigin="anonymous"></script>
```

It runs after the page's `load` event.

### ES module

Each release includes an npm package with type declarations:

```sh
npm install ./pwacompat-3.0.0.tgz
```

```ts
import { pwacompat } from 'pwacompat';

const result = await pwacompat({ touchIcon: 'any' });
```

The module runs only when `pwacompat()` is called. It resolves to `null` where there is nothing to do.

## Options

Set options as `data-pwacompat-*` attributes on the manifest link, or pass them to `pwacompat()`. Options in code take precedence.

```html
<link rel="manifest" href="/manifest.webmanifest"
      data-pwacompat-touch-icon="any"
      data-pwacompat-splash-background="#0b1d2a">
```

| Attribute | Option | Default | Effect |
| --- | --- | --- | --- |
| `data-pwacompat-splash` | `splash` | `true` | Generate a launch image |
| `data-pwacompat-splash-title` | `splashTitle` | `true` | Draw the app name on it |
| `data-pwacompat-splash-icon-size` | `splashIconSize` | `128` | Icon size in CSS pixels (48–512) |
| `data-pwacompat-splash-font` | `splashFont` | system font, 24px semibold | Canvas `font` for the title; also read from the `--pwacompat-splash-font` CSS variable on the manifest link |
| `data-pwacompat-splash-background` | `splashBackground` | `background_color`, then white | Launch image background |
| `data-pwacompat-splash-color` | `splashColor` | black or white, whichever contrasts more | Title colour |
| `data-pwacompat-touch-icon` | `touchIcon` | `maskable` | `maskable`: maskable icons only. `any`: also `any` icons, with transparent pixels filled with `background_color`. `false`: none. |
| `data-pwacompat-status-bar` | `statusBar` | `true` | Add `apple-mobile-web-app-status-bar-style` |
| `data-pwacompat-theme-color` | `themeColor` | `true` | Add `theme-color` |
| `data-pwacompat-favicons` | `favicons` | `true` | Add favicons when the page has none |
| `data-pwacompat-smart-app-banner` | `smartAppBanner` | `true` | Add `apple-itunes-app` |
| `data-pwacompat-cache` | `cache` | `true` | Cache the manifest and images in `sessionStorage` |

Boolean attributes accept `true`/`false`, `on`/`off`, `yes`/`no` and `1`/`0`.

The status bar style is `black-translucent` when the viewport meta has `viewport-fit=cover`, otherwise `black` for dark themes and `default` for light ones.

## Launch images

iOS shows a launch image only when its size and media query match the device exactly. PWACompat draws one for the current device during idle time and caches it for the session. Supported devices are the all-screen iPhones and iPads on iOS 27 and iPadOS 27:

| Screen (CSS px) | Scale | Devices |
| --- | --- | --- |
| 440 × 956 | 3× | iPhone 16 Pro Max, 17 Pro Max, 18 Pro Max |
| 430 × 932 | 3× | iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus |
| 428 × 926 | 3× | iPhone 12 Pro Max, 13 Pro Max, 14 Plus |
| 420 × 912 | 3× | iPhone Air |
| 414 × 896 | 3× | iPhone 11 Pro Max |
| 414 × 896 | 2× | iPhone 11 |
| 402 × 874 | 3× | iPhone 16 Pro, 17, 17 Pro, 18 Pro |
| 393 × 852 | 3× | iPhone 14 Pro, 15, 15 Pro, 16 |
| 390 × 844 | 3× | iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e, 17e |
| 375 × 812 | 3× | iPhone 11 Pro, 12 mini, 13 mini |
| 1032 × 1376 | 2× | iPad Pro 13-inch (M4, M5) |
| 1024 × 1366 | 2× | iPad Pro 12.9-inch (4th–6th gen), iPad Air 13-inch (M2–M4) |
| 834 × 1210 | 2× | iPad Pro 11-inch (M4, M5) |
| 834 × 1194 | 2× | iPad Pro 11-inch (2nd–4th gen) |
| 820 × 1180 | 2× | iPad Air 11-inch (4th, 5th gen, M2–M4), iPad (10th gen, A16) |
| 756 × 1158 | 2× | iPad mini (A20 Pro) |
| 744 × 1133 | 2× | iPad mini (6th gen, A17 Pro) |

- iPhones get a portrait image; iPads get portrait and landscape. A manifest `orientation` of `portrait*` or `landscape*` limits it to that one.
- No image is drawn when `display` is `browser` or the page already has `apple-touch-startup-image` links.
- macOS has no web app launch images.

The table is exported as `APPLE_DEVICES`.

## Result event

PWACompat dispatches a `pwacompat` event on the manifest link when it finishes. `detail` is the same object `pwacompat()` resolves to:

```js
document.querySelector('link[rel="manifest"]').addEventListener('pwacompat', (e) => {
  console.log(e.detail.platform, e.detail.added, e.detail.skipped);
});
```

## Browser support

Safari 16.4 and later on iOS and iPadOS. Adding a web app to the Dock on macOS needs Safari 17 or later.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run test:unit       # Node test runner
npm run build           # dist/: pwacompat.min.js, pwacompat.mjs, types
npx playwright install chromium webkit
npm run test:browser    # Playwright, emulating iPhone, iPad and Mac
```

`PW_CHANNEL=msedge` or `PW_CHANNEL=chrome` runs the Chromium tests in an installed browser. `demo/` loads `../dist/pwacompat.min.js` for manual testing.

`node scripts/dist-hashes.mjs` lists the SHA-256 of every file in `dist/`; `--check <file>` compares against a saved list.

## Releasing

1. Set `version` in `package.json` and add a matching `## [x.y.z]` section to `CHANGELOG.md`.
2. Tag and push: `git tag -s vX.Y.Z && git push origin vX.Y.Z`.

Both pipelines test, build, and publish `pwacompat.min.js` with its source map, `pwacompat.mjs`, the npm package, `SHA256SUMS` and `sri.json`. Release notes come from the changelog.

- **GitHub Actions** creates a GitHub Release with a signed build-provenance attestation (`gh attestation verify pwacompat.min.js --repo shivangswain/pwacompat`).
- **GitLab CI/CD** uploads the files to the Generic Package Registry and creates a GitLab Release linking them.

Builds are reproducible. `dist/` is byte-identical on Linux and Windows; CI checks both. The npm tarball depends on the npm version, so release builds use the exact Node version in `.nvmrc`, and a release is published only if it matches the tested build. Each release's notes give the commit and Node version needed to reproduce it.

## License

Apache 2.0, based on PWACompat by the Chrome team at Google. See [LICENSE](LICENSE).

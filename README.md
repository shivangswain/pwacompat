# PWACompat 3

PWACompat fills the gaps between your [Web App Manifest](https://developer.mozilla.org/docs/Web/Manifest) and Apple platforms. Safari reads most of the manifest itself today, but iOS and iPadOS still have no manifest field for launch images, and a few other details still need HTML tags.

Version 3 is a TypeScript rewrite for current iOS, iPadOS and macOS. It adds only what those platforms can't take from the manifest, never replaces tags you wrote, and lets you switch every feature off. See the [changelog](CHANGELOG.md) for what changed from v2.

## What it adds

| Platform | Adds |
| --- | --- |
| iPhone and iPad without a Home button | A launch image (`apple-touch-startup-image`) drawn for this exact device |
| iOS and iPadOS | `apple-touch-icon` from a `maskable` icon, `apple-mobile-web-app-status-bar-style`, a Smart App Banner when you prefer your App Store app |
| iOS, iPadOS and macOS Safari | `<meta name="theme-color">` and `<link rel="icon">` favicons |
| Any other browser, or an installed web app | Nothing: the manifest is read natively, and an installed app has already captured its metadata |

Each tag is added only if the page doesn't already have one. Added elements carry a `data-pwacompat` attribute.

PWACompat no longer adds `apple-mobile-web-app-capable` or `apple-mobile-web-app-title`, because iOS reads `display` and `name` from the manifest. It also dropped the UC Browser, QQ Browser, Internet Explorer and Windows tags that v2 added "just in case". Those were the main concerns in Maximiliano Firtman's [critique of v2](https://medium.com/@firt/you-shouldnt-use-chrome-s-pwacompat-library-in-your-progressive-web-apps-6b3496faab62).

## Install

### Drop-in script

Download `pwacompat.min.js` from the [latest release](https://github.com/shivangswain/pwacompat/releases/latest) and serve it from your own origin. The release notes include the `integrity` hash for that version:

```html
<link rel="manifest" href="/manifest.webmanifest">
<script async src="/js/pwacompat.min.js"
        integrity="sha384-…from the release notes…"
        crossorigin="anonymous"></script>
```

The script waits for the page's `load` event, so it never competes with your content. Don't hotlink an unversioned copy from a CDN: it runs with full access to your page.

### ES module

The release's `pwacompat-<version>.tgz` is an npm package with type declarations:

```sh
npm install ./pwacompat-3.0.0.tgz
```

```ts
import { pwacompat } from 'pwacompat';

const result = await pwacompat({ touchIcon: 'any' });
console.log(result?.added, result?.skipped);
```

The module doesn't run on import; call `pwacompat()` when you're ready, for example after your fonts load. It resolves to `null` on platforms where it does nothing.

## Options

Set options as attributes on the manifest link, or pass them to `pwacompat()`. Options in code win over attributes.

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
| `data-pwacompat-splash-font` | `splashFont` | system font, 24px semibold | Canvas `font` for the title. The v2 CSS variable `--pwacompat-splash-font` on the manifest link still works. |
| `data-pwacompat-splash-background` | `splashBackground` | `background_color`, then white | Launch image background |
| `data-pwacompat-splash-color` | `splashColor` | black or white, whichever contrasts more | Title colour |
| `data-pwacompat-touch-icon` | `touchIcon` | `maskable` | `maskable`: only full-bleed maskable icons. `any`: also `any` icons, with transparent pixels filled with `background_color`. `false`: never. |
| `data-pwacompat-status-bar` | `statusBar` | `true` | Add `apple-mobile-web-app-status-bar-style` |
| `data-pwacompat-theme-color` | `themeColor` | `true` | Add `theme-color` |
| `data-pwacompat-favicons` | `favicons` | `true` | Add favicons when the page has none |
| `data-pwacompat-smart-app-banner` | `smartAppBanner` | `true` | Add `apple-itunes-app` when `prefer_related_applications` is true |
| `data-pwacompat-cache` | `cache` | `true` | Cache the manifest and images in `sessionStorage` |

Boolean attributes accept `true`/`false`, `on`/`off`, `yes`/`no` or `1`/`0`.

### Your own launch images and icons win

Add your own `apple-touch-startup-image` or `apple-touch-icon` links and PWACompat leaves them alone. Designed launch images look better than generated ones; generated images are a fallback.

### Status bar

`apple-mobile-web-app-status-bar-style` is `black-translucent` when your viewport meta has `viewport-fit=cover`. Otherwise it's `black` for dark themes and `default` for light ones.

## Launch images

iOS shows a launch image only if its size and media query match the device exactly. PWACompat draws one for the current device in idle time and caches it for the session. It covers these iPhones and iPads, which have no Home button and run iOS 27 or iPadOS 27:

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

Devices with a Home button (iPhone SE, iPads with Touch ID in the Home button) get no launch image but still get the other tags.

- iPhone Home Screens don't rotate, so iPhones get a portrait image only, unless the manifest's `orientation` is landscape.
- iPads get portrait and landscape, unless `orientation` locks one.
- No launch image is made when `display` is `browser`.
- macOS shows no launch image for web apps, so none is made there.

The table is exported as `APPLE_DEVICES` from the ES module.

## Events

When it finishes, PWACompat dispatches a `pwacompat` event on the manifest link. Its `detail` matches the value `pwacompat()` resolves to:

```js
document.querySelector('link[rel="manifest"]').addEventListener('pwacompat', (e) => {
  console.log(e.detail.platform, e.detail.added, e.detail.skipped);
});
```

## Browser support

The script targets Safari 16.4 and later, the first release where every iOS browser can add a site to the Home Screen. Adding a site to the Dock on macOS needs Safari 17 or later.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run test:unit       # Node's test runner, no browser
npm run build           # dist/: pwacompat.min.js, pwacompat.mjs, types
npx playwright install chromium webkit
npm run test:browser    # Playwright, emulating iPhone, iPad and Mac
```

Set `PW_CHANNEL=msedge` or `PW_CHANNEL=chrome` to run the Chromium tests in an installed browser instead of downloading one. The browser tests load the built files, so run `npm run build` first. `demo/` is a manual test page that loads `../dist/pwacompat.min.js`.

## Releasing

1. Update `version` in `package.json` and add a matching `## [x.y.z]` section to `CHANGELOG.md`.
2. Commit, then tag and push: `git tag -s vX.Y.Z && git push origin vX.Y.Z`.

Both pipelines then run the tests and publish the same assets: `pwacompat.min.js` and its source map, `pwacompat.mjs`, the npm tarball, `SHA256SUMS` and `sri.json`. The release notes come from the changelog and include the SRI snippet.

- **GitHub Actions** (`.github/workflows/release.yml`) creates a GitHub Release and attaches a signed build-provenance attestation. Verify it with `gh attestation verify pwacompat.min.js --repo shivangswain/pwacompat`.
- **GitLab CI/CD** (`.gitlab-ci.yml`) uploads the files to the project's Generic Package Registry and creates a GitLab Release that links them.

The build is deterministic, and both pipelines build twice and compare the output.

## License

Apache 2.0. Originally written by the Chrome team at Google; version 3 is a rewrite. See [LICENSE](LICENSE).

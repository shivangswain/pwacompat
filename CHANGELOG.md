# Changelog

## [3.0.0] - 2026-11-25

A TypeScript rewrite focused on current Apple platforms. Breaking: older browsers are no longer supported and several legacy tags are no longer added.

### Changed

- Rewritten in TypeScript and built with esbuild. Ships a drop-in script (`dist/pwacompat.min.js`), an ES module with types (`dist/pwacompat.mjs`) and a source map.
- Runs only on iOS, iPadOS (including desktop-mode iPad) and macOS Safari, and does nothing inside an installed web app. Every other browser reads the manifest natively.
- Launch images are drawn only for the current device, and only for the all-screen iPhones and iPads supported by iOS 27 / iPadOS 27. Each image carries an exact `device-width`/`device-height`/`-webkit-device-pixel-ratio`/`orientation` media query. iPhones get portrait only; iPads get both unless the manifest locks one.
- Launch images are drawn in idle time on one reused canvas, after web fonts load, and are cached per manifest and device.
- `apple-touch-icon` is generated only from `maskable` icons by default, because it overrides the icons iOS would otherwise read from the manifest. Set `data-pwacompat-touch-icon="any"` for the v2 behaviour.
- The Smart App Banner (`apple-itunes-app`) is added only when the manifest sets `prefer_related_applications: true`.
- Status bar text colour now picks whichever of black or white contrasts more with `theme_color` (WCAG).
- macOS Safari only gets `theme-color` and favicons; it reads icons, name and display from the manifest itself and shows no launch image.

### Added

- Every feature can be switched off, and launch images restyled, with `data-pwacompat-*` attributes on the manifest link or options to `pwacompat()`.
- A `pwacompat` event on the manifest link (and the promise from `pwacompat()`) reports what was added and why anything was skipped.
- Release pipelines for GitHub Actions and GitLab CI that test, build reproducibly and publish the same assets with SHA-256 checksums and SRI hashes; GitHub releases also get a signed build-provenance attestation.

### Removed

- `apple-mobile-web-app-capable` and `apple-mobile-web-app-title`: iOS reads `display` and `name` from the manifest. v2 also mapped `minimal-ui` and `fullscreen` to standalone.
- `mobile-web-app-capable`, UC Browser and QQ Browser tags (`x5-*`, `screen-orientation`, `full-screen`, `browsermode`).
- Internet Explorer and legacy Edge pinned-site tags (`msapplication-*`, `application-name`) and the Windows UWP title bar API.
- Support for Internet Explorer and Safari before 16.4.

### Fixed

- The minified build no longer drops `navigator.standalone`, icon `purpose` or text metrics. Closure Compiler renamed those properties in v2.
- Status bar and launch-image text colours were wrong for light backgrounds such as `#b0b0b0`, pink and orange. v2's contrast maths ran on a `Uint8ClampedArray` that rounded every channel to 0 or 1.
- An icon without `sizes`, an iTunes entry without `url`, or any other malformed field no longer discards the whole manifest. Each feature now fails on its own.
- A full or unavailable `sessionStorage` no longer stops the manifest from being applied or throws an uncaught error.
- The session cache is keyed by manifest URL, so apps sharing an origin no longer get each other's theme and icons. Cached images are validated before use.
- Manifest values are never built into CSS selectors.
- The App Store id is taken from the `/id<digits>` path segment and must be numeric.
- A page without a manifest link logs a warning instead of throwing a string.
- Maskable icons no longer replace regular favicons.
- Icon URLs always resolve against the manifest URL, and only `https:`, `http:`, `data:` and `blob:` icons are used.
- Long app names wrap and are cut with an ellipsis instead of being drawn off-screen.

## [2.0.17] - 2020-08-27

Last release of the original JavaScript library by the Chrome team.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveOptions } from '../../src/options.ts';
import { detectPlatform } from '../../src/platform.ts';
import { wrapText } from '../../src/splash.ts';
import { hash, isPngDataUrl } from '../../src/storage.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const APPLE = 'Apple Computer, Inc.';

describe('detectPlatform', () => {
  it('detects iPhone, iPad and macOS Safari', () => {
    assert.equal(detectPlatform({ userAgent: IPHONE, vendor: APPLE, maxTouchPoints: 5 }), 'iphone');
    assert.equal(detectPlatform({ userAgent: IPAD_DESKTOP, vendor: APPLE, maxTouchPoints: 5 }), 'ipad');
    assert.equal(detectPlatform({ userAgent: IPAD_DESKTOP, vendor: APPLE, maxTouchPoints: 0 }), 'mac');
  });

  it('treats every iOS browser as iOS (all can add to the Home Screen)', () => {
    assert.equal(detectPlatform({ userAgent: CHROME_IOS, vendor: APPLE, maxTouchPoints: 5 }), 'iphone');
  });

  it('ignores non-Apple platforms and non-Safari Mac browsers', () => {
    assert.equal(detectPlatform({ userAgent: ANDROID, vendor: 'Google Inc.', maxTouchPoints: 5 }), null);
    assert.equal(detectPlatform({ userAgent: CHROME_MAC, vendor: 'Google Inc.', maxTouchPoints: 0 }), null);
    assert.equal(detectPlatform({ userAgent: IPAD_DESKTOP, vendor: '', maxTouchPoints: 0 }), null);
  });
});

describe('resolveOptions', () => {
  const attrs = (map: Record<string, string>) => (name: string) => map[name] ?? null;

  it('defaults every feature on and touch icons to maskable', () => {
    const o = resolveOptions({}, attrs({}));
    assert.deepEqual(
      [o.favicons, o.themeColor, o.statusBar, o.splash, o.splashTitle, o.smartAppBanner, o.cache, o.touchIcon, o.splashIconSize],
      [true, true, true, true, true, true, true, 'maskable', 128],
    );
  });

  it('reads data-pwacompat-* attributes', () => {
    const o = resolveOptions({}, attrs({
      'data-pwacompat-splash': 'false',
      'data-pwacompat-touch-icon': 'any',
      'data-pwacompat-splash-icon-size': '9999',
      'data-pwacompat-splash-background': ' #ff0000 ',
      'data-pwacompat-cache': 'off',
    }));
    assert.equal(o.splash, false);
    assert.equal(o.touchIcon, 'any');
    assert.equal(o.splashIconSize, 512);
    assert.equal(o.splashBackground, '#ff0000');
    assert.equal(o.cache, false);
  });

  it('lets options in code win and ignores junk attribute values', () => {
    const o = resolveOptions({ splash: true, touchIcon: false }, attrs({
      'data-pwacompat-splash': 'false',
      'data-pwacompat-status-bar': 'maybe',
      'data-pwacompat-splash-icon-size': 'big',
    }));
    assert.equal(o.splash, true);
    assert.equal(o.touchIcon, false);
    assert.equal(o.statusBar, true);
    assert.equal(o.splashIconSize, 128);
  });
});

describe('wrapText', () => {
  const measure = (t: string) => t.length; // one unit per character

  it('keeps short titles on one line', () => {
    assert.deepEqual(wrapText('My App', 20, measure), ['My App']);
  });

  it('wraps on word boundaries', () => {
    assert.deepEqual(wrapText('one two three four', 9, measure), ['one two', 'three', 'four']);
  });

  it('ellipsises a word wider than the line instead of overflowing', () => {
    const [line] = wrapText('Supercalifragilistic', 8, measure);
    assert.ok(line && line.length <= 8 && line.endsWith('…'), line);
  });

  it('caps the number of lines and marks the cut', () => {
    const lines = wrapText('a b c d e f g h', 3, measure, 2);
    assert.equal(lines.length, 2);
    assert.ok(lines[1]?.endsWith('…'));
    assert.ok(lines.every((l) => l.length <= 3));
  });

  it('returns nothing for blank titles', () => {
    assert.deepEqual(wrapText('   ', 10, measure), []);
  });
});

describe('storage helpers', () => {
  it('hashes deterministically', () => {
    assert.equal(hash('abc'), hash('abc'));
    assert.notEqual(hash('abc'), hash('abd'));
  });

  it('accepts only PNG data URLs', () => {
    assert.ok(isPngDataUrl('data:image/png;base64,AAAA'));
    assert.ok(!isPngDataUrl('javascript:alert(1)'));
    assert.ok(!isPngDataUrl(42));
  });
});

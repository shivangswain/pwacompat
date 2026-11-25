import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPLE_DEVICES, findDevice, splashOrientations, startupImageMedia } from '../../src/devices.ts';

describe('APPLE_DEVICES', () => {
  it('has no duplicate size/scale pairs', () => {
    const keys = APPLE_DEVICES.map((d) => `${d.width}x${d.height}@${d.scale}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('stores portrait sizes', () => {
    for (const d of APPLE_DEVICES) {
      assert.ok(d.width < d.height, d.models);
    }
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(APPLE_DEVICES));
    assert.ok(APPLE_DEVICES.every((d) => Object.isFrozen(d)));
  });
});

describe('findDevice', () => {
  it('finds current devices in either orientation', () => {
    assert.match(findDevice(402, 874, 3)?.models ?? '', /17 Pro/);
    assert.match(findDevice(874, 402, 3)?.models ?? '', /17 Pro/);
    assert.match(findDevice(1032, 1376, 2)?.models ?? '', /iPad Pro 13/);
    assert.equal(findDevice(414, 896, 2)?.models, 'iPhone 11');
  });

  it('ignores devices with a Home button', () => {
    assert.equal(findDevice(375, 667, 2), null); // iPhone SE (2nd/3rd gen), 6–8
    assert.equal(findDevice(414, 736, 3), null); // iPhone 6–8 Plus
    assert.equal(findDevice(810, 1080, 2), null); // iPad (7th–9th gen)
    assert.equal(findDevice(768, 1024, 2), null); // iPad mini 5, older iPads
    assert.equal(findDevice(834, 1112, 2), null); // iPad Air 3
  });

  it('requires the exact pixel ratio', () => {
    assert.equal(findDevice(402, 874, 2), null);
  });
});

describe('startupImageMedia', () => {
  it('uses portrait device sizes with the orientation', () => {
    const device = findDevice(402, 874, 3);
    assert.ok(device);
    assert.equal(
      startupImageMedia(device, 'landscape'),
      '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
    );
  });
});

describe('splashOrientations', () => {
  it('iPhones get portrait only unless locked to landscape', () => {
    assert.deepEqual(splashOrientations('iphone', undefined), ['portrait']);
    assert.deepEqual(splashOrientations('iphone', 'any'), ['portrait']);
    assert.deepEqual(splashOrientations('iphone', 'landscape-primary'), ['landscape']);
  });

  it('iPads get both unless the manifest locks one', () => {
    assert.deepEqual(splashOrientations('ipad', undefined), ['portrait', 'landscape']);
    assert.deepEqual(splashOrientations('ipad', 'portrait'), ['portrait']);
    assert.deepEqual(splashOrientations('ipad', 'landscape'), ['landscape']);
  });
});

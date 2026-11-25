import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contrastRatio, prefersLightText, relativeLuminance, type RGB } from '../../src/color.ts';

describe('relativeLuminance', () => {
  it('matches WCAG reference points', () => {
    assert.equal(relativeLuminance([0, 0, 0]), 0);
    assert.equal(relativeLuminance([255, 255, 255]), 1);
    assert.ok(Math.abs(relativeLuminance([176, 176, 176]) - 0.434) < 0.001);
  });

  it('keeps fractional channel values', () => {
    assert.ok(relativeLuminance([176, 176, 176]) > 0.4);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white, in either order', () => {
    assert.equal(contrastRatio(0, 1), 21);
    assert.equal(contrastRatio(1, 0), 21);
  });
});

describe('prefersLightText', () => {
  const cases: Array<[string, RGB, boolean]> = [
    ['light grey #b0b0b0', [176, 176, 176], false],
    ['light pink #ffb6c1', [255, 182, 193], false],
    ['orange #ffa500', [255, 165, 0], false],
    ['light green #90ee90', [144, 238, 144], false],
    ['white', [255, 255, 255], false],
    ['dark navy #2c3e50', [44, 62, 80], true],
    ['red #ff0000 (black 5.3:1 beats white 4.0:1)', [255, 0, 0], false],
    ['dark red #c0392b', [192, 57, 43], true],
    ['black', [0, 0, 0], true],
  ];
  for (const [label, rgb, light] of cases) {
    it(`${label} → ${light ? 'white' : 'black'} text`, () => {
      assert.equal(prefersLightText(rgb), light);
    });
  }
});

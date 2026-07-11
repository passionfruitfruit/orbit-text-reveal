import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('keeps valid text items and per-item timing', () => {
  const config = normalizeConfig({
    texts: [
      { text: '单行', holdMs: 1400 },
      { text: '第一行\n第二行', revealMs: 1200 }
    ]
  });
  assert.equal(config.texts.length, 2);
  assert.equal(config.texts[0].holdMs, 1400);
  assert.equal(config.texts[1].revealMs, 1200);
});

test('drops empty items and clamps unsafe numeric values', () => {
  const config = normalizeConfig({
    texts: [{ text: '   ' }, null, { text: '有效' }],
    timing: { centerHoldMs: -8, retractMs: 99_999 },
    layout: { maxWidth: 0, scale: 99 }
  });
  assert.deepEqual(config.texts.map((item) => item.text), ['有效']);
  assert.equal(config.timing.centerHoldMs, 0);
  assert.equal(config.timing.retractMs, 20_000);
  assert.equal(config.layout.maxWidth, 120);
  assert.equal(config.layout.scale, 4);
});

test('returns independent objects and preserves exact default center hold', () => {
  const first = normalizeConfig({});
  const second = normalizeConfig({});
  first.layout.fontSize = 10;
  assert.equal(second.layout.fontSize, DEFAULT_CONFIG.layout.fontSize);
  assert.equal(second.timing.centerHoldMs, 1000);
  assert.equal(second.layout.autoWrap, true);
  assert.ok(second.motion.characterMinScale > 0 && second.motion.characterMinScale < 1);
  assert.equal(second.motion.easing, 'cubic-bezier(0.5, 0, 0.8, 0.8)');
  assert.equal(second.motion.continuationEasing, 'linear');
});

test('normalizes wrapping and minimum character scale controls', () => {
  const config = normalizeConfig({
    layout: { autoWrap: false },
    motion: { characterMinScale: 0, continuationEasing: 'steps(4, end)' }
  });
  assert.equal(config.layout.autoWrap, false);
  assert.equal(config.motion.characterMinScale, 0.01);
  assert.equal(config.motion.continuationEasing, 'steps(4, end)');
});

test('normalizes optional per-text layout overrides without filling unspecified keys', () => {
  const config = normalizeConfig({
    texts: [{
      text: '独立布局',
      layout: {
        maxWidth: 480,
        fontSize: 44,
        lineHeight: 1.4,
        ballSizeEm: 0.6,
        ballGapEm: 0.3,
        x: '35%',
        y: '60%',
        scale: 1.25
        ,autoWrap: false
      }
    }]
  });

  assert.deepEqual(config.texts[0].layout, {
    maxWidth: 480,
    fontSize: 44,
    lineHeight: 1.4,
    ballSizeEm: 0.6,
    ballGapEm: 0.3,
    x: '35%',
    y: '60%',
    scale: 1.25,
    autoWrap: false
  });
  assert.deepEqual(normalizeConfig({ texts: [{ text: '默认' }] }).texts[0], { text: '默认' });
});

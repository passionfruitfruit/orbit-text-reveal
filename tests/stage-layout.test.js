import test from 'node:test';
import assert from 'node:assert/strict';

import { fitTextLayoutToStage, fitTextSequenceToStage } from '../src/stage-layout.js';

const measure = (value) => Array.from(value).length * 10;

function fitsStage(result, width, height, margin = 16) {
  const tolerance = 1e-6;
  return result.geometry.lines.every((line) => (
    line.x >= margin - tolerance
      && line.x + line.width <= width - margin + tolerance
      && line.y >= margin - tolerance
      && line.y + result.lineHeightPx <= height - margin + tolerance
      && [line.start, line.end].every((point) => (
        point.x - result.ballSize / 2 >= margin - tolerance
          && point.x + result.ballSize / 2 <= width - margin + tolerance
          && point.y - result.ballSize / 2 >= margin - tolerance
          && point.y + result.ballSize / 2 <= height - margin + tolerance
      ))
  ));
}

test('many manual lines auto-fit the complete text block and ball endpoints vertically', () => {
  const result = fitTextLayoutToStage({
    text: Array.from({ length: 12 }, (_, index) => `line${index}`).join('\n'),
    layout: {
      maxWidth: 300, fontSize: 48, lineHeight: 1.2,
      ballSizeEm: 0.8, ballGapEm: 0.2, scale: 1
    },
    availableWidth: 360,
    availableHeight: 180,
    centerX: 180,
    centerY: 90,
    safeMargin: 16,
    measure
  });

  assert.equal(result.fits, true);
  assert.ok(result.autoFitScale < 1);
  assert.equal(fitsStage(result, 360, 180), true);
});

test('narrow and short stages fit wrapped lines on both axes', () => {
  const result = fitTextLayoutToStage({
    text: 'one two three four five six seven eight nine ten',
    layout: {
      maxWidth: 680, fontSize: 64, lineHeight: 1.16,
      ballSizeEm: 0.78, ballGapEm: 0.2, scale: 1
    },
    availableWidth: 150,
    availableHeight: 96,
    centerX: 75,
    centerY: 48,
    safeMargin: 16,
    measure
  });

  assert.equal(result.fits, true);
  assert.equal(fitsStage(result, 150, 96), true);
});

test('a text sequence uses one stable auto-fit scale for every item', () => {
  const layout = {
    maxWidth: 300, fontSize: 48, lineHeight: 1.2,
    ballSizeEm: 0.8, ballGapEm: 0.2, scale: 1, autoWrap: true
  };
  const results = fitTextSequenceToStage({
    texts: ['短句', 'a much longer sentence that requires fitting'],
    layout,
    availableWidth: 240,
    availableHeight: 140,
    centerX: 120,
    centerY: 70,
    safeMargin: 16,
    measure
  });
  assert.equal(results[0].autoFitScale, results[1].autoFitScale);
  assert.equal(results[0].fontSize, results[1].fontSize);
  assert.ok(results.every((result) => result.fits));
});

test('a narrow stage prefers useful wrapping over shrinking the whole sentence into one line', () => {
  const result = fitTextLayoutToStage({
    text: '一二三四五六七八九十',
    layout: {
      maxWidth: 680, fontSize: 60, lineHeight: 1.16,
      ballSizeEm: 0.8, ballGapEm: 0.2, scale: 1, autoWrap: true
    },
    availableWidth: 300,
    availableHeight: 300,
    centerX: 150,
    centerY: 150,
    safeMargin: 16,
    measure: (value) => Array.from(value).length * 60
  });
  assert.ok(result.lines.length > 1);
  assert.ok(result.autoFitScale > 0.8);
  assert.equal(result.fits, true);
});

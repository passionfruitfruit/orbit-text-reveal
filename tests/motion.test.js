import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLineMotionFrame } from '../src/motion.js';

const line = {
  x: 240,
  width: 120,
  widths: [40, 40, 40],
  start: { x: 300, y: 100 },
  end: { x: 390, y: 100 },
  contentStartX: 280
};

test('reveal begins centered and moves ball right while text moves left', () => {
  const start = computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 0, minScale: 0.08 });
  const middle = computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 0.5, minScale: 0.08 });
  const end = computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 1, minScale: 0.08 });

  assert.equal(start.ball.x, 300);
  assert.equal(start.contentX + line.widths[0] / 2, 300);
  assert.ok(middle.ball.x > start.ball.x);
  assert.ok(middle.contentX < start.contentX);
  assert.equal(end.ball.x, 390);
  assert.equal(end.contentX, line.x);
});

test('boundary character grows from tiny to normal and reverse frames are identical', () => {
  const start = computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 0, minScale: 0.08 });
  const partial = computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 0.25, minScale: 0.08 });
  const end = computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 1, minScale: 0.08 });
  assert.equal(start.glyphScales[0], 0.08);
  assert.ok(start.glyphScales.every((scale) => scale <= 1));
  assert.ok(partial.glyphScales.some((scale) => scale > 0.08 && scale < 1));
  assert.ok(partial.glyphScales.every((scale) => scale >= 0.08 && scale <= 1));
  assert.deepEqual(end.glyphScales, [1, 1, 1]);
  assert.equal(start.clipRight, start.ball.x + 20);
  assert.equal(partial.clipRight, partial.ball.x + 20);
  assert.equal(end.clipRight, end.ball.x + 20);
  assert.deepEqual(
    computeLineMotionFrame({ line, stageWidth: 600, ballSize: 40, progress: 0.25, minScale: 0.08 }),
    partial
  );
});

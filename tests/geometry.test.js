import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetractRoute, buildRevealRoute, computeGeometry } from '../src/geometry.js';

const lines = (widths) => widths.map((width, index) => ({
  text: `line-${index}`,
  graphemes: ['x'],
  width
}));

test('expanded outer edges are symmetric around center', () => {
  const geometry = computeGeometry({
    lines: lines([240]), centerX: 400, centerY: 300,
    lineHeightPx: 72, ballSize: 48, ballGap: 6
  });
  const leftDistance = geometry.center.x - geometry.blockLeft;
  const rightDistance = geometry.ballEnd.x + geometry.ballSize / 2 - geometry.center.x;
  assert.equal(leftDistance, rightDistance);
});

test('multiline reveal visits each start then end in order', () => {
  const geometry = computeGeometry({
    lines: lines([180, 120, 220]), centerX: 400, centerY: 300,
    lineHeightPx: 60, ballSize: 42, ballGap: 5
  });
  assert.deepEqual(buildRevealRoute(geometry).map(({ kind, lineIndex }) => [kind, lineIndex]), [
    ['center', null], ['line-start', 0], ['line-end', 0],
    ['line-start', 1], ['line-end', 1],
    ['line-start', 2], ['line-end', 2]
  ]);
});

test('retract route is the exact positional reverse and ends at center', () => {
  const geometry = computeGeometry({
    lines: lines([180, 120]), centerX: 400, centerY: 300,
    lineHeightPx: 60, ballSize: 42, ballGap: 5
  });
  const reveal = buildRevealRoute(geometry);
  const retract = buildRetractRoute(reveal);
  assert.deepEqual(retract.map(({ x, y }) => [x, y]), reveal.toReversed().map(({ x, y }) => [x, y]));
  assert.deepEqual(retract.at(-1), { kind: 'center', lineIndex: null, x: 400, y: 300 });
});

test('single-line route has no cross-line travel', () => {
  const geometry = computeGeometry({
    lines: lines([220]), centerX: 0, centerY: 0,
    lineHeightPx: 60, ballSize: 40, ballGap: 4
  });
  assert.equal(buildRevealRoute(geometry).length, 3);
});

test('unequal lines center each line composition independently', () => {
  const geometry = computeGeometry({
    lines: lines([160, 10]), centerX: 180, centerY: 120,
    lineHeightPx: 60, ballSize: 48, ballGap: 6
  });
  assert.notEqual(geometry.lines[0].x, geometry.lines[1].x);
  assert.equal(geometry.blockLeft, 180 - (160 + 6 + 48) / 2);
  for (const line of geometry.lines) {
    const leftDistance = geometry.center.x - line.x;
    const rightDistance = line.end.x + geometry.ballSize / 2 - geometry.center.x;
    assert.equal(leftDistance, rightDistance);
  }
});

test('every line starts with the ball at horizontal center and never routes left of it', () => {
  const geometry = computeGeometry({
    lines: lines([160, 90]), centerX: 180, centerY: 120,
    lineHeightPx: 60, ballSize: 48, ballGap: 6
  });
  assert.deepEqual(geometry.lines.map((line) => line.start.x), [180, 180]);
  assert.ok(buildRevealRoute(geometry).every((point) => point.x >= geometry.center.x));
  assert.ok(buildRetractRoute(buildRevealRoute(geometry)).every((point) => point.x >= geometry.center.x));
});

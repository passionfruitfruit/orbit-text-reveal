import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCubicBezierEndpointSlope,
  computeTraversalTiming,
  computeVisibleLineLayout
} from '../src/progressive-layout.js';

test('one visible line begins at configured center', () => {
  assert.deepEqual(
    computeVisibleLineLayout({ visibleCount: 1, centerY: 300, lineHeightPx: 60 }),
    [{ index: 0, top: 270, centerY: 300 }]
  );
});

test('adding and removing rows keeps every visible block centered', () => {
  const one = computeVisibleLineLayout({ visibleCount: 1, centerY: 300, lineHeightPx: 60 });
  const two = computeVisibleLineLayout({ visibleCount: 2, centerY: 300, lineHeightPx: 60 });
  const three = computeVisibleLineLayout({ visibleCount: 3, centerY: 300, lineHeightPx: 60 });

  assert.deepEqual(two.map(({ centerY }) => centerY), [270, 330]);
  assert.deepEqual(three.map(({ centerY }) => centerY), [240, 300, 360]);
  assert.equal(two[0].centerY - one[0].centerY, -30);
  assert.equal(three[0].centerY - two[0].centerY, -30);
  assert.equal(two[0].centerY - three[0].centerY, 30);
});

test('first traversal uses slow-start timing and continuation preserves distance speed', () => {
  const common = {
    baselineDistance: 100,
    baselineDuration: 900,
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    continuationEasing: 'linear'
  };
  assert.deepEqual(computeTraversalTiming({
    ...common,
    distance: 100,
    first: true
  }), {
    duration: 900,
    easing: common.easing
  });
  assert.deepEqual(computeTraversalTiming({
    ...common,
    distance: 50,
    first: false
  }), {
    duration: 450,
    easing: 'linear'
  });
});

test('entry easing ends at the same normalized speed as linear continuation', () => {
  assert.equal(computeCubicBezierEndpointSlope({ x2: 0.8, y2: 0.8 }), 1);
  assert.equal(computeCubicBezierEndpointSlope({ x2: 0.35, y2: 1 }), 0);
});

test('zero baseline or duration remains finite and immediate', () => {
  assert.deepEqual(computeTraversalTiming({
    distance: 50,
    baselineDistance: 0,
    baselineDuration: 900,
    first: false,
    easing: 'ease',
    continuationEasing: 'linear'
  }), { duration: 0, easing: 'linear' });
  assert.deepEqual(computeTraversalTiming({
    distance: 50,
    baselineDistance: 100,
    baselineDuration: 0,
    first: true,
    easing: 'ease',
    continuationEasing: 'linear'
  }), { duration: 0, easing: 'ease' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPathTimeline,
  computeCubicBezierEndpointSlope,
  computeCubicBezierSlopeAt,
  computeCubicBezierStartSlope,
  computeTraversalTiming,
  computeVisibleLineLayout,
  locatePathProgress,
  traversalRole
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

test('builds cumulative path segments from every row distance', () => {
  const timeline = buildPathTimeline([100, 50, 150]);
  assert.equal(timeline.totalDistance, 300);
  assert.deepEqual(timeline.segments, [
    { index: 0, distance: 100, start: 0, end: 1 / 3 },
    { index: 1, distance: 50, start: 1 / 3, end: 1 / 2 },
    { index: 2, distance: 150, start: 1 / 2, end: 1 }
  ]);
  const located = locatePathProgress(timeline, 0.4);
  assert.equal(located.index, 1);
  assert.ok(Math.abs(located.localProgress - 0.4) < 1e-9);
  assert.deepEqual(locatePathProgress(timeline, 1), {
    index: 2,
    localProgress: 1
  });
});

test('cumulative path stays finite for zero and invalid distances', () => {
  const timeline = buildPathTimeline([0, Number.NaN, -20, 100]);
  assert.deepEqual(timeline.segments, [
    { index: 0, distance: 0, start: 0, end: 0 },
    { index: 1, distance: 0, start: 0, end: 0 },
    { index: 2, distance: 0, start: 0, end: 0 },
    { index: 3, distance: 100, start: 0, end: 1 }
  ]);
  assert.deepEqual(locatePathProgress(timeline, 0), {
    index: 3,
    localProgress: 0
  });
  assert.equal(locatePathProgress(buildPathTimeline([0, 0]), 0.5), null);
});

test('single row owns the complete cumulative path', () => {
  const timeline = buildPathTimeline([80]);
  assert.deepEqual(timeline.segments, [
    { index: 0, distance: 80, start: 0, end: 1 }
  ]);
  assert.deepEqual(locatePathProgress(timeline, -1), { index: 0, localProgress: 0 });
  assert.deepEqual(locatePathProgress(timeline, 2), { index: 0, localProgress: 1 });
});

test('assigns entry cruise exit and single roles by traversal position', () => {
  assert.equal(traversalRole({ position: 0, count: 3 }), 'entry');
  assert.equal(traversalRole({ position: 1, count: 3 }), 'cruise');
  assert.equal(traversalRole({ position: 2, count: 3 }), 'exit');
  assert.equal(traversalRole({ position: 0, count: 1 }), 'single');
});

test('all roles derive duration from one shared cruise speed', () => {
  const common = {
    distance: 50,
    referenceDistance: 200,
    referenceDuration: 1000,
    easing: 'entry',
    continuationEasing: 'linear',
    exitEasing: 'exit',
    singleLineEasing: 'single'
  };
  assert.deepEqual(computeTraversalTiming({ ...common, role: 'entry' }), {
    duration: 375, easing: 'entry', role: 'entry'
  });
  assert.deepEqual(computeTraversalTiming({ ...common, role: 'cruise' }), {
    duration: 250, easing: 'linear', role: 'cruise'
  });
  assert.deepEqual(computeTraversalTiming({ ...common, role: 'exit' }), {
    duration: 375, easing: 'exit', role: 'exit'
  });
  assert.deepEqual(computeTraversalTiming({ ...common, role: 'single' }), {
    duration: 375, easing: 'single', role: 'single'
  });
});

test('short first retract row reaches the same speed as later cruise rows', () => {
  const entry = computeTraversalTiming({
    distance: 20,
    referenceDistance: 200,
    referenceDuration: 1000,
    role: 'entry',
    easing: 'entry',
    continuationEasing: 'linear',
    exitEasing: 'exit',
    singleLineEasing: 'single'
  });
  const cruise = computeTraversalTiming({
    distance: 100,
    referenceDistance: 200,
    referenceDuration: 1000,
    role: 'cruise',
    easing: 'entry',
    continuationEasing: 'linear',
    exitEasing: 'exit',
    singleLineEasing: 'single'
  });
  assert.equal((20 / entry.duration) * 1.5, 0.2);
  assert.equal(100 / cruise.duration, 0.2);
});

test('default easing boundaries meet the 1.5 cruise factor', () => {
  assert.ok(Math.abs(computeCubicBezierEndpointSlope({ x2: 0.666667, y2: 0.5 }) - 1.5) < 0.00001);
  assert.ok(Math.abs(computeCubicBezierStartSlope({ x1: 0.333333, y1: 0.5 }) - 1.5) < 0.00001);
  assert.ok(Math.abs(computeCubicBezierSlopeAt({
    x1: 0.333333, y1: 0, x2: 0.666667, y2: 1, t: 0.5
  }) - 1.5) < 0.00001);
});

test('zero baseline or duration remains finite and immediate', () => {
  assert.deepEqual(computeTraversalTiming({
    distance: 50,
    referenceDistance: 0,
    referenceDuration: 900,
    role: 'cruise',
    easing: 'ease',
    continuationEasing: 'linear',
    exitEasing: 'exit',
    singleLineEasing: 'single'
  }), { duration: 0, easing: 'linear', role: 'cruise' });
  assert.deepEqual(computeTraversalTiming({
    distance: 50,
    referenceDistance: 100,
    referenceDuration: 0,
    role: 'entry',
    easing: 'ease',
    continuationEasing: 'linear',
    exitEasing: 'exit',
    singleLineEasing: 'single'
  }), { duration: 0, easing: 'ease', role: 'entry' });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { computeResponsiveStageWidth } from '../src/responsive-layout.js';

test('responsive stage reaches the approved 3/4/3 and 1/7/1 endpoints', () => {
  assert.equal(computeResponsiveStageWidth(1920, 800), 1920 * 0.4);
  assert.equal(computeResponsiveStageWidth(320, 844), 320 * (7 / 9));
});

test('responsive stage changes continuously between desktop and mobile', () => {
  const wide = computeResponsiveStageWidth(1200, 800) / 1200;
  const middle = computeResponsiveStageWidth(768, 768) / 768;
  const narrow = computeResponsiveStageWidth(430, 932) / 430;

  assert.ok(wide >= 0.4 && wide < middle);
  assert.ok(middle < narrow && narrow <= 7 / 9);
  assert.ok(Math.abs(narrow - 7 / 9) < 0.01);
});

test('responsive stage returns finite safe widths for invalid dimensions', () => {
  assert.equal(computeResponsiveStageWidth(0, 800), 0);
  assert.equal(computeResponsiveStageWidth(390, Number.NaN), 390 * 0.4);
});

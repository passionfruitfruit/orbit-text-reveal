import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/orbit-text-reveal.js', import.meta.url), 'utf8');

test('DOM glyph widths come from the fitted line model and disable cross-span shaping', () => {
  assert.match(source, /line\.widths\[index\]/);
  assert.match(source, /font-kerning:\s*none/);
  assert.match(source, /font-variant-ligatures:\s*none/);
});

test('active config and resize changes queue until a safe cycle boundary', () => {
  assert.match(source, /#pendingConfig/);
  assert.match(source, /#pendingReflow/);
  assert.match(source, /#applyPendingBoundaryUpdate/);
  assert.match(source, /updateConfig\(value,\s*\{\s*immediate\s*=\s*false/);
});

test('visibility pause is distinct from user pause and is lifecycle-cleaned', () => {
  assert.match(source, /visibilitychange/);
  assert.match(source, /#userPaused/);
  assert.match(source, /#visibilityPaused/);
  assert.match(source, /removeEventListener\('visibilitychange'/);
});

test('reveal and retract use shared-speed traversal roles while line jumps stay instantaneous', () => {
  assert.match(source, /computeTraversalTiming/);
  assert.match(source, /traversalRole/);
  assert.match(source, /#referenceDistance\(\)/);
  assert.match(source, /referenceDistance/);
  assert.match(source, /continuationEasing:\s*this\.#config\.motion\.continuationEasing/);
  assert.match(source, /exitEasing:\s*this\.#config\.motion\.exitEasing/);
  assert.match(source, /singleLineEasing:\s*this\.#config\.motion\.singleLineEasing/);
  assert.doesNotMatch(source, /baselineDistance/);
  assert.match(source, /#setState\('line-jump'\)/);
  assert.doesNotMatch(source, /#animateBall\(view\.geometry\.end/);
});

test('multiline orchestration progressively centers currently visible rows', () => {
  assert.match(source, /computeVisibleLineLayout/);
  assert.match(source, /#positionVisibleLines\(visibleCount\)/);
  assert.match(source, /#positionVisibleLines\(index \+ 1\)/);
  assert.match(source, /#positionVisibleLines\(index\)/);
  assert.match(source, /view\.mask\.hidden\s*=\s*index\s*>=\s*visibleCount/);
});

test('shared component merges the current item layout over global layout', () => {
  assert.match(source, /\{\s*\.\.\.this\.#config\.layout,\s*\.\.\.item\?\.layout\s*\}/);
});

test('documented external CSS variables override config-derived visual defaults', () => {
  for (const variable of [
    '--orbit-font-family', '--orbit-font-size', '--orbit-font-weight',
    '--orbit-text-color', '--orbit-ball-color', '--orbit-ball-size',
    '--orbit-ball-gap', '--orbit-background'
  ]) {
    assert.ok(source.includes(variable), `missing CSS override: ${variable}`);
  }
  assert.match(source, /getComputedStyle\(this\)/);
});

test('resolved external ball color is used by the normal text render path', () => {
  assert.match(source, /ball\.style\.background\s*=\s*style\.ballColor/);
  assert.doesNotMatch(source, /ball\.style\.background\s*=\s*this\.#config\.style\.ballColor/);
});

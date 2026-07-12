import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser runner names every final handoff invariant', async () => {
  const source = await readFile(new URL('./browser-tests.js', import.meta.url), 'utf8');
  const requiredEvidence = [
    'single-line item renders exactly one line',
    'three-line item renders exactly three lines',
    'future multiline rows stay hidden until introduced',
    'three-line state sequence is exact forward snake plus reverse',
    'every unrevealed line rests behind an inset clip',
    'ball size derives from configured font size',
    'next advances index exactly once',
    'restart aborts the old run without duplicate events',
    'empty config leaves only the centered ball',
    'reduced motion produces static text',
    'mid-reveal config remains queued while active',
    'mid-retract resize does not restart the active cycle',
    'visibility hidden auto-pauses active timing',
    'hide-show preserves an existing user pause',
    'AV To fi DOM glyph widths equal geometry and mask width',
    'narrow short stage fits text block and ball endpoints on both axes',
    'reveal and retract use motion.easing',
    'cross-line movement is an instantaneous jump without travel animation',
    'first multiline row starts at configured center',
    'final multiline block is vertically centered',
    'short final row is independently centered',
    'continuation row uses continuation easing',
    'continuation duration preserves horizontal speed',
    'final reveal row uses exit easing',
    'reveal boundaries share one cruise speed',
    'final retract row uses exit easing',
    'retract boundaries share one cruise speed',
    'single-line traversal uses single-line easing',
    'per-text layout override did not reach shared preview',
    'developer full-loop control restarts from first item'
  ];

  for (const evidence of requiredEvidence) {
    assert.ok(source.includes(evidence), `missing browser evidence: ${evidence}`);
  }
});

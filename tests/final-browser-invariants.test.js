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
    'reveal and retract use the global timeline easing',
    'cross-line movement is an instantaneous jump without travel animation',
    'reveal row boundaries follow cumulative pixel distance on one clock',
    'retract row boundaries follow cumulative pixel distance on one clock',
    'first multiline row starts at configured center',
    'final multiline block is vertically centered',
    'short final row is independently centered',
    'multiline reveal uses exactly one global clock',
    'global reveal clock uses whole-pass easing',
    'global reveal clock uses the complete configured duration',
    'multiline retract uses exactly one global clock',
    'global retract clock uses whole-pass easing',
    'global retract clock uses the complete configured duration',
    'single-line traversal uses single-line easing',
    'per-text layout override did not reach shared preview',
    'developer full-loop control restarts from first item'
  ];

  const fluidEvidence = [
    'stage width at ',
    'horizontal center',
    'vertical center',
    'no horizontal overflow',
    'ten characters form one line at 320px',
    'ten-character line preserves every grapheme at 320px',
    'ten characters fit 16px margin at 320px',
    'font size 19px at 320px'
  ];
  const allEvidence = [...requiredEvidence, ...fluidEvidence];

  for (const evidence of allEvidence) {
    assert.ok(source.includes(evidence), `missing browser evidence: ${evidence}`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLineModel, segmentGraphemes, wrapText } from '../src/text-layout.js';

const monospace = (value) => segmentGraphemes(value).length * 10;

test('a short item remains one line independently', () => {
  assert.deepEqual(wrapText('不需要换行', 100, monospace), ['不需要换行']);
});

test('manual newlines are authoritative', () => {
  assert.deepEqual(wrapText('指定在这里\n换行', 200, monospace), ['指定在这里', '换行']);
});

test('overwide manual lines receive additional automatic wrapping', () => {
  assert.deepEqual(wrapText('一二三四五六\n短行', 40, monospace), ['一二三四', '五六', '短行']);
});

test('automatic wrapping can be disabled so only explicit newlines split lines', () => {
  assert.deepEqual(wrapText('一二三四五六\n短行', 40, monospace, { autoWrap: false }), ['一二三四五六', '短行']);
  assert.equal(buildLineModel('一二三四五六', 40, monospace, { autoWrap: false })[0].width, 60);
});

test('english wraps at whitespace before splitting a long word', () => {
  assert.deepEqual(wrapText('make ideas visible', 100, monospace), ['make ideas', 'visible']);
  assert.deepEqual(wrapText('extraordinary', 40, monospace), ['extr', 'aord', 'inar', 'y']);
});

test('english wrapping keeps a fitting hyphen on the preceding line', () => {
  assert.deepEqual(wrapText('well-known value', 50, monospace), ['well-', 'known', 'value']);
});

test('emoji grapheme clusters stay intact', () => {
  assert.deepEqual(segmentGraphemes('A👨‍👩‍👧‍👦B'), ['A', '👨‍👩‍👧‍👦', 'B']);
});

test('line models expose graphemes and measured width', () => {
  assert.deepEqual(buildLineModel('甲乙\n丙', 100, monospace), [
    { text: '甲乙', graphemes: ['甲', '乙'], widths: [10, 10], width: 20 },
    { text: '丙', graphemes: ['丙'], widths: [10], width: 10 }
  ]);
});

test('wrapping and line widths use the same per-glyph advance model as inline-block DOM', () => {
  const kerningMeasure = (value) => ({
    A: 10, V: 10, T: 11, o: 9, f: 8, i: 4,
    AV: 15, To: 16, fi: 7
  })[value] ?? Array.from(value).length * 10;

  assert.deepEqual(buildLineModel('AV To fi', 200, kerningMeasure), [{
    text: 'AV To fi',
    graphemes: ['A', 'V', ' ', 'T', 'o', ' ', 'f', 'i'],
    widths: [10, 10, 10, 11, 9, 10, 8, 4],
    width: 72
  }]);
  assert.deepEqual(wrapText('AVTofi', 25, kerningMeasure), ['AV', 'To', 'fi']);
});

test('custom-font advances remain the sole model even when whole-string shaping differs', () => {
  const customFontMeasure = (value) => {
    if (value === 'AVfi') return 19;
    return { A: 13, V: 12, f: 9, i: 5 }[value] ?? 0;
  };
  const [line] = buildLineModel('AVfi', 100, customFontMeasure);
  assert.deepEqual(line.widths, [13, 12, 9, 5]);
  assert.equal(line.width, 39);
});

test('grapheme segmentation falls back to Array.from without Intl.Segmenter', () => {
  assert.deepEqual(segmentGraphemes('A😀B', null), ['A', '😀', 'B']);
});

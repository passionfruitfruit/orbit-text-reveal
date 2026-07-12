import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8').catch(() => '');

test('standalone config guide is linked and covers every configuration group', async () => {
  const [guide, readme] = await Promise.all([
    readSource('CONFIG_GUIDE.md'),
    readSource('README.md')
  ]);

  assert.ok(guide.length > 0, 'CONFIG_GUIDE.md must exist');
  assert.ok(readme.includes('[配置完整教程](./CONFIG_GUIDE.md)'), 'README must link the guide');

  for (const heading of [
    '快速开始',
    '理解配置层级',
    'texts：文本队列与单条覆盖',
    'timing：整段时间轴',
    'layout：尺寸、换行与位置',
    'style：颜色与字体',
    'motion：缓动与字符形变',
    'accessibility：减少动态效果',
    '完整配置示例',
    '常用配方',
    '常见问题与排错'
  ]) {
    assert.ok(guide.includes(heading), `missing guide section: ${heading}`);
  }
});

test('config guide names every normalized field and exact numeric range', async () => {
  const guide = await readSource('CONFIG_GUIDE.md');
  const fields = [
    'texts', 'text', 'holdMs', 'revealMs', 'retractMs',
    'maxWidth', 'fontSize', 'lineHeight', 'ballSizeEm', 'ballGapEm',
    'x', 'y', 'scale', 'autoWrap',
    'textColor', 'ballColor', 'background', 'fontFamily', 'fontWeight',
    'easing', 'lineEasing', 'continuationEasing', 'exitEasing',
    'singleLineEasing', 'characterScale', 'characterMinScale',
    'enableCharacterScale', 'reducedMotionRotate', 'lineTravelMs', 'centerHoldMs'
  ];
  for (const field of fields) {
    assert.ok(guide.includes(`\`${field}\``), `missing documented field: ${field}`);
  }

  for (const range of [
    '0–20000', '120–2400', '12–240', '0.8–2', '0.2–2',
    '0.25–4', '100–900', '0.7–1.5', '0.01–1'
  ]) {
    assert.ok(guide.includes(range), `missing normalization range: ${range}`);
  }
});

test('config guide separates active timeline control from compatibility fields', async () => {
  const guide = await readSource('CONFIG_GUIDE.md');
  assert.ok(guide.includes('当前真正生效的整段时间轴缓动'));
  assert.ok(guide.includes('兼容字段（当前不驱动动画）'));
  for (const field of [
    'motion.easing',
    'motion.lineEasing',
    'motion.continuationEasing',
    'motion.exitEasing',
    'timing.lineTravelMs'
  ]) {
    assert.ok(guide.includes(`\`${field}\``), `missing compatibility field: ${field}`);
  }
});

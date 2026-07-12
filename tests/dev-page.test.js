import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('developer CSS makes hidden preview reliably disappear', async () => {
  const css = await readFile(new URL('../src/dev.css', import.meta.url), 'utf8');
  assert.match(css, /orbit-text-reveal\[hidden\][^{]*\{[^}]*display\s*:\s*none\s*!important/i);
});

test('developer CSS defines desktop and below-960 layouts with 44px actions', async () => {
  const css = await readFile(new URL('../src/dev.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns\s*:\s*minmax\(0,\s*1\.15fr\)/);
  assert.match(css, /@media\s*\(max-width:\s*959px\)/);
  assert.match(css, /min-height\s*:\s*44px/);
});

test('developer page exposes all approved preview controls', async () => {
  const html = await readFile(new URL('../dev.html', import.meta.url), 'utf8');
  for (const action of ['play-preview', 'pause-preview', 'replay-current', 'preview-full-loop']) {
    assert.match(html, new RegExp(`data-action=["']${action}["']`));
  }
});

test('developer page exposes one whole-pass timeline control', async () => {
  const html = await readFile(new URL('../dev.html', import.meta.url), 'utf8');
  assert.match(html, /整段展开 \(ms\)/);
  assert.match(html, /整段收回 \(ms\)/);
  assert.match(html, /整段时间轴缓动/);
  assert.match(html, /data-path=["']motion\.singleLineEasing["']/);
  assert.match(html, /旧版逐行缓动字段仅为配置兼容保留/);
  assert.doesNotMatch(html, /data-path=["']motion\.(?:easing|continuationEasing|exitEasing)["']/);
});

test('README documents total-duration global timeline semantics', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /完整多行展开的总时长/);
  assert.match(readme, /换行跳转不占用时间/);
  assert.match(readme, /旧版兼容字段，不再驱动全局时间轴/);
});

test('developer app wires per-text layout editing and immediate preview controls', async () => {
  const source = await readFile(new URL('../src/dev-app.js', import.meta.url), 'utf8');
  assert.match(source, /data-text-layout/);
  assert.match(source, /preview\.updateConfig\([^)]*\{\s*immediate:\s*true\s*\}/s);
  for (const method of ['preview.play()', 'preview.pause()', 'preview.restart()']) {
    assert.ok(source.includes(method), `missing preview integration: ${method}`);
  }
});

test('developer preview controls have a responsive wrapping layout', async () => {
  const css = await readFile(new URL('../src/dev.css', import.meta.url), 'utf8');
  assert.match(css, /\.preview-controls\s*\{[^}]*display\s*:\s*flex[^}]*flex-wrap\s*:\s*wrap/s);
});

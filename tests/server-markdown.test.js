import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSafeMarkdown } from '../server/markdown.ts';

test('safe Markdown renders useful article syntax', () => {
  const html = renderSafeMarkdown('# 标题\n\n这是 **重点** 和 [链接](https://example.com)。\n\n- 一\n- 二');
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /<ul><li>一<\/li><li>二<\/li><\/ul>/);
});

test('safe Markdown escapes raw HTML and drops dangerous URLs', () => {
  const html = renderSafeMarkdown('<img src=x onerror=alert(1)> [危险](javascript:alert(1))');
  assert.doesNotMatch(html, /<img|href="javascript:/i);
  assert.match(html, /&lt;img/);
  assert.match(html, /危险/);
});

test('safe Markdown code spans stay escaped', () => {
  assert.match(renderSafeMarkdown('`<script>alert(1)</script>`'), /<code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code>/);
});

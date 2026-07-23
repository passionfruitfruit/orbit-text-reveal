import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../app/admin/admin-client.tsx', import.meta.url);

test('admin exposes every approved management section', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  for (const id of ['orbit', 'platforms', 'sources', 'contents', 'blogs', 'comments']) {
    assert.ok(source.includes(`'${id}'`), `missing admin section ${id}`);
  }
  for (const label of ['首屏文字', '平台入口', '内容来源', '内容展示', '博客', '留言']) {
    assert.ok(source.includes(label), `missing admin label ${label}`);
  }
});

test('admin wires session, synchronization, moderation, and draft protection', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  for (const endpoint of ['/api/admin/login', '/api/admin/logout', '/api/admin/config', '/api/admin/sources', '/sync-all', '/api/admin/contents', '/api/admin/blogs', '/api/admin/comments']) {
    assert.ok(source.includes(endpoint), `missing endpoint ${endpoint}`);
  }
  for (const action of ['approve', 'unapprove', 'hide', 'restore', 'reply']) assert.ok(source.includes(action));
  assert.match(source, /sessionStorage/);
  assert.match(source, /Markdown/);
});

test('admin page is separate and imports its restrained tool styling', async () => {
  const page = await readFile(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/admin/admin.css', import.meta.url), 'utf8');
  assert.match(page, /AdminClient/);
  assert.match(page, /admin\.css/);
  assert.match(css, /\.admin-nav/);
  assert.match(css, /\.admin-table/);
});

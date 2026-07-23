import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('home preserves every Orbit hook before the new public sections', async () => {
  const source = await read('app/components/home-experience.tsx');
  for (const hook of ['intro-sequence', 'intro-scene', 'orbit-text-reveal', 'platforms', 'platform-grid', 'content-stream', 'comments-section']) {
    assert.ok(source.includes(hook), `home missing ${hook}`);
  }
  assert.ok(source.indexOf('intro-sequence') < source.indexOf('content-stream'));
  assert.match(source, /started\.current\s*=\s*false/);
});

test('React shell loads versioned Orbit assets so responsive fixes bypass stale caches', async () => {
  const layout = await read('app/layout.tsx');
  const home = await read('app/components/home-experience.tsx');
  assert.match(layout, /\/orbit\/src\/base\.css\?v=20260724-1/);
  assert.match(home, /\/orbit\/main\.js\?v=20260724-1/);
});

test('content feed uses one column, ten items, all three content types, and page controls', async () => {
  const source = await read('app/components/content-feed.tsx');
  const css = await read('app/globals.css');
  assert.match(source, /limit=10/);
  for (const type of ['bilibili', 'github', 'blog']) assert.ok(source.includes(type));
  assert.match(source, /上一页/);
  assert.match(source, /下一页/);
  assert.match(css, /\.content-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(css, /\.content-list[^}]*repeat\(2/s);
});

test('blog detail renders only server-produced safe HTML', async () => {
  const source = await read('app/blog/[id]/page.tsx');
  assert.match(source, /renderSafeMarkdown/);
  assert.match(source, /dangerouslySetInnerHTML/);
  assert.match(source, /notFound\(\)/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('comment UI supports required public choice, private contact copy, and capped visual depth', async () => {
  const source = await readFile(new URL('../app/components/comments.tsx', import.meta.url), 'utf8');
  assert.match(source, /visitorAllowsPublic/);
  assert.match(source, /联系方式仅站长可见/);
  assert.match(source, /Math\.min\(depth,\s*3\)/);
  assert.match(source, /回复/);
  assert.match(source, /aria-live/);
});

test('comment CSS uses standard unframed threads without nested cards', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.comment-node/);
  assert.match(css, /--depth/);
  assert.doesNotMatch(css, /\.comment-node\s*\{[^}]*border-radius/s);
});

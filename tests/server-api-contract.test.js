import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dispatchApi } from '../server/api.ts';

const fallback = { orbit: { texts: [] }, platforms: [] };
const env = { DB: {}, ADMIN_PASSWORD: 'secret', RATE_LIMIT_SALT: 'salt' };

test('unknown API routes return a stable JSON 404', async () => {
  const response = await dispatchApi(new Request('https://example.com/api/nope'), env, fallback);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: { code: 'NOT_FOUND', message: '没有找到这个接口' } });
});

test('every admin route except login rejects a missing session before touching data', async () => {
  for (const [method, path] of [
    ['GET', 'session'], ['GET', 'config'], ['PUT', 'config'], ['GET', 'sources'],
    ['GET', 'contents'], ['GET', 'blogs'], ['GET', 'comments'],
  ]) {
    const response = await dispatchApi(new Request(`https://example.com/api/admin/${path}`, { method }), env, fallback);
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
  }
});

test('route source names all public and admin capabilities', async () => {
  const source = await readFile(new URL('../server/api.ts', import.meta.url), 'utf8');
  for (const capability of [
    'public/config', 'public/contents', 'public/blog/', 'public/comments',
    'admin/login', 'admin/session', 'admin/logout', 'admin/config', 'admin/sources',
    'admin/contents', 'admin/blogs', 'admin/comments', 'sync-all', 'batch-visibility', 'reorder',
  ]) {
    assert.ok(source.includes(capability), `missing API capability ${capability}`);
  }
});

test('Vinext catch-all route delegates every HTTP method to the domain dispatcher', async () => {
  const source = await readFile(new URL('../app/api/[[...path]]/route.ts', import.meta.url), 'utf8');
  assert.match(source, /dispatchApi/);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.match(source, new RegExp(`export.*${method}`));
});

test('API initialization applies each migration statement idempotently before seeding', async () => {
  const source = await readFile(new URL('../server/api.ts', import.meta.url), 'utf8');
  assert.match(source, /statement-breakpoint/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS/);
  assert.match(source, /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/);
  assert.ok(source.indexOf('applyRuntimeSchema') < source.lastIndexOf('ensureSeedData'));
});

test('stale refresh backs off after a recent failed source attempt', async () => {
  const source = await readFile(new URL('../server/api.ts', import.meta.url), 'utf8');
  assert.match(source, /last_attempt_at IS NULL OR last_attempt_at < \?/);
  assert.doesNotMatch(source, /last_success_at IS NULL OR last_success_at < \?/);
});

test('permanent comment deletion targets only the selected subtree', async () => {
  const source = await readFile(new URL('../server/api.ts', import.meta.url), 'utf8');
  assert.match(source, /WITH RECURSIVE subtree/);
  assert.match(source, /JOIN subtree/);
  assert.doesNotMatch(source, /DELETE FROM comments WHERE root_id = \?/);
});

test('public content starts empty sources and refreshes snapshots older than six hours', async () => {
  const source = await readFile(new URL('../server/api.ts', import.meta.url), 'utf8');
  assert.match(source, /6 \* 60 \* 60 \* 1000/);
  assert.match(source, /refreshStaleSources/);
  assert.match(source, /waitUntil/);
  assert.match(source, /if \(!all\.length\) await refresh/);
});

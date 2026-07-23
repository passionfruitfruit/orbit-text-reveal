import assert from 'node:assert/strict';
import test from 'node:test';
import {
  digest,
  parseSessionToken,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  verifyAdminPassword,
} from '../server/auth.ts';

test('password verification compares digests and rejects empty configuration', async () => {
  assert.equal(await verifyAdminPassword('correct', 'correct'), true);
  assert.equal(await verifyAdminPassword('wrong', 'correct'), false);
  assert.equal(await verifyAdminPassword('anything', ''), false);
  assert.equal(await digest('same'), await digest('same'));
});

test('session cookie is private and expires after eight hours', () => {
  const cookie = serializeSessionCookie('opaque-token');
  for (const part of ['admin_session=opaque-token', 'Max-Age=28800', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict']) {
    assert.ok(cookie.includes(part), `cookie missing ${part}`);
  }
  assert.equal(parseSessionToken(new Request('https://example.com', { headers: { cookie: 'x=1; admin_session=opaque-token; y=2' } })), 'opaque-token');
});

test('logout cookie immediately expires the current browser token', () => {
  const cookie = serializeExpiredSessionCookie();
  assert.match(cookie, /admin_session=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
});

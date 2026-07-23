import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCommentInput, validateSourceInput } from '../server/validation.ts';

test('root comment requires nickname, body, and an explicit public choice', () => {
  assert.deepEqual(validateCommentInput({ nickname: ' Luke ', body: ' hello ', contact: ' mail ', visitorAllowsPublic: false }, false), {
    ok: true,
    value: { nickname: 'Luke', body: 'hello', contact: 'mail', visitorAllowsPublic: false },
  });
  assert.equal(validateCommentInput({ nickname: 'x', body: 'y' }, false).error.code, 'PUBLIC_CHOICE_REQUIRED');
});

test('reply inherits visibility and enforces all length limits', () => {
  assert.deepEqual(validateCommentInput({ nickname: 'A', body: 'B', contact: '' }, true), {
    ok: true,
    value: { nickname: 'A', body: 'B', contact: null },
  });
  assert.equal(validateCommentInput({ nickname: 'x'.repeat(31), body: 'ok' }, true).error.code, 'NICKNAME_TOO_LONG');
  assert.equal(validateCommentInput({ nickname: 'x', body: 'y'.repeat(2001) }, true).error.code, 'BODY_TOO_LONG');
  assert.equal(validateCommentInput({ nickname: 'x', body: 'y', contact: 'z'.repeat(201) }, true).error.code, 'CONTACT_TOO_LONG');
});

test('source validation accepts only approved platforms and account shapes', () => {
  assert.deepEqual(validateSourceInput({ platform: 'github', account: ' passionfruitfruit ' }), {
    ok: true,
    value: { platform: 'github', account: 'passionfruitfruit', enabled: true },
  });
  assert.equal(validateSourceInput({ platform: 'weibo', account: 'x' }).error.code, 'INVALID_PLATFORM');
  assert.equal(validateSourceInput({ platform: 'bilibili', account: 'not-a-uid' }).error.code, 'INVALID_ACCOUNT');
});

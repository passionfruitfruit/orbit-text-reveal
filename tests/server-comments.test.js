import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVisibleThread, toPublicComment } from '../server/comments.ts';

const row = (overrides = {}) => ({
  id: 'root', parentId: null, rootId: 'root', nickname: '访客', body: '你好', contact: 'secret',
  visitorAllowsPublic: true, approved: true, authorRole: 'visitor', deletedAt: null,
  createdAt: Date.UTC(2026, 6, 19, 12), ...overrides,
});

test('public DTO excludes contact and precise time', () => {
  const dto = toPublicComment(row());
  assert.equal('contact' in dto, false);
  assert.equal('createdAt' in dto, false);
  assert.equal(dto.date, '2026-07-19');
});

test('root needs visitor permission and approval', () => {
  assert.deepEqual(buildVisibleThread([row({ visitorAllowsPublic: false })]), []);
  assert.deepEqual(buildVisibleThread([row({ approved: false })]), []);
  assert.equal(buildVisibleThread([row()]).length, 1);
});

test('an approved child cannot cross a hidden or unapproved ancestor', () => {
  const root = row();
  const parent = row({ id: 'parent', parentId: 'root', rootId: 'root', approved: false });
  const child = row({ id: 'child', parentId: 'parent', rootId: 'root', approved: true });
  const visible = buildVisibleThread([child, parent, root]);
  assert.equal(visible.length, 1);
  assert.deepEqual(visible[0].replies, []);
});

test('arbitrary approved nesting is retained in chronological sibling order', () => {
  const root = row();
  const later = row({ id: 'later', parentId: 'root', rootId: 'root', createdAt: 20 });
  const earlier = row({ id: 'earlier', parentId: 'root', rootId: 'root', createdAt: 10 });
  const deep = row({ id: 'deep', parentId: 'earlier', rootId: 'root', createdAt: 30 });
  const visible = buildVisibleThread([later, deep, root, earlier]);
  assert.deepEqual(visible[0].replies.map(({ id }) => id), ['earlier', 'later']);
  assert.equal(visible[0].replies[0].replies[0].id, 'deep');
});

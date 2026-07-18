 import assert from 'node:assert/strict';
 import test from 'node:test';
 import {
   createPlatformEntry,
   duplicatePlatform,
   movePlatform,
   normalizePlatformConfig,
   removePlatform,
   serializePlatformConfig
 } from '../src/platform-config.js';

 test('normalizes link and copy entries without sharing nested action objects', () => {
   const source = [{
     id: 'mail', title: '邮箱', description: '联系我', icon: './mail.svg',
     iconSide: 'right', action: { type: 'copy', value: 'mail@example.com' }
   }];
   const result = normalizePlatformConfig(source);
   assert.deepEqual(result[0], {
     id: 'mail', title: '邮箱', description: '联系我', icon: './mail.svg',
     iconSide: 'right', action: { type: 'copy', value: 'mail@example.com', newTab: false }
   });
   assert.notStrictEqual(result[0].action, source[0].action);
 });

 test('drops invalid entries and creates unique duplicated ids', () => {
   const valid = createPlatformEntry({ id: 'qq', title: 'QQ' });
   assert.equal(normalizePlatformConfig([{}, valid]).length, 1);
   const duplicated = duplicatePlatform([valid], 0);
   assert.equal(duplicated.length, 2);
   assert.notEqual(duplicated[0].id, duplicated[1].id);
 });

test('move remove and serialization preserve immutable ordering', () => {
  const entries = [createPlatformEntry({ id: 'a', title: 'A' }), createPlatformEntry({ id: 'b', title: 'B' })];
   assert.deepEqual(movePlatform(entries, 0, 1).map((item) => item.id), ['b', 'a']);
   assert.deepEqual(removePlatform(entries, 0).map((item) => item.id), ['b']);
   assert.match(serializePlatformConfig(entries), /"action"/);
  assert.deepEqual(entries.map((item) => item.id), ['a', 'b']);
});

test('serializePlatformConfig preserves ids, icon sides, and nested actions', () => {
  const entries = normalizePlatformConfig([
    {
      id: 'mail', title: '邮箱', description: '联系我', icon: './mail.svg', iconSide: 'right',
      action: { type: 'link', value: 'https://example.com', newTab: true }
    },
    {
      id: 'copy', title: '复制', description: '复制地址', icon: './copy.svg', iconSide: 'left',
      action: { type: 'copy', value: 'copy@example.com' }
    }
  ]);

  assert.equal(serializePlatformConfig(entries), `${JSON.stringify(entries, null, 2)}\n`);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneDraft,
  deleteText,
  duplicateText,
  importDraft,
  moveText,
  serializeDraft
} from '../src/dev-app.js';
import { animationConfig } from '../config.js';

test('cloneDraft deeply isolates the editor from animationConfig', () => {
  const draft = cloneDraft(animationConfig);
  draft.texts[0].text = 'changed';
  draft.layout.x = '20%';
  assert.notEqual(animationConfig.texts[0].text, 'changed');
  assert.notEqual(animationConfig.layout.x, '20%');
});

test('deleting the final text leaves an empty validation card', () => {
  const source = { ...cloneDraft(animationConfig), texts: [{ text: 'Only', holdMs: 100 }] };
  const result = deleteText(source, 0);
  assert.equal(result.texts.length, 1);
  assert.equal(result.texts[0].text, '');
  assert.equal(source.texts[0].text, 'Only');
});

test('duplicate and move operations return isolated ordered arrays', () => {
  const source = { ...cloneDraft(animationConfig), texts: [{ text: 'A' }, { text: 'B' }] };
  const duplicated = duplicateText(source, 0);
  duplicated.texts[1].text = 'A copy';
  assert.deepEqual(source.texts.map(({ text }) => text), ['A', 'B']);
  assert.deepEqual(moveText(duplicated, 1, 1).texts.map(({ text }) => text), ['A', 'B', 'A copy']);
});

test('invalid JSON import preserves the current draft', () => {
  const current = cloneDraft(animationConfig);
  const result = importDraft('{bad json', current);
  assert.equal(result.ok, false);
  assert.equal(result.draft, current);
});

test('an imported empty queue becomes one empty validation card', () => {
  const current = cloneDraft(animationConfig);
  const result = importDraft('{"texts":[]}', current);
  assert.equal(result.ok, true);
  assert.equal(result.draft.texts.length, 1);
  assert.equal(result.draft.texts[0].text, '');
});

test('serialized draft is normalized and formatted JSON', () => {
  const draft = cloneDraft(animationConfig);
  draft.texts.push({ text: '   ', holdMs: 20 });
  const serialized = serializeDraft(draft);
  assert.equal(JSON.parse(serialized).texts.length, animationConfig.texts.length);
  assert.match(serialized, /\n  "texts":/);
});

test('per-text layout overrides survive normalized export and import', () => {
  const draft = cloneDraft(animationConfig);
  draft.texts[0].layout = { fontSize: 36, x: '25%', scale: 1.4 };
  const serialized = serializeDraft(draft);
  assert.deepEqual(JSON.parse(serialized).texts[0].layout, {
    fontSize: 36,
    x: '25%',
    scale: 1.4
  });
  const imported = importDraft(serialized, cloneDraft(animationConfig));
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.draft.texts[0].layout, {
    fontSize: 36,
    x: '25%',
    scale: 1.4
  });
});

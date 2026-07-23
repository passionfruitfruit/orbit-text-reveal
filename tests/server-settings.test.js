import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BILIBILI_ITEMS,
  DEFAULT_SOURCES,
  createFallbackSettings,
  ensureSeedData,
  parseStoredSettings,
} from '../server/settings.ts';

test('default sources contain the approved Bilibili and GitHub accounts', () => {
  assert.deepEqual(DEFAULT_SOURCES, [
    { platform: 'bilibili', account: '496633495' },
    { platform: 'github', account: 'passionfruitfruit' },
  ]);
});

test('default Bilibili fallback contains verified recent submissions', () => {
  assert.deepEqual(
    DEFAULT_BILIBILI_ITEMS.map(({ externalId }) => externalId),
    ['BV1Sc7s68E3h', 'BV14ALH6yE3s', 'BV1RLxLzmE9F'],
  );
  assert.ok(DEFAULT_BILIBILI_ITEMS.every((item) => (
    item.title && item.imageUrl.startsWith('https://') && item.publishedAt > 0
  )));
});

test('seed initialization inserts sources before Bilibili fallback items', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return { sql, values };
        },
      };
    },
    async batch(batch) {
      statements.push(...batch);
    },
  };

  await ensureSeedData(db, 1234);

  assert.equal(statements.length, DEFAULT_SOURCES.length + DEFAULT_BILIBILI_ITEMS.length);
  assert.ok(statements.slice(0, DEFAULT_SOURCES.length).every(({ sql }) => sql.includes('source_accounts')));
  assert.ok(statements.slice(DEFAULT_SOURCES.length).every(({ sql }) => sql.includes('content_items')));
  assert.ok(statements.slice(DEFAULT_SOURCES.length).every(({ sql }) => sql.includes('ON CONFLICT(platform, external_id) DO NOTHING')));
});

test('fallback settings clone Orbit and platform values', () => {
  const orbit = { texts: [{ text: 'hello:)' }] };
  const platforms = [{ id: 'mail', action: { type: 'copy', value: 'x@y.cn' } }];
  const result = createFallbackSettings(orbit, platforms);
  result.orbit.texts[0].text = 'changed';
  result.platforms[0].action.value = 'changed';
  assert.equal(orbit.texts[0].text, 'hello:)');
  assert.equal(platforms[0].action.value, 'x@y.cn');
});

test('stored settings fall back independently when JSON is absent or invalid', () => {
  const fallback = { orbit: { texts: [] }, platforms: [{ id: 'mail' }] };
  assert.deepEqual(parseStoredSettings(null, '{bad', fallback), fallback);
  assert.deepEqual(
    parseStoredSettings('{"texts":[{"text":"hi"}]}', null, fallback),
    { orbit: { texts: [{ text: 'hi' }] }, platforms: fallback.platforms },
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSourceRequest,
  mergeSnapshot,
  normalizeBilibiliPayload,
  normalizeGitHubPayload,
} from '../server/sync.ts';

test('GitHub repositories normalize into mixed content rows', () => {
  const rows = normalizeGitHubPayload([{ id: 7, name: 'project', description: null, html_url: 'https://github.com/a/project', language: 'TypeScript', stargazers_count: 9, updated_at: '2026-07-19T00:00:00Z', created_at: '2026-07-01T00:00:00Z', fork: false, archived: false }]);
  assert.deepEqual(rows[0], {
    externalId: '7', title: 'project', summary: '', url: 'https://github.com/a/project', imageUrl: null,
    publishedAt: Date.parse('2026-07-01T00:00:00Z'), externalUpdatedAt: Date.parse('2026-07-19T00:00:00Z'),
    stats: { language: 'TypeScript', stars: 9 },
  });
});

test('Bilibili videos normalize titles, covers, links, times, and stats', () => {
  const rows = normalizeBilibiliPayload({ data: { list: { vlist: [{ bvid: 'BV1xx', title: '视频', description: '简介', pic: '//i.example/cover.jpg', created: 100, length: '01:20', play: 33, comment: 4 }] } } });
  assert.deepEqual(rows[0], {
    externalId: 'BV1xx', title: '视频', summary: '简介', url: 'https://www.bilibili.com/video/BV1xx',
    imageUrl: 'https://i.example/cover.jpg', publishedAt: 100000, externalUpdatedAt: null,
    stats: { plays: 33, comments: 4, duration: '01:20' },
  });
});

test('synchronization preserves manual visibility and order', () => {
  assert.deepEqual(mergeSnapshot({ visible: false, sortOrder: 4 }, { title: 'new' }), {
    title: 'new', visible: false, sortOrder: 4, sourceMissing: false,
  });
  assert.deepEqual(mergeSnapshot(null, { title: 'first' }), {
    title: 'first', visible: true, sortOrder: 0, sourceMissing: false,
  });
});

test('source requests are platform-specific and GitHub token stays in headers', async () => {
  const github = await buildSourceRequest({ platform: 'github', account: 'passionfruitfruit' }, { githubToken: 'secret' });
  assert.match(github.url, /api\.github\.com\/users\/passionfruitfruit\/repos/);
  assert.equal(github.init.headers.Authorization, 'Bearer secret');
  assert.doesNotMatch(github.url, /secret/);
  const bili = await buildSourceRequest(
    { platform: 'bilibili', account: '496633495' },
    {},
    async () => Response.json({ data: { wbi_img: {
      img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
      sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
    } } }),
    1702204169,
  );
  assert.match(bili.url, /mid=496633495/);
  assert.match(bili.url, /w_rid=[a-f0-9]{32}/);
});

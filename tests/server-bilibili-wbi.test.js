import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBilibiliRequest,
  deriveWbiMixinKey,
  signWbiParams,
} from '../server/bilibili-wbi.ts';

const IMG_URL = 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png';
const SUB_URL = 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png';

test('WBI mixin key follows the official permutation table', () => {
  assert.equal(
    deriveWbiMixinKey(IMG_URL, SUB_URL),
    'ea1db124af3c7062474693fa704f4ff8',
  );
});

test('WBI signing is deterministic and strips forbidden characters', () => {
  const signed = signWbiParams(
    { foo: '114', bar: '514', baz: 1919810, unsafe: "a!'()*b" },
    'ea1db124af3c7062474693fa704f4ff8',
    1702204169,
  );

  assert.equal(signed.get('wts'), '1702204169');
  assert.equal(signed.get('unsafe'), 'ab');
  assert.equal(signed.get('w_rid'), 'e0039df72766a551ff55201d345bc3a9');
});

test('Bilibili request fetches public WBI keys and signs the submissions query', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ code: -101, message: '账号未登录', data: { wbi_img: { img_url: IMG_URL, sub_url: SUB_URL } } });
  };

  const request = await buildBilibiliRequest('496633495', fetchImpl, 1702204169);
  const url = new URL(request.url);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.bilibili.com/x/web-interface/nav');
  assert.equal(url.origin + url.pathname, 'https://api.bilibili.com/x/space/wbi/arc/search');
  assert.equal(url.searchParams.get('mid'), '496633495');
  assert.equal(url.searchParams.get('pn'), '1');
  assert.equal(url.searchParams.get('ps'), '50');
  assert.equal(url.searchParams.get('wts'), '1702204169');
  assert.match(url.searchParams.get('w_rid') ?? '', /^[a-f0-9]{32}$/);
  assert.equal(request.init.headers.Origin, 'https://space.bilibili.com');
  assert.equal(request.init.headers.Referer, 'https://space.bilibili.com/496633495/video');
});

import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav';
const SUBMISSIONS_URL = 'https://api.bilibili.com/x/space/wbi/arc/search';
const MIXIN_KEY_ORDER = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function keyFromUrl(value: string) {
  const filename = new URL(value).pathname.split('/').at(-1) ?? '';
  return filename.split('.')[0];
}

export function deriveWbiMixinKey(imgUrl: string, subUrl: string) {
  const source = keyFromUrl(imgUrl) + keyFromUrl(subUrl);
  if (source.length < 64) throw new Error('BILIBILI_WBI_KEYS_INVALID');
  return MIXIN_KEY_ORDER.map((index) => source[index]).join('').slice(0, 32);
}

export function signWbiParams(
  params: Record<string, string | number | boolean>,
  mixinKey: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const entries = Object.entries({ ...params, wts: Math.trunc(timestamp) })
    .map(([key, value]) => [key, String(value).replace(/[!'()*]/g, '')] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const signed = new URLSearchParams(entries);
  const digest = bytesToHex(md5(new TextEncoder().encode(`${signed.toString()}${mixinKey}`)));
  signed.set('w_rid', digest);
  return signed;
}

function browserHeaders(account: string) {
  return {
    Accept: 'application/json',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 Luke-Personal-Site',
    Origin: 'https://space.bilibili.com',
    Referer: `https://space.bilibili.com/${account}/video`,
  };
}

function fingerprintParams() {
  const first = crypto.randomUUID().replaceAll('-', '');
  const second = crypto.randomUUID().replaceAll('-', '');
  return {
    dm_img_list: '[]',
    dm_img_str: btoa(first).replace(/=+$/, ''),
    dm_cover_img_str: btoa(`${first}${second}`).replace(/=+$/, ''),
    dm_img_inter: JSON.stringify({ ds: [], wh: [6034, 6646, 42], of: [552, 1028, 514] }),
  };
}

export async function buildBilibiliRequest(
  account: string,
  fetchImpl: typeof fetch = fetch,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const headers = browserHeaders(account);
  const navResponse = await fetchImpl(NAV_URL, { headers });
  if (!navResponse.ok) throw new Error(`BILIBILI_WBI_HTTP_${navResponse.status}`);
  const navPayload = await navResponse.json() as any;
  const imgUrl = String(navPayload?.data?.wbi_img?.img_url ?? '');
  const subUrl = String(navPayload?.data?.wbi_img?.sub_url ?? '');
  const mixinKey = deriveWbiMixinKey(imgUrl, subUrl);
  const query = signWbiParams({
    keyword: '',
    mid: account,
    order: 'pubdate',
    order_avoided: 'true',
    platform: 'web',
    pn: 1,
    ps: 50,
    tid: 0,
    web_location: '333.1387',
    special_type: '',
    index: 0,
    ...fingerprintParams(),
  }, mixinKey, timestamp);

  return {
    url: `${SUBMISSIONS_URL}?${query}`,
    init: { headers } satisfies RequestInit,
  };
}

export const DEFAULT_SOURCES = Object.freeze([
  Object.freeze({ platform: 'bilibili', account: '496633495' }),
  Object.freeze({ platform: 'github', account: 'passionfruitfruit' }),
]);

export const DEFAULT_BILIBILI_ITEMS = Object.freeze([
  Object.freeze({
    externalId: 'BV1Sc7s68E3h',
    title: '喜报，B站iOS测试版已更新视频开启/退出动画！！',
    summary: '',
    imageUrl: 'https://i0.hdslb.com/bfs/archive/f302386a9ce158eb3f7457b34a04e6d036017538.jpg',
    publishedAt: 1782567041000,
    stats: Object.freeze({ plays: 12778, comments: 50, duration: '00:30' }),
  }),
  Object.freeze({
    externalId: 'BV14ALH6yE3s',
    title: '双螺旋桨直升机小飞控',
    summary: '',
    imageUrl: 'https://i0.hdslb.com/bfs/archive/8223c5ead4f8ea595221fbf77fe92f7731a81694.jpg',
    publishedAt: 1779008756000,
    stats: Object.freeze({ plays: 117, comments: 0, duration: '01:07' }),
  }),
  Object.freeze({
    externalId: 'BV1RLxLzmE9F',
    title: '傻逼马',
    summary: '',
    imageUrl: 'https://i1.hdslb.com/bfs/archive/a53419ca47d19c07f89bb0a2a764ec8c00b465ab.jpg',
    publishedAt: 1759728748000,
    stats: Object.freeze({ plays: 325, comments: 2, duration: '00:53' }),
  }),
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createFallbackSettings<TOrbit, TPlatform>(orbit: TOrbit, platforms: TPlatform) {
  return { orbit: clone(orbit), platforms: clone(platforms) };
}

function parseObject(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseStoredSettings<TOrbit, TPlatform>(
  orbitJson: string | null,
  platformsJson: string | null,
  fallback: { orbit: TOrbit; platforms: TPlatform },
) {
  return {
    orbit: (parseObject(orbitJson) as TOrbit | null) ?? clone(fallback.orbit),
    platforms: (platformsJson ? (() => {
      try {
        const value = JSON.parse(platformsJson);
        return Array.isArray(value) ? value as TPlatform : null;
      } catch {
        return null;
      }
    })() : null) ?? clone(fallback.platforms),
  };
}

export async function ensureSeedData(db: D1Database, now = Date.now()) {
  const sourceStatements = DEFAULT_SOURCES.map((source) => {
    const id = `${source.platform}:${source.account}`;
    return db.prepare(`
      INSERT INTO source_accounts
        (id, platform, account, enabled, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(platform, account) DO NOTHING
    `).bind(id, source.platform, source.account, now, now);
  });
  const sourceId = 'bilibili:496633495';
  const contentStatements = DEFAULT_BILIBILI_ITEMS.map((item) => db.prepare(`
    INSERT INTO content_items
      (id, platform, external_id, source_id, title, summary, url, image_url, published_at,
       external_updated_at, stats_json, visible, sort_order, source_missing, created_at, updated_at)
    VALUES (?, 'bilibili', ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, 0, 0, ?, ?)
    ON CONFLICT(platform, external_id) DO NOTHING
  `).bind(
    `bilibili:${item.externalId}`,
    item.externalId,
    sourceId,
    item.title,
    item.summary,
    `https://www.bilibili.com/video/${item.externalId}`,
    item.imageUrl,
    item.publishedAt,
    JSON.stringify(item.stats),
    now,
    now,
  ));
  const statements = [...sourceStatements, ...contentStatements];
  if (statements.length) await db.batch(statements);
}

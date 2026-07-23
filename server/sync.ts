import { buildBilibiliRequest } from './bilibili-wbi.ts';

type Source = { id?: string; platform: 'bilibili' | 'github'; account: string };
type SyncSecrets = { githubToken?: string };

export async function buildSourceRequest(
  source: Source,
  secrets: SyncSecrets,
  fetchImpl: typeof fetch = fetch,
  timestamp = Math.floor(Date.now() / 1000),
) {
  if (source.platform === 'github') {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Luke-Personal-Site',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (secrets.githubToken) headers.Authorization = `Bearer ${secrets.githubToken}`;
    return {
      url: `https://api.github.com/users/${encodeURIComponent(source.account)}/repos?per_page=100&sort=updated&type=owner`,
      init: { headers } satisfies RequestInit,
    };
  }
  return buildBilibiliRequest(source.account, fetchImpl, timestamp);
}

function cleanTitle(value: unknown) {
  return String(value ?? '').replace(/<[^>]*>/g, '').trim();
}

export function normalizeGitHubPayload(payload: unknown) {
  if (!Array.isArray(payload)) throw new Error('GITHUB_INVALID_RESPONSE');
  return payload.filter((repo) => repo && typeof repo === 'object' && !(repo as any).fork && !(repo as any).archived).map((repo: any) => ({
    externalId: String(repo.id),
    title: String(repo.name ?? '').trim(),
    summary: String(repo.description ?? '').trim(),
    url: String(repo.html_url ?? ''),
    imageUrl: null,
    publishedAt: Date.parse(repo.created_at) || Date.now(),
    externalUpdatedAt: Date.parse(repo.updated_at) || null,
    stats: { language: repo.language ?? null, stars: Number(repo.stargazers_count) || 0 },
  })).filter((row) => row.externalId && row.title && /^https:\/\//.test(row.url));
}

export function normalizeBilibiliPayload(payload: any) {
  if (payload?.code !== undefined && payload.code !== 0) throw new Error(`BILIBILI_${payload.code}`);
  const videos = payload?.data?.list?.vlist;
  if (!Array.isArray(videos)) throw new Error('BILIBILI_INVALID_RESPONSE');
  return videos.map((video: any) => {
    const bvid = String(video.bvid ?? '').trim();
    const image = String(video.pic ?? '').trim();
    return {
      externalId: bvid,
      title: cleanTitle(video.title),
      summary: String(video.description ?? '').trim(),
      url: `https://www.bilibili.com/video/${bvid}`,
      imageUrl: image.startsWith('//') ? `https:${image}` : image || null,
      publishedAt: Number(video.created) * 1000,
      externalUpdatedAt: null,
      stats: { plays: Number(video.play) || 0, comments: Number(video.comment) || 0, duration: String(video.length ?? '') },
    };
  }).filter((row: any) => row.externalId && row.title);
}

export function mergeSnapshot(existing: { visible: boolean; sortOrder: number } | null, incoming: Record<string, unknown>) {
  return {
    ...incoming,
    visible: existing?.visible ?? true,
    sortOrder: existing?.sortOrder ?? 0,
    sourceMissing: false,
  };
}

export async function syncSource(
  db: D1Database,
  source: Source & { id: string },
  fetchImpl: typeof fetch = fetch,
  secrets: SyncSecrets = {},
  now = Date.now(),
) {
  await db.prepare('UPDATE source_accounts SET last_attempt_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, source.id).run();
  try {
    const request = await buildSourceRequest(source, secrets, fetchImpl, Math.floor(now / 1000));
    const response = await fetchImpl(request.url, request.init);
    if (!response.ok) throw new Error(`${source.platform.toUpperCase()}_HTTP_${response.status}`);
    const payload = await response.json();
    const incoming = source.platform === 'github' ? normalizeGitHubPayload(payload) : normalizeBilibiliPayload(payload);
    const existingResult = await db.prepare('SELECT id, external_id, visible, sort_order FROM content_items WHERE source_id = ?')
      .bind(source.id).all<{ id: string; external_id: string; visible: number; sort_order: number }>();
    const existing = new Map((existingResult.results ?? []).map((row) => [row.external_id, row]));
    const seen = new Set<string>();
    const statements: D1PreparedStatement[] = [];
    for (const item of incoming) {
      seen.add(item.externalId);
      const current = existing.get(item.externalId);
      const merged = mergeSnapshot(current ? { visible: Boolean(current.visible), sortOrder: current.sort_order } : null, item);
      const id = current?.id ?? `${source.platform}:${item.externalId}`;
      statements.push(db.prepare(`
        INSERT INTO content_items
          (id, platform, external_id, source_id, title, summary, url, image_url, published_at,
           external_updated_at, stats_json, visible, sort_order, source_missing, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(platform, external_id) DO UPDATE SET
          source_id = excluded.source_id, title = excluded.title, summary = excluded.summary,
          url = excluded.url, image_url = excluded.image_url, published_at = excluded.published_at,
          external_updated_at = excluded.external_updated_at, stats_json = excluded.stats_json,
          source_missing = 0, updated_at = excluded.updated_at
      `).bind(
        id, source.platform, item.externalId, source.id, item.title, item.summary, item.url,
        item.imageUrl, item.publishedAt, item.externalUpdatedAt, JSON.stringify(item.stats),
        merged.visible ? 1 : 0, merged.sortOrder, now, now,
      ));
    }
    for (const [externalId, row] of existing) {
      if (!seen.has(externalId)) statements.push(db.prepare('UPDATE content_items SET source_missing = 1, updated_at = ? WHERE id = ?').bind(now, row.id));
    }
    statements.push(db.prepare('UPDATE source_accounts SET last_success_at = ?, last_error = NULL, updated_at = ? WHERE id = ?').bind(now, now, source.id));
    if (statements.length) await db.batch(statements);
    return { ok: true as const, imported: incoming.length };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 300) : 'SYNC_FAILED';
    await db.prepare('UPDATE source_accounts SET last_error = ?, updated_at = ? WHERE id = ?').bind(message, now, source.id).run();
    return { ok: false as const, error: message };
  }
}

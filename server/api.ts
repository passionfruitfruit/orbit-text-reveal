import { createSession, checkSubmissionLimit, requireAdmin, revokeSession, serializeExpiredSessionCookie, verifyAdminPassword } from './auth.ts';
import { buildVisibleThread } from './comments.ts';
import { paginateContent } from './content.ts';
import { renderSafeMarkdown } from './markdown.ts';
import { ensureSeedData, parseStoredSettings } from './settings.ts';
import { syncSource } from './sync.ts';
import { validateCommentInput, validateSourceInput } from './validation.ts';
import { normalizeConfig } from '../src/config.js';
import { normalizePlatformConfig } from '../src/platform-config.js';

type Env = {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  RATE_LIMIT_SALT?: string;
  GITHUB_TOKEN?: string;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type Fallback = { orbit: unknown; platforms: unknown[] };

const ok = (data: unknown, init: ResponseInit = {}) => Response.json({ ok: true, data }, init);
const fail = (status: number, code: string, message: string, headers?: HeadersInit) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers });

async function body(request: Request) {
  try {
    return await request.json() as Record<string, any>;
  } catch {
    return null;
  }
}

async function rows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

function contentRow(row: any) {
  return {
    id: row.id,
    platform: row.platform,
    title: row.title,
    summary: row.summary,
    url: row.url,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    externalUpdatedAt: row.external_updated_at,
    statsJson: row.stats_json,
    visible: Boolean(row.visible),
    sortOrder: row.sort_order,
    sourceMissing: Boolean(row.source_missing),
  };
}

function commentRow(row: any) {
  return {
    id: row.id,
    parentId: row.parent_id,
    rootId: row.root_id,
    nickname: row.nickname,
    body: row.body,
    contact: row.contact,
    visitorAllowsPublic: Boolean(row.visitor_allows_public),
    approved: Boolean(row.approved),
    authorRole: row.author_role,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

async function publicSettings(db: D1Database, fallback: Fallback) {
  try {
    const settings = await rows<{ key: string; value: string }>(
      db.prepare("SELECT key, value FROM site_settings WHERE key IN ('orbit', 'platforms')"),
    );
    const values = new Map(settings.map((entry) => [entry.key, entry.value]));
    return parseStoredSettings(values.get('orbit') ?? null, values.get('platforms') ?? null, fallback);
  } catch {
    return fallback;
  }
}

async function getPublicComments(db: D1Database) {
  const result = await rows<any>(db.prepare('SELECT * FROM comments ORDER BY created_at ASC, id ASC'));
  return buildVisibleThread(result.map(commentRow));
}

async function refreshStaleSources(env: Env, all: any[]) {
  const staleBefore = Date.now() - 6 * 60 * 60 * 1000;
  const sources = await rows<any>(env.DB.prepare(`
    SELECT * FROM source_accounts
    WHERE enabled = 1 AND (last_attempt_at IS NULL OR last_attempt_at < ?)
  `).bind(staleBefore));
  if (!sources.length) return all;
  const refresh = Promise.all(sources.map((source) =>
    syncSource(env.DB, source, fetch, { githubToken: env.GITHUB_TOKEN }),
  ));
  if (!all.length) await refresh;
  else if (env.waitUntil) env.waitUntil(refresh);
  else void refresh;
  return all.length
    ? all
    : rows<any>(env.DB.prepare('SELECT * FROM content_items ORDER BY sort_order ASC, published_at DESC, id ASC'));
}

async function insertComment(request: Request, env: Env, parentId: string | null) {
  const input = await body(request);
  if (!input) return fail(400, 'INVALID_BODY', '提交内容格式不正确');
  if (input.website) return ok({ submitted: true }, { status: 202 });
  const validated = validateCommentInput(input, parentId !== null);
  if (!validated.ok) return fail(400, validated.error.code, validated.error.message);
  const allowed = await checkSubmissionLimit(
    env.DB,
    request,
    parentId ? 'reply' : 'comment',
    env.RATE_LIMIT_SALT || 'personal-site',
  );
  if (!allowed) return fail(429, 'RATE_LIMITED', '提交得有点快，请稍后再试');
  const id = crypto.randomUUID();
  let rootId = id;
  let visitorAllowsPublic = validated.value.visitorAllowsPublic ?? false;
  if (parentId) {
    const parent = await env.DB.prepare('SELECT id, root_id FROM comments WHERE id = ? AND deleted_at IS NULL').bind(parentId).first<any>();
    if (!parent) return fail(404, 'COMMENT_NOT_FOUND', '这条留言已不存在');
    const visible = await getPublicComments(env.DB);
    const find = (nodes: any[]): boolean => nodes.some((node) => node.id === parentId || find(node.replies));
    if (!find(visible)) return fail(404, 'COMMENT_NOT_PUBLIC', '这条留言暂时不能回复');
    rootId = parent.root_id;
    const root = await env.DB.prepare('SELECT visitor_allows_public FROM comments WHERE id = ?').bind(rootId).first<any>();
    visitorAllowsPublic = Boolean(root?.visitor_allows_public);
  }
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO comments
      (id, parent_id, root_id, nickname, body, contact, visitor_allows_public, approved, author_role, deleted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'visitor', NULL, ?, ?)
  `).bind(
    id, parentId, rootId, validated.value.nickname, validated.value.body,
    validated.value.contact, visitorAllowsPublic ? 1 : 0, now, now,
  ).run();
  return ok({ id, status: 'pending' }, { status: 201 });
}

async function saveBlog(db: D1Database, input: Record<string, any>, id = crypto.randomUUID()) {
  const kind = input.kind === 'external' ? 'external' : 'internal';
  const title = String(input.title ?? '').trim();
  const summary = String(input.summary ?? '').trim();
  const markdown = kind === 'internal' ? String(input.markdown ?? '') : null;
  const externalUrl = kind === 'external' ? String(input.externalUrl ?? '').trim() : null;
  if (!title || !summary || (kind === 'external' && !/^https?:\/\//.test(externalUrl ?? ''))) {
    return { error: fail(400, 'INVALID_BLOG', '请填写完整的博客标题、简介和有效链接') };
  }
  const now = Date.now();
  const publishedAt = Number(input.publishedAt) || now;
  const visible = input.visible === true;
  const url = kind === 'internal' ? `/blog/${id}` : externalUrl!;
  const existing = await db.prepare('SELECT id, created_at FROM blog_posts WHERE id = ?').bind(id).first<any>();
  const sort = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM content_items').first<any>();
  await db.batch([
    db.prepare(`
      INSERT INTO blog_posts
        (id, kind, title, summary, markdown, external_url, cover_url, published_at, visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, title=excluded.title, summary=excluded.summary,
        markdown=excluded.markdown, external_url=excluded.external_url, cover_url=excluded.cover_url,
        published_at=excluded.published_at, visible=excluded.visible, updated_at=excluded.updated_at
    `).bind(id, kind, title, summary, markdown, externalUrl, input.coverUrl || null, publishedAt, visible ? 1 : 0, existing?.created_at ?? now, now),
    db.prepare(`
      INSERT INTO content_items
        (id, platform, blog_id, title, summary, url, image_url, published_at, visible, sort_order, source_missing, created_at, updated_at)
      VALUES (?, 'blog', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(blog_id) DO UPDATE SET title=excluded.title, summary=excluded.summary, url=excluded.url,
        image_url=excluded.image_url, published_at=excluded.published_at, visible=excluded.visible, updated_at=excluded.updated_at
    `).bind(`blog:${id}`, id, title, summary, url, input.coverUrl || null, publishedAt, visible ? 1 : 0, sort?.next_order ?? 0, now, now),
  ]);
  return { id };
}

async function handlePublic(request: Request, env: Env, fallback: Fallback, path: string, url: URL) {
  if (request.method === 'GET' && path === 'public/config') return ok(await publicSettings(env.DB, fallback));
  if (request.method === 'GET' && path === 'public/contents') {
    let all = await rows<any>(env.DB.prepare('SELECT * FROM content_items ORDER BY sort_order ASC, published_at DESC, id ASC'));
    all = await refreshStaleSources(env, all);
    return ok(paginateContent(all.map(contentRow), Number(url.searchParams.get('page')) || 1, 10));
  }
  if (request.method === 'GET' && path.startsWith('public/blog/')) {
    const id = decodeURIComponent(path.slice('public/blog/'.length));
    const post = await env.DB.prepare("SELECT * FROM blog_posts WHERE id = ? AND kind = 'internal' AND visible = 1").bind(id).first<any>();
    if (!post) return fail(404, 'BLOG_NOT_FOUND', '没有找到这篇文章');
    return ok({ id: post.id, title: post.title, summary: post.summary, coverUrl: post.cover_url, publishedAt: post.published_at, safeHtml: renderSafeMarkdown(post.markdown ?? '') });
  }
  if (request.method === 'GET' && path === 'public/comments') return ok(await getPublicComments(env.DB));
  if (request.method === 'POST' && path === 'public/comments') return insertComment(request, env, null);
  const reply = /^public\/comments\/([^/]+)\/reply$/.exec(path);
  if (request.method === 'POST' && reply) return insertComment(request, env, decodeURIComponent(reply[1]));
  return null;
}

async function handleAdmin(request: Request, env: Env, fallback: Fallback, path: string) {
  if (request.method === 'POST' && path === 'admin/login') {
    const input = await body(request);
    const limited = await checkSubmissionLimit(env.DB, request, 'admin-login', env.RATE_LIMIT_SALT || 'personal-site', { maximum: 8 });
    if (!limited) return fail(429, 'RATE_LIMITED', '尝试次数太多，请稍后再试');
    if (!await verifyAdminPassword(String(input?.password ?? ''), env.ADMIN_PASSWORD ?? '')) {
      return fail(401, 'INVALID_PASSWORD', '口令不正确');
    }
    const session = await createSession(env.DB);
    return ok({ expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': session.cookie } });
  }
  if (!await requireAdmin(request, env.DB)) return fail(401, 'UNAUTHORIZED', '请先登录后台');
  if (request.method === 'GET' && path === 'admin/session') return ok({ authenticated: true });
  if (request.method === 'POST' && path === 'admin/logout') {
    await revokeSession(request, env.DB);
    return ok({ authenticated: false }, { headers: { 'Set-Cookie': serializeExpiredSessionCookie() } });
  }
  if (request.method === 'GET' && path === 'admin/config') return ok(await publicSettings(env.DB, fallback));
  if (request.method === 'PUT' && path === 'admin/config') {
    const input = await body(request);
    if (!input || typeof input.orbit !== 'object' || !Array.isArray(input.platforms)) return fail(400, 'INVALID_CONFIG', '配置格式不正确');
    const now = Date.now();
    const orbit = normalizeConfig(input.orbit);
    const platforms = normalizePlatformConfig(input.platforms);
    await env.DB.batch([
      env.DB.prepare(`
      INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).bind('orbit', JSON.stringify(orbit), now),
      env.DB.prepare(`
        INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).bind('platforms', JSON.stringify(platforms), now),
    ]);
    return ok({ saved: true });
  }
  if (request.method === 'GET' && path === 'admin/sources') return ok(await rows(env.DB.prepare('SELECT * FROM source_accounts ORDER BY platform, account')));
  if (request.method === 'POST' && path === 'admin/sources') {
    const validated = validateSourceInput(await body(request));
    if (!validated.ok) return fail(400, validated.error.code, validated.error.message);
    const now = Date.now();
    const id = `${validated.value.platform}:${validated.value.account}`;
    await env.DB.prepare('INSERT INTO source_accounts (id, platform, account, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, validated.value.platform, validated.value.account, validated.value.enabled ? 1 : 0, now, now).run();
    return ok({ id }, { status: 201 });
  }
  if (request.method === 'POST' && path === 'admin/sources/sync-all') {
    const sources = await rows<any>(env.DB.prepare('SELECT * FROM source_accounts WHERE enabled = 1'));
    const results = [];
    for (const source of sources) results.push(await syncSource(env.DB, source, fetch, { githubToken: env.GITHUB_TOKEN }));
    return ok(results);
  }
  const sourceMatch = /^admin\/sources\/([^/]+)(?:\/(sync))?$/.exec(path);
  if (sourceMatch) {
    const id = decodeURIComponent(sourceMatch[1]);
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM source_accounts WHERE id = ?').bind(id).run();
      return ok({ deleted: true });
    }
    if (request.method === 'PUT') {
      const input = await body(request);
      await env.DB.prepare('UPDATE source_accounts SET enabled = ?, updated_at = ? WHERE id = ?').bind(input?.enabled === false ? 0 : 1, Date.now(), id).run();
      return ok({ saved: true });
    }
    if (request.method === 'POST' && sourceMatch[2] === 'sync') {
      const source = await env.DB.prepare('SELECT * FROM source_accounts WHERE id = ?').bind(id).first<any>();
      if (!source) return fail(404, 'SOURCE_NOT_FOUND', '没有找到这个来源');
      return ok(await syncSource(env.DB, source, fetch, { githubToken: env.GITHUB_TOKEN }));
    }
  }
  if (request.method === 'GET' && path === 'admin/contents') return ok((await rows<any>(env.DB.prepare('SELECT * FROM content_items ORDER BY sort_order, published_at DESC'))).map(contentRow));
  if (request.method === 'PUT' && path === 'admin/contents/reorder') {
    const input = await body(request);
    if (!Array.isArray(input?.ids)) return fail(400, 'INVALID_ORDER', '排序格式不正确');
    await env.DB.batch(input.ids.map((id: string, index: number) => env.DB.prepare('UPDATE content_items SET sort_order = ?, updated_at = ? WHERE id = ?').bind(index, Date.now(), id)));
    return ok({ saved: true });
  }
  if (request.method === 'POST' && path === 'admin/contents/batch-visibility') {
    const input = await body(request);
    if (!Array.isArray(input?.ids) || typeof input.visible !== 'boolean') return fail(400, 'INVALID_VISIBILITY', '显示设置格式不正确');
    await env.DB.batch(input.ids.map((id: string) => env.DB.prepare('UPDATE content_items SET visible = ?, updated_at = ? WHERE id = ?').bind(input.visible ? 1 : 0, Date.now(), id)));
    return ok({ saved: true });
  }
  const contentMatch = /^admin\/contents\/([^/]+)$/.exec(path);
  if (contentMatch) {
    const id = decodeURIComponent(contentMatch[1]);
    if (request.method === 'PUT') {
      const input = await body(request);
      await env.DB.prepare('UPDATE content_items SET visible = COALESCE(?, visible), sort_order = COALESCE(?, sort_order), updated_at = ? WHERE id = ?')
        .bind(typeof input?.visible === 'boolean' ? (input.visible ? 1 : 0) : null, Number.isFinite(input?.sortOrder) ? input.sortOrder : null, Date.now(), id).run();
      return ok({ saved: true });
    }
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM content_items WHERE id = ?').bind(id).run();
      return ok({ deleted: true });
    }
  }
  if (request.method === 'GET' && path === 'admin/blogs') return ok(await rows(env.DB.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC')));
  if (request.method === 'POST' && path === 'admin/blogs') {
    const result = await saveBlog(env.DB, (await body(request)) ?? {});
    return 'error' in result ? result.error : ok(result, { status: 201 });
  }
  const blogMatch = /^admin\/blogs\/([^/]+)$/.exec(path);
  if (blogMatch) {
    const id = decodeURIComponent(blogMatch[1]);
    if (request.method === 'PUT') {
      const result = await saveBlog(env.DB, (await body(request)) ?? {}, id);
      return 'error' in result ? result.error : ok(result);
    }
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
      return ok({ deleted: true });
    }
  }
  if (request.method === 'GET' && path === 'admin/comments') return ok((await rows<any>(env.DB.prepare('SELECT * FROM comments ORDER BY created_at DESC'))).map(commentRow));
  const commentMatch = /^admin\/comments\/([^/]+)(?:\/(approve|unapprove|hide|restore|reply))?$/.exec(path);
  if (commentMatch) {
    const id = decodeURIComponent(commentMatch[1]);
    const action = commentMatch[2];
    if (request.method === 'GET' && !action) {
      const item = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<any>();
      return item ? ok(commentRow(item)) : fail(404, 'COMMENT_NOT_FOUND', '没有找到这条留言');
    }
    if (request.method === 'DELETE' && !action) {
      const item = await env.DB.prepare('SELECT id FROM comments WHERE id = ?').bind(id).first<any>();
      if (!item) return fail(404, 'COMMENT_NOT_FOUND', '没有找到这条留言');
      await env.DB.prepare(`
        WITH RECURSIVE subtree(id) AS (
          SELECT id FROM comments WHERE id = ?
          UNION ALL
          SELECT comments.id FROM comments JOIN subtree ON comments.parent_id = subtree.id
        )
        DELETE FROM comments WHERE id IN (SELECT id FROM subtree)
      `).bind(id).run();
      return ok({ deleted: true });
    }
    if (request.method === 'PUT' && action) {
      const updates: Record<string, string> = {
        approve: 'approved = 1', unapprove: 'approved = 0',
        hide: 'deleted_at = ?', restore: 'deleted_at = NULL',
      };
      if (action !== 'reply') {
        const now = Date.now();
        const sql = `UPDATE comments SET ${updates[action]}, updated_at = ? WHERE id = ?`;
        const statement = action === 'hide' ? env.DB.prepare(sql).bind(now, now, id) : env.DB.prepare(sql).bind(now, id);
        await statement.run();
        return ok({ saved: true });
      }
    }
    if (request.method === 'POST' && action === 'reply') {
      const input = await body(request);
      const text = String(input?.body ?? '').trim();
      if (!text || text.length > 2000) return fail(400, 'INVALID_REPLY', '回复内容需为 1 到 2000 个字符');
      const parent = await env.DB.prepare('SELECT root_id, visitor_allows_public FROM comments WHERE id = ?').bind(id).first<any>();
      if (!parent) return fail(404, 'COMMENT_NOT_FOUND', '没有找到这条留言');
      const replyId = crypto.randomUUID();
      const now = Date.now();
      await env.DB.prepare(`INSERT INTO comments
        (id, parent_id, root_id, nickname, body, contact, visitor_allows_public, approved, author_role, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, '站长', ?, NULL, ?, 1, 'owner', NULL, ?, ?)`)
        .bind(replyId, id, parent.root_id, text, parent.visitor_allows_public, now, now).run();
      return ok({ id: replyId }, { status: 201 });
    }
  }
  return null;
}

export async function dispatchApi(request: Request, env: Env, fallback: Fallback) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  try {
    if (path.startsWith('public/')) {
      const response = await handlePublic(request, env, fallback, path, url);
      if (response) return response;
    }
    if (path.startsWith('admin/')) {
      const response = await handleAdmin(request, env, fallback, path);
      if (response) return response;
    }
    return fail(404, 'NOT_FOUND', '没有找到这个接口');
  } catch (cause) {
    console.error('API request failed', cause);
    return fail(500, 'INTERNAL_ERROR', '服务器暂时开小差了，请稍后再试');
  }
}

let initialization: Promise<void> | null = null;

async function applyRuntimeSchema(db: D1Database) {
  const migration = await import('../drizzle/0000_personal_site.sql?raw');
  const statements = migration.default
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim().replace(/;$/, ''))
    .filter(Boolean)
    .map((statement) => statement
      .replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ')
      .replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
      .replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS '));
  await db.batch(statements.map((statement) => db.prepare(statement)));
}

export async function initializeApi(env: Env) {
  if (!initialization) {
    initialization = applyRuntimeSchema(env.DB)
      .then(() => ensureSeedData(env.DB))
      .catch((error) => {
        initialization = null;
        throw error;
      });
  }
  await initialization;
}

'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const sections = [
  ['orbit', '首屏文字'],
  ['platforms', '平台入口'],
  ['sources', '内容来源'],
  ['contents', '内容展示'],
  ['blogs', '博客'],
  ['comments', '留言'],
] as const;
type Section = typeof sections[number][0];

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error?.message || '操作失败') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setPassword('');
      onSuccess();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : '登录失败');
    } finally { setBusy(false); }
  };
  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <h1>网站后台</h1>
        <label>管理员口令<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button disabled={busy}>{busy ? '登录中...' : '登录'}</button>
        <p aria-live="polite">{status}</p>
      </form>
    </main>
  );
}

function JsonEditor({ title, value, onChange, onSave }: { title: string; value: string; onChange: (value: string) => void; onSave: () => void }) {
  return (
    <section className="admin-panel">
      <header><div><h2>{title}</h2><p>以 JSON 编辑，保存前会检查格式。</p></div><button onClick={onSave}>保存</button></header>
      <textarea className="json-editor" spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} />
    </section>
  );
}

function SourcesPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [platform, setPlatform] = useState('bilibili');
  const [account, setAccount] = useState('');
  const [status, setStatus] = useState('');
  const load = useCallback(() => request('/api/admin/sources').then(setItems).catch((e) => setStatus(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request('/api/admin/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, account }) });
      setAccount(''); await load();
    } catch (e) { setStatus((e as Error).message); }
  };
  return (
    <section className="admin-panel">
      <header><div><h2>内容来源</h2><p>管理 Bilibili UID 和 GitHub 用户名。</p></div><button onClick={() => request('/api/admin/sources/sync-all', { method: 'POST' }).then(load).catch((e) => setStatus(e.message))}>全部同步</button></header>
      <form className="inline-form" onSubmit={add}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="bilibili">Bilibili</option><option value="github">GitHub</option></select>
        <input required value={account} onChange={(e) => setAccount(e.target.value)} placeholder={platform === 'bilibili' ? 'UID' : '用户名'} />
        <button>添加</button>
      </form>
      <div className="admin-table">
        {items.map((item) => <div className="admin-row" key={item.id}>
          <div><strong>{item.platform}</strong><span>{item.account}</span><small>{item.last_error || (item.last_success_at ? `上次成功：${new Date(item.last_success_at).toLocaleString('zh-CN')}` : '尚未同步')}</small></div>
          <div className="row-actions">
            <button onClick={() => request(`/api/admin/sources/${encodeURIComponent(item.id)}/sync`, { method: 'POST' }).then(load).catch((e) => setStatus(e.message))}>同步</button>
            <button onClick={() => request(`/api/admin/sources/${encodeURIComponent(item.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) }).then(load)}>{item.enabled ? '停用' : '启用'}</button>
            <button className="danger" onClick={() => confirm('删除这个来源？已有内容不会自动公开恢复。') && request(`/api/admin/sources/${encodeURIComponent(item.id)}`, { method: 'DELETE' }).then(load)}>删除</button>
          </div>
        </div>)}
      </div>
      <p className="admin-status" aria-live="polite">{status}</p>
    </section>
  );
}

function ContentsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const load = useCallback(() => request('/api/admin/contents').then(setItems).catch((e) => setStatus(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const move = async (index: number, offset: number) => {
    const next = [...items];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1); next.splice(target, 0, item); setItems(next);
    await request('/api/admin/contents/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map(({ id }) => id) }) });
  };
  return (
    <section className="admin-panel">
      <header><div><h2>内容展示</h2><p>跨平台调整公开状态和混合顺序。</p></div></header>
      <div className="admin-table">
        {items.map((item, index) => <div className="admin-row" key={item.id}>
          <div><strong>{item.title}</strong><span>{item.platform}{item.sourceMissing ? ' · 来源中未找到' : ''}</span></div>
          <div className="row-actions">
            <button title="上移" aria-label="上移" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button title="下移" aria-label="下移" disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button onClick={() => request(`/api/admin/contents/${encodeURIComponent(item.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visible: !item.visible }) }).then(load)}>{item.visible ? '隐藏' : '显示'}</button>
          </div>
        </div>)}
      </div>
      <p className="admin-status">{status}</p>
    </section>
  );
}

const emptyBlog = { id: '', kind: 'internal', title: '', summary: '', markdown: '', externalUrl: '', coverUrl: '', visible: false };

function BlogsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(emptyBlog);
  const [status, setStatus] = useState('');
  const load = useCallback(() => request('/api/admin/blogs').then(setItems).catch((e) => setStatus(e.message)), []);
  useEffect(() => {
    load();
    try { setDraft(JSON.parse(sessionStorage.getItem('admin-blog-draft') || 'null') || emptyBlog); } catch { setDraft(emptyBlog); }
  }, [load]);
  useEffect(() => { sessionStorage.setItem('admin-blog-draft', JSON.stringify(draft)); }, [draft]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request(draft.id ? `/api/admin/blogs/${encodeURIComponent(draft.id)}` : '/api/admin/blogs', {
        method: draft.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      setDraft(emptyBlog); sessionStorage.removeItem('admin-blog-draft'); setStatus('博客已保存'); await load();
    } catch (e) { setStatus((e as Error).message); }
  };
  return (
    <section className="admin-panel">
      <header><div><h2>博客</h2><p>站内文章使用安全 Markdown，也可保存外部链接。</p></div></header>
      <form className="editor-form" onSubmit={save}>
        <div className="form-grid"><label>类型<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}><option value="internal">站内文章</option><option value="external">外部链接</option></select></label><label>标题<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label></div>
        <label>简介<textarea required rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
        {draft.kind === 'internal' ? <label>Markdown 正文<textarea rows={12} value={draft.markdown} onChange={(e) => setDraft({ ...draft, markdown: e.target.value })} /></label> : <label>外部 URL<input type="url" required value={draft.externalUrl} onChange={(e) => setDraft({ ...draft, externalUrl: e.target.value })} /></label>}
        <label>封面 URL（选填）<input type="url" value={draft.coverUrl || ''} onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })} /></label>
        <label className="check-line"><input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />公开展示</label>
        <div className="row-actions"><button>保存博客</button>{draft.id && <button type="button" onClick={() => setDraft(emptyBlog)}>取消编辑</button>}</div>
      </form>
      <div className="admin-table">{items.map((item) => <div className="admin-row" key={item.id}><div><strong>{item.title}</strong><span>{item.kind} · {item.visible ? '公开' : '隐藏'}</span></div><div className="row-actions"><button onClick={() => setDraft({ id: item.id, kind: item.kind, title: item.title, summary: item.summary, markdown: item.markdown || '', externalUrl: item.external_url || '', coverUrl: item.cover_url || '', visible: Boolean(item.visible) })}>编辑</button><button className="danger" onClick={() => confirm('永久删除这篇博客？') && request(`/api/admin/blogs/${item.id}`, { method: 'DELETE' }).then(load)}>删除</button></div></div>)}</div>
      <p className="admin-status" aria-live="polite">{status}</p>
    </section>
  );
}

function CommentsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const load = useCallback(() => request('/api/admin/comments').then(setItems).catch((e) => setStatus(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const action = (id: string, name: 'approve' | 'unapprove' | 'hide' | 'restore') => request(`/api/admin/comments/${id}/${name}`, { method: 'PUT' }).then(load).catch((e) => setStatus(e.message));
  const reply = async (id: string) => {
    const body = prompt('以站长身份回复：');
    if (body) await request(`/api/admin/comments/${id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }).then(load);
  };
  return (
    <section className="admin-panel">
      <header><div><h2>留言</h2><p>联系方式只在这里显示。公开需要访客允许且你批准。</p></div></header>
      <div className="admin-table">{items.map((item) => <div className="admin-row admin-row--comment" key={item.id}>
        <div><strong>{item.nickname}{item.authorRole === 'owner' ? '（站长）' : ''}</strong><p>{item.body}</p><small>联系方式：{item.contact || '未填写'} · {item.visitorAllowsPublic ? '访客允许公开' : '仅后台'} · {item.approved ? '已批准' : '待审核'}{item.deletedAt ? ' · 已删除' : ''}</small></div>
        <div className="row-actions">
          {!item.approved && !item.deletedAt && <button onClick={() => action(item.id, 'approve')}>批准</button>}
          {item.approved && !item.deletedAt && <button onClick={() => action(item.id, 'unapprove')}>取消公开</button>}
          {!item.deletedAt && <button onClick={() => reply(item.id)}>回复</button>}
          {!item.deletedAt ? <button onClick={() => action(item.id, 'hide')}>软删除</button> : <button onClick={() => action(item.id, 'restore')}>恢复</button>}
          <button className="danger" onClick={() => confirm('永久删除？根留言的全部回复和联系方式也会删除。') && request(`/api/admin/comments/${item.id}`, { method: 'DELETE' }).then(load)}>永久删除</button>
        </div>
      </div>)}</div>
      <p className="admin-status">{status}</p>
    </section>
  );
}

export function AdminClient() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [active, setActive] = useState<Section>('orbit');
  const [orbitJson, setOrbitJson] = useState('');
  const [platformJson, setPlatformJson] = useState('');
  const [status, setStatus] = useState('');
  const loadConfig = useCallback(() => request('/api/admin/config').then((data) => {
    setOrbitJson(JSON.stringify(data.orbit, null, 2)); setPlatformJson(JSON.stringify(data.platforms, null, 2));
  }), []);
  useEffect(() => { request('/api/admin/session').then(() => { setAuthenticated(true); loadConfig(); }).catch(() => setAuthenticated(false)); }, [loadConfig]);
  useEffect(() => { if (orbitJson) sessionStorage.setItem('admin-orbit-draft', orbitJson); }, [orbitJson]);
  useEffect(() => { if (platformJson) sessionStorage.setItem('admin-platform-draft', platformJson); }, [platformJson]);
  const saveConfig = async () => {
    try {
      const orbit = JSON.parse(orbitJson); const platforms = JSON.parse(platformJson);
      await request('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orbit, platforms }) });
      setStatus('配置已保存'); sessionStorage.removeItem('admin-orbit-draft'); sessionStorage.removeItem('admin-platform-draft');
    } catch (e) { setStatus(e instanceof SyntaxError ? 'JSON 格式不正确' : (e as Error).message); }
  };
  const current = useMemo(() => {
    if (active === 'orbit') return <JsonEditor title="首屏文字" value={orbitJson} onChange={setOrbitJson} onSave={saveConfig} />;
    if (active === 'platforms') return <JsonEditor title="平台入口" value={platformJson} onChange={setPlatformJson} onSave={saveConfig} />;
    if (active === 'sources') return <SourcesPanel />;
    if (active === 'contents') return <ContentsPanel />;
    if (active === 'blogs') return <BlogsPanel />;
    return <CommentsPanel />;
  }, [active, orbitJson, platformJson]);
  if (authenticated === null) return <main className="admin-loading">正在检查后台会话...</main>;
  if (!authenticated) return <Login onSuccess={() => { setAuthenticated(true); loadConfig(); }} />;
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar"><a className="admin-brand" href="/">Luke / 后台</a><nav className="admin-nav">{sections.map(([id, label]) => <button key={id} className={active === id ? 'is-active' : ''} onClick={() => setActive(id)}>{label}</button>)}</nav><button className="logout" onClick={() => request('/api/admin/logout', { method: 'POST' }).finally(() => setAuthenticated(false))}>退出</button></aside>
      <div className="admin-main">{current}<p className="admin-status" aria-live="polite">{status}</p></div>
    </main>
  );
}

'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

type Comment = {
  id: string; parentId: string | null; rootId: string; nickname: string; body: string;
  date: string; authorRole: 'visitor' | 'owner'; replies: Comment[];
};

type FormValues = { nickname: string; body: string; contact: string; visitorAllowsPublic: boolean; website: string };
const emptyForm: FormValues = { nickname: '', body: '', contact: '', visitorAllowsPublic: false, website: '' };

function CommentForm({ parentId, onDone, onCancel }: { parentId?: string; onDone: () => void; onCancel?: () => void }) {
  const [values, setValues] = useState(emptyForm);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const path = parentId ? `/api/public/comments/${encodeURIComponent(parentId)}/reply` : '/api/public/comments';
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '提交失败');
      setValues(emptyForm);
      setStatus('已提交，审核通过后会显示。');
      onDone();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : '提交失败，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={parentId ? 'comment-form comment-form--reply' : 'comment-form'} onSubmit={submit}>
      <div className="form-row">
        <label>昵称<input required maxLength={30} value={values.nickname} onChange={(e) => setValues({ ...values, nickname: e.target.value })} /></label>
        <label>联系方式（选填）<input maxLength={200} value={values.contact} onChange={(e) => setValues({ ...values, contact: e.target.value })} /></label>
      </div>
      <p className="privacy-note">联系方式仅站长可见</p>
      <label>内容<textarea required maxLength={2000} rows={parentId ? 3 : 5} value={values.body} onChange={(e) => setValues({ ...values, body: e.target.value })} /></label>
      <label className="honeypot" aria-hidden="true">网站<input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setValues({ ...values, website: e.target.value })} /></label>
      {!parentId && <label className="check-row"><input type="checkbox" checked={values.visitorAllowsPublic} onChange={(e) => setValues({ ...values, visitorAllowsPublic: e.target.checked })} />允许审核通过后公开展示这条留言</label>}
      <div className="form-actions">
        <button type="submit" disabled={busy}>{busy ? '提交中...' : parentId ? '提交回复' : '提交留言'}</button>
        {onCancel && <button type="button" className="button-quiet" onClick={onCancel}>取消</button>}
      </div>
      <p className="form-status" aria-live="polite">{status}</p>
    </form>
  );
}

function CommentNode({ node, depth, reload }: { node: Comment; depth: number; reload: () => void }) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="comment-node" style={{ '--depth': Math.min(depth, 3) } as CSSProperties}>
      <div className="comment-node__avatar" aria-hidden="true">{node.authorRole === 'owner' ? '站' : node.nickname.slice(0, 1)}</div>
      <div className="comment-node__content">
        <header><strong>{node.nickname}</strong>{node.authorRole === 'owner' && <span>站长</span>}<time>{node.date}</time></header>
        <p>{node.body}</p>
        <button type="button" className="reply-button" onClick={() => setReplying((value) => !value)}>回复</button>
        {replying && <CommentForm parentId={node.id} onCancel={() => setReplying(false)} onDone={() => { setReplying(false); reload(); }} />}
      </div>
      {node.replies.length > 0 && <ol className="comment-children">{node.replies.map((reply) => <CommentNode key={reply.id} node={reply} depth={depth + 1} reload={reload} />)}</ol>}
    </li>
  );
}

export function Comments() {
  const [items, setItems] = useState<Comment[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    fetch('/api/public/comments').then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error();
      setItems(payload.data);
      setError('');
    }).catch(() => setError('公开留言暂时没能加载出来。'));
  }, []);
  useEffect(load, [load]);
  return (
    <div className="comments-layout">
      <CommentForm onDone={load} />
      {error && <p className="section-status" role="alert">{error}</p>}
      {items.length > 0 && <ol className="comment-list">{items.map((item) => <CommentNode key={item.id} node={item} depth={0} reload={load} />)}</ol>}
    </div>
  );
}

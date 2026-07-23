'use client';

import { useEffect, useState } from 'react';

type ContentItem = {
  id: string;
  platform: 'bilibili' | 'github' | 'blog';
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishedAt: number;
  updatedAt: number | null;
  stats: Record<string, unknown> | null;
};

type PageData = {
  items: ContentItem[];
  pagination: { page: number; totalPages: number; hasPrevious: boolean; hasNext: boolean };
};

const labels = { bilibili: 'Bilibili', github: 'GitHub', blog: '博客' };

function metadata(item: ContentItem) {
  const date = new Date(item.publishedAt).toLocaleDateString('zh-CN');
  if (item.platform === 'github') {
    return [item.stats?.language, `${item.stats?.stars ?? 0} Stars`, date].filter(Boolean).join(' · ');
  }
  if (item.platform === 'bilibili') {
    return [`${item.stats?.plays ?? 0} 播放`, date].join(' · ');
  }
  return date;
}

export function ContentFeed() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(`/api/public/contents?page=${page}&limit=10`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '加载失败');
        setData(payload.data);
      })
      .catch((cause) => {
        if (cause.name !== 'AbortError') setError('内容暂时没能加载出来，请稍后再试。');
      });
    return () => controller.abort();
  }, [page]);

  if (error) return <p className="section-status" role="alert">{error}</p>;
  if (!data) return <p className="section-status">加载中...</p>;
  if (!data.items.length) return null;

  return (
    <>
      <div className="content-list">
        {data.items.map((item) => (
          <a className={`content-card content-card--${item.platform}`} href={item.url} key={item.id}
            target={item.url.startsWith('http') ? '_blank' : undefined} rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}>
            <div className="content-card__media">
              {item.imageUrl
                ? <img src={item.imageUrl} alt="" loading="lazy" />
                : <span aria-hidden="true">{item.platform === 'github' ? 'GH' : labels[item.platform].slice(0, 1)}</span>}
            </div>
            <div className="content-card__body">
              <span className="content-card__source">{labels[item.platform]}</span>
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
              <small>{metadata(item)}</small>
            </div>
          </a>
        ))}
      </div>
      {data.pagination.totalPages > 1 && (
        <nav className="pagination" aria-label="内容翻页">
          <button type="button" disabled={!data.pagination.hasPrevious} onClick={() => setPage((value) => value - 1)}>上一页</button>
          <span>{data.pagination.page} / {data.pagination.totalPages}</span>
          <button type="button" disabled={!data.pagination.hasNext} onClick={() => setPage((value) => value + 1)}>下一页</button>
        </nav>
      )}
    </>
  );
}

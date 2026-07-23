import { notFound } from 'next/navigation';
import { getDb } from '../../../db/client';
import { renderSafeMarkdown } from '../../../server/markdown';

export const dynamic = 'force-dynamic';

export default async function BlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getDb().prepare("SELECT * FROM blog_posts WHERE id = ? AND kind = 'internal' AND visible = 1")
    .bind(id).first<any>();
  if (!post) notFound();
  return (
    <main className="article-page">
      <a className="back-link" href="/">返回首页</a>
      <article className="blog-article">
        <header>
          <h1>{post.title}</h1>
          <p>{post.summary}</p>
          <time>{new Date(post.published_at).toLocaleDateString('zh-CN')}</time>
        </header>
        <div className="blog-body" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(post.markdown ?? '') }} />
      </article>
    </main>
  );
}

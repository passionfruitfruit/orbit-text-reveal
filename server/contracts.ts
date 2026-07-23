export type Platform = 'bilibili' | 'github' | 'blog';

export interface PublicContent {
  id: string;
  platform: Platform;
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishedAt: number;
  updatedAt: number | null;
  stats: Record<string, unknown> | null;
}

export interface PublicComment {
  id: string;
  parentId: string | null;
  rootId: string;
  nickname: string;
  body: string;
  date: string;
  authorRole: 'visitor' | 'owner';
  replies: PublicComment[];
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };

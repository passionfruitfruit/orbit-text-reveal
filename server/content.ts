import type { PublicContent } from './contracts.ts';

type ContentRow = {
  id: string;
  platform: PublicContent['platform'];
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishedAt: number;
  externalUpdatedAt?: number | null;
  statsJson?: string | null;
  visible: boolean;
  sortOrder: number;
};

function parsedStats(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function toPublicContent(row: ContentRow): PublicContent {
  return {
    id: row.id,
    platform: row.platform,
    title: row.title,
    summary: row.summary,
    url: row.url,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    updatedAt: row.externalUpdatedAt ?? null,
    stats: parsedStats(row.statsJson),
  };
}

export function paginateContent(rows: ContentRow[], requestedPage = 1, requestedLimit = 10) {
  const pageSize = Math.min(10, Math.max(1, Math.trunc(requestedLimit) || 10));
  const publicRows = rows.filter((row) => row.visible).sort((a, b) =>
    a.sortOrder - b.sortOrder || b.publishedAt - a.publishedAt || a.id.localeCompare(b.id),
  );
  const totalItems = publicRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage) || 1));
  const offset = (page - 1) * pageSize;
  return {
    items: publicRows.slice(offset, offset + pageSize).map(toPublicContent),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

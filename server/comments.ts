import type { PublicComment } from './contracts.ts';

export type CommentRow = {
  id: string;
  parentId: string | null;
  rootId: string;
  nickname: string;
  body: string;
  visitorAllowsPublic: boolean;
  approved: boolean;
  authorRole: 'visitor' | 'owner';
  deletedAt: number | null;
  createdAt: number;
};

export function toPublicComment(row: CommentRow): PublicComment {
  return {
    id: row.id,
    parentId: row.parentId,
    rootId: row.rootId,
    nickname: row.nickname,
    body: row.body,
    date: new Date(row.createdAt).toISOString().slice(0, 10),
    authorRole: row.authorRole,
    replies: [],
  };
}

function rowIsVisible(row: CommentRow, root: CommentRow | undefined) {
  return Boolean(root?.visitorAllowsPublic && root.approved && !root.deletedAt && row.approved && !row.deletedAt);
}

export function buildVisibleThread(rows: CommentRow[]): PublicComment[] {
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const roots = new Map(sorted.filter((row) => row.parentId === null).map((row) => [row.id, row]));
  const attached = new Map<string, PublicComment>();
  const result: PublicComment[] = [];

  for (const row of sorted) {
    if (row.parentId !== null || row.rootId !== row.id || !rowIsVisible(row, row)) continue;
    const dto = toPublicComment(row);
    attached.set(row.id, dto);
    result.push(dto);
  }

  const pending = sorted.filter((row) => row.parentId !== null);
  for (let pass = 0; pass < rows.length && pending.length; pass += 1) {
    let changed = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const row = pending[index];
      const parent = attached.get(row.parentId as string);
      const root = roots.get(row.rootId);
      if (!parent || !rowIsVisible(row, root)) continue;
      const dto = toPublicComment(row);
      parent.replies.push(dto);
      attached.set(row.id, dto);
      pending.splice(index, 1);
      changed = true;
    }
    if (!changed) break;
  }

  const sortReplies = (nodes: PublicComment[]) => {
    for (const node of nodes) {
      node.replies.sort((a, b) => {
        const aRow = sorted.find((row) => row.id === a.id)!;
        const bRow = sorted.find((row) => row.id === b.id)!;
        return aRow.createdAt - bRow.createdAt || a.id.localeCompare(b.id);
      });
      sortReplies(node.replies);
    }
  };
  sortReplies(result);
  return result;
}

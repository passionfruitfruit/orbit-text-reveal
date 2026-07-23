import assert from 'node:assert/strict';
import test from 'node:test';
import { paginateContent, toPublicContent } from '../server/content.ts';

const item = (id, sortOrder, publishedAt, visible = true) => ({
  id, platform: 'github', title: id, summary: '', url: `https://example.com/${id}`,
  imageUrl: null, publishedAt, externalUpdatedAt: null, statsJson: '{"stars":3}',
  visible, sortOrder, sourceMissing: false, contact: 'never public',
});

test('mixed content is public-only, stable, and limited to ten items per page', () => {
  const rows = [item('b', 2, 100), item('c', 1, 100), item('a', 1, 100), item('hidden', 0, 200, false)];
  const result = paginateContent(rows, 1, 10);
  assert.deepEqual(result.items.map(({ id }) => id), ['a', 'c', 'b']);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 10, totalItems: 3, totalPages: 1, hasPrevious: false, hasNext: false });
});

test('page size is capped at ten and public DTO exposes normalized stats only', () => {
  const rows = Array.from({ length: 12 }, (_, index) => item(String(index), index, index));
  const result = paginateContent(rows, 2, 99);
  assert.equal(result.items.length, 2);
  const dto = toPublicContent(item('x', 1, 2));
  assert.deepEqual(dto.stats, { stars: 3 });
  assert.equal('contact' in dto, false);
  assert.equal('visible' in dto, false);
});

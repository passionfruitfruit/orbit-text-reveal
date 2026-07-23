import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const siteSettings = sqliteTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sourceAccounts = sqliteTable('source_accounts', {
  id: text('id').primaryKey(),
  platform: text('platform', { enum: ['bilibili', 'github'] }).notNull(),
  account: text('account').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastAttemptAt: integer('last_attempt_at'),
  lastSuccessAt: integer('last_success_at'),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('source_platform_account_idx').on(table.platform, table.account),
  index('source_enabled_idx').on(table.enabled),
]);

export const blogPosts = sqliteTable('blog_posts', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['internal', 'external'] }).notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  markdown: text('markdown'),
  externalUrl: text('external_url'),
  coverUrl: text('cover_url'),
  publishedAt: integer('published_at').notNull(),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const contentItems = sqliteTable('content_items', {
  id: text('id').primaryKey(),
  platform: text('platform', { enum: ['bilibili', 'github', 'blog'] }).notNull(),
  externalId: text('external_id'),
  sourceId: text('source_id').references(() => sourceAccounts.id, { onDelete: 'set null' }),
  blogId: text('blog_id').references(() => blogPosts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url'),
  publishedAt: integer('published_at').notNull(),
  externalUpdatedAt: integer('external_updated_at'),
  statsJson: text('stats_json'),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  sourceMissing: integer('source_missing', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('content_platform_external_idx').on(table.platform, table.externalId),
  uniqueIndex('content_blog_idx').on(table.blogId),
  index('content_public_order_idx').on(table.visible, table.sortOrder, table.publishedAt, table.id),
  index('content_source_idx').on(table.sourceId, table.sourceMissing),
]);

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  rootId: text('root_id').notNull(),
  nickname: text('nickname').notNull(),
  body: text('body').notNull(),
  contact: text('contact'),
  visitorAllowsPublic: integer('visitor_allows_public', { mode: 'boolean' }).notNull().default(false),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
  authorRole: text('author_role', { enum: ['visitor', 'owner'] }).notNull().default('visitor'),
  deletedAt: integer('deleted_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('comments_root_parent_idx').on(table.rootId, table.parentId, table.createdAt),
  index('comments_moderation_idx').on(table.approved, table.deletedAt, table.createdAt),
]);

export const adminSessions = sqliteTable('admin_sessions', {
  tokenDigest: text('token_digest').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
}, (table) => [index('admin_sessions_expires_idx').on(table.expiresAt)]);

export const submissionLimits = sqliteTable('submission_limits', {
  keyDigest: text('key_digest').notNull(),
  kind: text('kind').notNull(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.keyDigest, table.kind, table.windowStart] }),
  index('submission_limits_window_idx').on(table.windowStart),
]);

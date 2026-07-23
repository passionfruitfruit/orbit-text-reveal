import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaUrl = new URL('../db/schema.ts', import.meta.url);
const migrationUrl = new URL('../drizzle/0000_personal_site.sql', import.meta.url);

test('schema declares every durable record required by the site', async () => {
  const source = await readFile(schemaUrl, 'utf8');
  for (const table of [
    'site_settings',
    'source_accounts',
    'content_items',
    'blog_posts',
    'comments',
    'admin_sessions',
    'submission_limits',
  ]) {
    assert.ok(source.includes(`'${table}'`), `schema missing ${table}`);
  }
});

test('migration creates visibility, ordering, session, and ancestor indexes', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  for (const fragment of [
    'CREATE TABLE `site_settings`',
    'CREATE TABLE `source_accounts`',
    'CREATE TABLE `content_items`',
    'CREATE TABLE `blog_posts`',
    'CREATE TABLE `comments`',
    'CREATE TABLE `admin_sessions`',
    'CREATE TABLE `submission_limits`',
    'content_public_order_idx',
    'comments_root_parent_idx',
    'admin_sessions_expires_idx',
  ]) {
    assert.ok(sql.includes(fragment), `migration missing ${fragment}`);
  }
});

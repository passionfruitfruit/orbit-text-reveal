import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('Sites runtime declares the logical D1 binding', async () => {
  const hosting = JSON.parse(await read('.openai/hosting.json'));
  assert.match(hosting.project_id, /^appgprj_[a-f0-9]+$/);
  assert.equal(hosting.d1, 'DB');
  assert.equal(hosting.r2, null);
});

test('Sites runtime uses the bundled Vinext worker and packaging plugin', async () => {
  assert.match(await read('worker/index.ts'), /vinext\/server\/app-router-entry/);
  assert.match(await read('vite.config.ts'), /sites\(\)/);
  assert.match(await read('build/sites-vite-plugin.ts'), /dist["'],\s*["']\.openai/);
});

test('build and development commands synchronize the legacy Orbit assets', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.match(packageJson.scripts.dev, /sync:legacy/);
  assert.match(packageJson.scripts.build, /sync:legacy/);
  const syncSource = await read('scripts/sync-legacy-assets.mjs');
  for (const required of ['main.js', 'config.js', 'src', 'assets/platforms']) {
    assert.ok(syncSource.includes(required), `missing legacy asset: ${required}`);
  }
  assert.match(syncSource, /public["'],\s*["']orbit/);
});

test('Vinext owns development routes instead of Vite serving the legacy root index', async () => {
  const viteSource = await read('vite.config.ts');
  assert.match(viteSource, /appType:\s*["']custom["']/);
  assert.match(
    viteSource,
    /assets:\s*\{\s*run_worker_first:\s*\[\s*["']\/["'],\s*["']\/admin["'],\s*["']\/api\/\*["'],\s*["']\/blog\/\*["']\s*\]\s*\}/,
  );
});

test('toolchain is pinned to the Node 22 LTS line used by Vinext', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(packageJson.engines.node, '>=22.17 <23');
  assert.equal((await read('.nvmrc')).trim(), '22.17.0');
});

test('PostCSS does not load the unused Tailwind plugin', async () => {
  assert.doesNotMatch(await read('postcss.config.mjs'), /tailwindcss/);
});

test('operational documentation covers the public site, admin, and private runtime values', async () => {
  const readme = await read('README.md');
  for (const required of ['/admin', 'ADMIN_PASSWORD', 'RATE_LIMIT_SALT', 'npm run dev', 'npm run build']) {
    assert.ok(readme.includes(required), `README missing ${required}`);
  }
  const guide = await read('CONFIG_GUIDE.md');
  assert.match(guide, /统一后台/);
  assert.match(guide, /平台入口/);
});

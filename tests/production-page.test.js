import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function productionSource() {
  return readFile(new URL('../index.html', import.meta.url), 'utf8').catch(() => '');
}

test('production page contains the component host', async () => {
  const source = await productionSource();
  assert.match(source, /<orbit-text-reveal\b/);
});

for (const forbidden of ['dev-app', 'textarea', 'Export configuration', '导出配置']) {
  test(`production page excludes ${forbidden}`, async () => {
    const source = await productionSource();
    assert.doesNotMatch(source, new RegExp(forbidden));
  });
}

test('README documents component-level CSS custom property overrides', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const variable of [
    '--orbit-font-family', '--orbit-font-size', '--orbit-font-weight',
    '--orbit-text-color', '--orbit-ball-color', '--orbit-ball-size',
    '--orbit-ball-gap', '--orbit-background'
  ]) {
    assert.ok(readme.includes(variable), `README missing ${variable}`);
  }
});

test('README documents arbitrary host placement and continuation motion', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /motion\.continuationEasing/);
  assert.match(readme, /position:\s*absolute/);
  assert.match(readme, /rotate\(/);
  assert.match(readme, /transform-origin/);
});

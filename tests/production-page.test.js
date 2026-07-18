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

test('local preview server binds explicitly to IPv4 loopback', async () => {
  const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts.serve, /--bind 127\.0\.0\.1/);
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /http:\/\/127\.0\.0\.1:4173\/index\.html/);
  assert.doesNotMatch(readme, /http:\/\/localhost:4173/);
});

test('base.css declares continuous fluid stage width and font size', async () => {
  const css = await readFile(new URL('../src/base.css', import.meta.url), 'utf8');
  assert.match(css, /--orbit-stage-width:\s*clamp\(\s*40vw,\s*calc\(26\.9230769vw \+ 23\.2478632vh\),\s*77\.7777778vw\s*\)/s);
  assert.match(css, /--orbit-font-size:\s*clamp\(19px,\s*calc\(2\.431891vw \+ 1\.6025641vh\),\s*64px\)/s);
  assert.match(css, /--orbit-page-background:\s*#f7f2ef/);
  assert.match(css, /--orbit-stage-height:\s*100svh;/);
  assert.match(css, /min-height:\s*100svh;\s*min-height:\s*100dvh;/s);
  assert.match(
    css,
    /height:\s*min\(var\(--orbit-stage-height\),\s*100svh\);\s*height:\s*min\(var\(--orbit-stage-height\),\s*100dvh\);/s
  );
  assert.doesNotMatch(css, /calc\(100vw - 2rem\)/);
  assert.doesNotMatch(css, /32\.4444444vw \+ 145\.0666667px/);
  assert.doesNotMatch(css, /2\.8125vw \+ 10px/);
});
test('production page declares semantic platform structure', async () => {
   const source = await productionSource();
   assert.match(source, /<main\b/);
   assert.match(source, /<section\b[^>]*class="intro-sequence"/);
   assert.match(source, /class="intro-scene"/);
   assert.match(source, /id="platform-grid"/);
   assert.match(source, /id="platform-heading"/);
   assert.match(source, /<h1\b[^>]*id="platform-heading"/);
});

test('production page uses the current main cache key and preserves Orbit cache key', async () => {
  const source = await productionSource();
  assert.match(source, /base\.css\?v=20260718-4/);
  assert.match(source, /main\.js\?v=20260718-3/);
  assert.doesNotMatch(source, /main\.js\?v=20260718-2/);
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(main, /orbit-text-reveal\.js\?v=20260718-2/);
});

test('production CSS keeps mobile cards reachable and uses fixed platform heading sizes', async () => {
  const css = await readFile(new URL('../src/base.css', import.meta.url), 'utf8');
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*clip;[^}]*overflow-y:\s*auto;/s);
  assert.doesNotMatch(css, /html,\s*\nbody\s*\{[^}]*overflow/s);
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-(?:x|y):/s);
  assert.match(css, /\.intro-scene\s*\{[^}]*overflow:\s*visible/s);
  assert.match(css, /\.platforms__heading\s*\{[^}]*font-size:\s*26px/s);
  assert.match(css, /@media\s*\(max-width:\s*599px\)[\s\S]*?\.platforms__heading\s*\{[^}]*font-size:\s*22px/s);
  assert.match(css, /--platform-card-opacity/);
  assert.match(css, /--platform-card-y/);
});

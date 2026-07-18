import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceFile = (path) => new URL(`../${path}`, import.meta.url);
const sourceOf = (path) => readFile(workspaceFile(path), 'utf8').catch(() => '');

test('production config contains the exact six-text sequence and approved colors', async () => {
  const configUrl = workspaceFile('config.js');
  const exists = await access(configUrl).then(() => true, () => false);
  assert.equal(exists, true, 'config.js must exist');

  const { animationConfig } = await import(configUrl.href);
  const expectedTexts = [
    'hello:)',
    '欢迎！',
    '粉骨碎身浑不怕\n要留清白在人间',
    '真的英雄：不是打败世界的傲慢，而是勇敢的守住内心的天真',
    '你来这里干嘛\\（≧▽≦）/',
    '（别光看屏幕啦！'
  ];

  assert.deepEqual(animationConfig.texts.map(({ text }) => text), expectedTexts);
  assert.deepEqual(
    animationConfig.texts.map(({ text }) => (text.match(/\n/g) ?? []).length),
    [0, 0, 1, 0, 0, 0]
  );
  assert.ok(animationConfig.texts.every(({ holdMs }) => Number.isFinite(holdMs)));
  assert.equal(animationConfig.style.background, '#f7f2ef');
  assert.equal(animationConfig.style.textColor, '#000000');
  assert.equal(animationConfig.style.ballColor, '#000000');
  assert.equal(animationConfig.motion.easing, 'cubic-bezier(0.333333, 0, 0.666667, 0.5)');
  assert.equal(animationConfig.motion.continuationEasing, 'linear');
  assert.equal(animationConfig.motion.exitEasing, 'cubic-bezier(0.333333, 0.5, 0.666667, 1)');
  assert.equal(animationConfig.motion.singleLineEasing, 'cubic-bezier(0.333333, 0, 0.666667, 1)');
});

test('stage fitting contains a long first manual line followed by a short last line', async () => {
  const fitterUrl = workspaceFile('src/stage-layout.js');
  const exists = await access(fitterUrl).then(() => true, () => false);
  assert.equal(exists, true, 'stage-layout.js must exist');

  const { fitTextLayoutToStage } = await import(fitterUrl.href);
  const { computeGeometry } = await import(workspaceFile('src/geometry.js').href);
  const layoutModule = await import(workspaceFile('src/text-layout.js').href);
  assert.equal(
    typeof fitTextLayoutToStage,
    'function',
    'render layout must expose an injectable fitting calculation'
  );

  const text = 'abcdefghijklmnop\nz';
  const fitted = fitTextLayoutToStage({
    text,
    layout: {
      maxWidth: 160,
      scale: 1,
      fontSize: 60,
      lineHeight: 1.2,
      ballSizeEm: 0.8,
      ballGapEm: 0.1
    },
    availableWidth: 360,
    availableHeight: 240,
    centerX: 180,
    centerY: 120,
    safeMargin: 16,
    measure: (value) => layoutModule.segmentGraphemes(value).length * 10
  });
  const geometry = computeGeometry({
    lines: fitted.lines,
    centerX: 180,
    centerY: 120,
    lineHeightPx: fitted.lineHeightPx,
    ballSize: fitted.ballSize,
    ballGap: fitted.ballGap
  });
  const minX = 16;
  const maxX = 344;

  assert.ok(fitted.wrapWidth <= 160, 'the configured wrap width is never exceeded');
  assert.equal(fitted.lines.slice(0, -1).map(({ text: line }) => line).join(''), 'abcdefghijklmnop');
  assert.equal(fitted.lines.at(-1).text, 'z', 'the explicit newline keeps the short manual line last');
  for (const line of geometry.lines) {
    assert.ok(line.x >= minX && line.x + line.width <= maxX, `text line ${line.index} is in bounds`);
    for (const point of [line.start, line.end]) {
      assert.ok(point.x - geometry.ballSize / 2 >= minX, `ball left edge for line ${line.index} is in bounds`);
      assert.ok(point.x + geometry.ballSize / 2 <= maxX, `ball right edge for line ${line.index} is in bounds`);
    }
  }
});

test('stage fitting applies layout scale exactly once', async () => {
  const fitterUrl = workspaceFile('src/stage-layout.js');
  const exists = await access(fitterUrl).then(() => true, () => false);
  assert.equal(exists, true, 'stage-layout.js must exist');
  const { fitTextLayoutToStage } = await import(fitterUrl.href);

  const base = {
    text: 'abcd',
    availableWidth: 1600,
    availableHeight: 400,
    centerX: 800,
    centerY: 200,
    safeMargin: 16
  };
  const layout = {
    maxWidth: 160,
    fontSize: 20,
    lineHeight: 1.2,
    ballSizeEm: 0.8,
    ballGapEm: 0.1
  };
  const normal = fitTextLayoutToStage({
    ...base,
    layout: { ...layout, scale: 1 },
    measure: (value) => value.length * 10
  });
  const doubled = fitTextLayoutToStage({
    ...base,
    layout: { ...layout, scale: 2 },
    measure: (value) => value.length * 20
  });

  assert.equal(doubled.wrapWidth, normal.wrapWidth * 2);
  assert.equal(doubled.lines[0].width, normal.lines[0].width * 2);
  assert.equal(doubled.lineHeightPx, normal.lineHeightPx * 2);
  assert.equal(doubled.ballSize, normal.ballSize * 2);
  assert.equal(doubled.ballGap, normal.ballGap * 2);
});

test('stage fitting auto-scales oversized graphemes and never returns failed geometry', async () => {
  const { fitTextLayoutToStage } = await import(workspaceFile('src/stage-layout.js').href);
  const fitted = fitTextLayoutToStage({
    text: '巨\nz',
    layout: {
      maxWidth: 680,
      fontSize: 60,
      lineHeight: 1.2,
      ballSizeEm: 0.8,
      ballGapEm: 0.1,
      scale: 2
    },
    availableWidth: 120,
    availableHeight: 180,
    centerX: 60,
    centerY: 90,
    safeMargin: 16,
    measure: (value) => Array.from(value).reduce((width, grapheme) => (
      width + (grapheme === '巨' ? 240 : 10)
    ), 0)
  });
  const minX = fitted.resolvedSafeMargin;
  const maxX = 120 - fitted.resolvedSafeMargin;

  assert.equal(fitted.fits, true);
  assert.ok(fitted.autoFitScale > 0 && fitted.autoFitScale < 1);
  assert.equal(fitted.resolvedScale, 2 * fitted.autoFitScale);
  for (const line of fitted.geometry.lines) {
    assert.ok(line.x >= minX && line.x + line.width <= maxX);
    for (const point of [line.start, line.end]) {
      assert.ok(point.x - fitted.geometry.ballSize / 2 >= minX);
      assert.ok(point.x + fitted.geometry.ballSize / 2 <= maxX);
    }
  }
});

test('component refuses to render a failed stage fit', async () => {
  const source = await sourceOf('src/orbit-text-reveal.js');
  assert.match(source, /if\s*\(!fittedLayout\.fits\)\s*throw/);
});

test('non-positive requested safe area falls back to the full stage with visible geometry', async () => {
  const { fitTextLayoutToStage } = await import(workspaceFile('src/stage-layout.js').href);
  const fitted = fitTextLayoutToStage({
    text: '巨\nz',
    layout: {
      maxWidth: 680,
      fontSize: 60,
      lineHeight: 1.2,
      ballSizeEm: 0.8,
      ballGapEm: 0.1,
      scale: 2
    },
    availableWidth: 30,
    availableHeight: 60,
    centerX: 15,
    centerY: 30,
    safeMargin: 16,
    measure: (value) => Array.from(value).length * 240
  });

  assert.equal(fitted.resolvedSafeMargin, 0);
  assert.equal(fitted.fits, true);
  assert.ok(fitted.geometry.ballSize > 0);
  assert.deepEqual(fitted.geometry.center, { x: 15, y: 30 });
});

test('bootstrap order records fonts-ready load-component assign-orbit-config render-platforms start-intro show-orbit', async () => {
  const source = await sourceOf('main.js');
  assert.match(source, /export async function startProductionPage/);
  const { startProductionPage } = await import(workspaceFile('main.js').href);
  const calls = [];
  const host = {
    set config(value) {},
    set hidden(value) {}
  };
  const elements = {
    'orbit-text-reveal': host,
    '.intro-sequence': { getBoundingClientRect: () => ({ top: 0 }), scrollHeight: 2000 },
    '.platforms': { inert: false, setAttribute() {} },
    '#platform-grid': { textContent: '' }
  };
  const documentRef = {
    fonts: { ready: Promise.resolve() },
    documentElement: { style: { setProperty: () => {} } },
    querySelector: (sel) => elements[sel] ?? null
  };
  await startProductionPage({
    documentRef,
    config: { style: { background: '#eee' } },
    loadComponent: async () => {},
    renderCards: async () => { return { destroy() {} }; },
    createController: () => { return { start() {}, destroy() {} }; },
    recordEvent: (name) => calls.push(name)
  });
  assert.deepEqual(calls, ['fonts-ready', 'load-component', 'assign-orbit-config', 'render-platforms', 'start-intro', 'show-orbit']);
});
test('base CSS exposes stage size and page transform variables', async () => {
  const source = await sourceOf('src/base.css');
  const requiredVariables = [
    '--orbit-stage-width',
    '--orbit-stage-height',
    '--orbit-font-size',
    '--orbit-page-x',
    '--orbit-page-y',
    '--orbit-page-scale'
  ];
  for (const variable of requiredVariables) {
    assert.match(source, new RegExp(variable));
  }
  assert.doesNotMatch(source, /calc\(100vw - 2rem\)/);
});
 test('platform config contains the exact three entries with correct ids URLs and actions', async () => {
   const { platformConfig } = await import(workspaceFile('config.js').href);
   assert.equal(platformConfig.length, 3);
   assert.deepEqual(
     platformConfig.map((e) => e.id),
     ['bilibili', 'qq', 'email']
   );
   assert.equal(platformConfig[0].action.type, 'link');
   assert.equal(platformConfig[0].action.value, 'https://space.bilibili.com/496633495?');
   assert.equal(platformConfig[0].action.newTab, true);
   assert.equal(platformConfig[0].iconSide, 'left');
   assert.equal(platformConfig[0].icon, './assets/platforms/bilibili.svg');

   assert.equal(platformConfig[1].action.type, 'link');
   assert.equal(platformConfig[1].action.value, 'https://user.qzone.qq.com/2533194273');
   assert.equal(platformConfig[1].action.newTab, true);
   assert.equal(platformConfig[1].iconSide, 'right');
   assert.equal(platformConfig[1].icon, './assets/platforms/tencentqq.svg');

   assert.equal(platformConfig[2].action.type, 'copy');
   assert.equal(platformConfig[2].action.value, 'mail@zhang.jx.cn');
   assert.equal(platformConfig[2].action.newTab, false);
   assert.equal(platformConfig[2].iconSide, 'left');
   assert.equal(platformConfig[2].icon, './assets/platforms/mail.svg');

   for (const entry of platformConfig) {
     const assetUrl = workspaceFile(entry.icon.replace(/^\.\//, ''));
     const exists = await access(assetUrl).then(() => true, () => false);
     assert.equal(exists, true, `${entry.id} icon asset must exist at ${entry.icon}`);
   }
 });

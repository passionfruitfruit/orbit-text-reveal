import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceFile = (path) => new URL(`../${path}`, import.meta.url);
const sourceOf = (path) => readFile(workspaceFile(path), 'utf8').catch(() => '');

test('central config exports single-line, manual-wrap, and automatic-wrap examples', async () => {
  const configUrl = workspaceFile('config.js');
  const exists = await access(configUrl).then(() => true, () => false);
  assert.equal(exists, true, 'config.js must exist');

  const { animationConfig } = await import(configUrl.href);
  assert.equal(animationConfig.texts.length, 3);
  assert.equal(animationConfig.texts[0].text.includes('\n'), false);
  assert.equal(animationConfig.texts[1].text.includes('\n'), true);
  assert.equal(animationConfig.texts[2].text.includes('\n'), false);
  assert.ok(animationConfig.texts[2].text.length > animationConfig.texts[0].text.length);
  assert.ok(animationConfig.texts.every(({ holdMs }) => Number.isFinite(holdMs)));
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

test('module entry strictly waits for fonts before loading, assigning, and starting', async () => {
  const source = await sourceOf('main.js');
  assert.match(source, /export async function startProductionPage/);

  const { startProductionPage } = await import(workspaceFile('main.js').href);
  const events = [];
  let resolveFonts;
  const fontsReady = new Promise((resolve) => { resolveFonts = resolve; });
  const host = {
    set config(value) { events.push(['config', value]); },
    set hidden(value) { events.push(['hidden', value]); }
  };
  const documentRef = {
    fonts: { ready: fontsReady },
    documentElement: { style: { setProperty: (...args) => events.push(['style', ...args]) } },
    querySelector: () => host
  };
  const config = { style: { background: '#eee' } };
  const started = startProductionPage({
    documentRef,
    config,
    loadComponent: async () => { events.push(['component-loaded']); }
  });

  await Promise.resolve();
  assert.deepEqual(events, [], 'nothing starts while fonts are pending');
  resolveFonts();
  await started;
  assert.deepEqual(events, [
    ['component-loaded'],
    ['style', '--orbit-page-background', '#eee'],
    ['config', config],
    ['hidden', false]
  ]);
});

test('base CSS exposes stage size and page transform variables', async () => {
  const source = await sourceOf('src/base.css');
  for (const variable of [
    '--orbit-stage-width',
    '--orbit-stage-height',
    '--orbit-page-x',
    '--orbit-page-y',
    '--orbit-page-scale'
  ]) {
    assert.match(source, new RegExp(variable));
  }
  assert.match(source, /@media\s*\(max-width:/);
});

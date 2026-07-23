import assert from 'node:assert/strict';
import test from 'node:test';
import * as productionModule from '../main.js';
import { createSerialTaskQueue } from '../src/serial-task-queue.js';

const { startProductionPage } = productionModule;

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function createBootstrapHarness() {
  const renderCalls = [];
  const views = [];
  const destroyCounts = { controller: 0, host: 0 };
  const controller = {
    refreshCardsCalls: 0,
    refreshCards() { this.refreshCardsCalls += 1; },
    destroy() { destroyCounts.controller += 1; },
  };
  const host = {
    config: null,
    hidden: true,
    destroy() { destroyCounts.host += 1; },
  };
  const platforms = { inert: false, setAttribute() {}, parentElement: { scrollHeight: 800 } };
  const elements = {
    'orbit-text-reveal': host,
    '.intro-sequence': { getBoundingClientRect: () => ({ top: 0 }), scrollHeight: 1320 },
    '.platforms': platforms,
    '#platform-grid': { textContent: '' },
  };
  const documentRef = {
    fonts: { ready: Promise.resolve() },
    documentElement: { style: { setProperty() {} } },
    querySelector(selector) { return elements[selector] ?? null; },
  };
  const renderCards = (grid, entries) => {
    renderCalls.push(entries);
    const view = {
      destroyCalls: 0,
      destroyOptions: [],
      destroy(options) { this.destroyCalls += 1; this.destroyOptions.push(options); },
    };
    views.push(view);
    return view;
  };
  const baseConfig = { style: { background: '#eee' }, texts: [{ text: 'fallback' }] };
  const basePlatforms = [{
    id: 'fallback',
    icon: './assets/platforms/mail.svg',
    action: { type: 'copy', value: 'fallback' },
  }];

  return {
    options: {
      documentRef,
      windowRef: {},
      config: baseConfig,
      platformData: basePlatforms,
      loadComponent: async () => {},
      renderCards,
      createController: () => controller,
    },
    baseConfig,
    controller,
    destroyCounts,
    host,
    renderCalls,
    views,
  };
}

test('late production data replaces fallback config and refreshes cards', async () => {
  const harness = createBootstrapHarness();
  const result = await startProductionPage(harness.options);
  const remoteOrbit = { style: { background: '#f7f2ef' }, texts: [{ text: 'remote' }] };
  const remotePlatforms = [{
    id: 'remote',
    icon: './assets/platforms/bilibili.svg',
    action: { type: 'link', value: 'https://example.com' },
  }];

  assert.equal(harness.host.config, harness.baseConfig);
  assert.equal(await result.updateData({ config: remoteOrbit, platformData: remotePlatforms }), true);
  assert.equal(harness.host.config, remoteOrbit);
  assert.equal(harness.renderCalls.length, 2);
  assert.equal(harness.renderCalls.at(-1)[0].id, 'remote');
  assert.equal(harness.views[0].destroyCalls, 1);
  assert.deepEqual(harness.views[0].destroyOptions, [{ clear: false }]);
  assert.equal(harness.controller.refreshCardsCalls, 1);
});

test('production cleanup is idempotent and blocks late updates', async () => {
  const harness = createBootstrapHarness();
  const result = await startProductionPage(harness.options);
  const configBeforeDestroy = harness.host.config;

  result.destroy();
  result.destroy();
  assert.equal(await result.updateData({
    config: { style: { background: '#000' } },
    platformData: [],
  }), false);

  assert.equal(harness.destroyCounts.controller, 1);
  assert.equal(harness.destroyCounts.host, 1);
  assert.equal(harness.views[0].destroyCalls, 1);
  assert.equal(harness.host.config, configBeforeDestroy);
  assert.equal(harness.renderCalls.length, 1);
});

test('homepage startup queue finishes stale cleanup before a remount starts', async () => {
  const queue = createSerialTaskQueue();
  const firstGate = deferred();
  const events = [];

  const first = queue.run(async () => {
    events.push('first-start');
    await firstGate.promise;
    events.push('first-cleanup');
  });
  const second = queue.run(async () => {
    events.push('second-start');
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['first-start']);
  firstGate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first-start', 'first-cleanup', 'second-start']);
});

test('newer platform data wins when async renders resolve out of order', async () => {
  const harness = createBootstrapHarness();
  const originalRender = harness.options.renderCards;
  const oldGate = deferred();
  const newGate = deferred();
  const pendingViews = new Map();
  harness.options.renderCards = (grid, entries) => {
    const id = entries[0]?.id;
    if (id === 'old' || id === 'new') {
      const view = {
        id,
        destroyCalls: 0,
        destroy() { this.destroyCalls += 1; },
      };
      pendingViews.set(id, view);
      return (id === 'old' ? oldGate.promise : newGate.promise).then(() => view);
    }
    return originalRender(grid, entries);
  };
  const result = await startProductionPage(harness.options);

  const oldUpdate = result.updateData({ platformData: [{
    id: 'old', icon: './assets/platforms/mail.svg', action: { type: 'copy', value: 'old' },
  }] });
  const newUpdate = result.updateData({ platformData: [{
    id: 'new', icon: './assets/platforms/mail.svg', action: { type: 'copy', value: 'new' },
  }] });

  newGate.resolve();
  assert.equal(await newUpdate, true);
  oldGate.resolve();
  assert.equal(await oldUpdate, false);
  assert.equal(result.platformView.id, 'new');
  assert.equal(pendingViews.get('old').destroyCalls, 1);
  assert.equal(pendingViews.get('new').destroyCalls, 0);
  assert.equal(harness.controller.refreshCardsCalls, 1);
});

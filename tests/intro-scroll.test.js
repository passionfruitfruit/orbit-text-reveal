 import assert from 'node:assert/strict';
 import test from 'node:test';
import { clampProgress, computeIntroFrame, createIntroScrollController } from '../src/intro-scroll.js';

 test('clamps intro progress and reaches exact Orbit endpoints', () => {
   assert.equal(clampProgress(-1), 0);
   assert.equal(clampProgress(2), 1);
   const start = computeIntroFrame(0, { width: 1920, height: 1080 });
   const end = computeIntroFrame(1, { width: 1920, height: 1080 });
   assert.equal(start.orbitScale, 1);
   assert.equal(start.orbitOffsetY, 0);
   assert.equal(end.orbitScale, 0.65);
   assert.equal(end.orbitOffsetY, 216 - 540);
 });

test('platforms fade after 0.62 and overshoot before settling', () => {
   assert.equal(computeIntroFrame(0.61, { width: 1280, height: 800 }).platformOpacity, 0);
   assert.ok(computeIntroFrame(0.8, { width: 1280, height: 800 }).platformOpacity > 0);
   assert.ok(computeIntroFrame(0.9, { width: 1280, height: 800 }).platformTranslateY < 0);
   assert.equal(computeIntroFrame(1, { width: 1280, height: 800 }).platformTranslateY, 0);
});

function createControllerHarness({ reduced = false } = {}) {
  const listeners = new Map();
  const rafs = new Map();
  const timers = new Map();
  const scrollCalls = [];
  let nextRaf = 1;
  let nextTimer = 1;
  let sequenceTop = 0;
  const windowRef = {
    innerWidth: 1920,
    innerHeight: 1080,
    matchMedia: () => ({
      matches: reduced,
      addEventListener(type, listener) { this.listener = listener; },
      removeEventListener(type, listener) { if (this.listener === listener) this.listener = null; }
    }),
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    requestAnimationFrame(callback) { const id = nextRaf++; rafs.set(id, callback); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    scrollTo(options) { scrollCalls.push(options); },
    flushRaf() { for (const [id, callback] of [...rafs]) { rafs.delete(id); callback(); } },
    runTimer() { const [entry] = timers; if (!entry) return; timers.delete(entry[0]); entry[1].callback(); }
  };
  const host = { style: { values: {}, setProperty(name, value) { this.values[name] = value; } } };
  const platforms = {
    style: { values: {}, setProperty(name, value) { this.values[name] = value; } },
    parentElement: { style: { setProperty() {} } },
    inert: false,
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    children: []
  };
  const sequence = { scrollHeight: 2080, getBoundingClientRect: () => ({ top: sequenceTop }) };
  return {
    windowRef, host, platforms, sequence, listeners, rafs, timers, scrollCalls,
    setSequenceTop(value) { sequenceTop = value; }
  };
}

test('controller initializes platform section hidden and writes variables on owned nodes', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf();
  assert.equal(harness.host.style.values['--orbit-page-scale'], '1');
  assert.equal(harness.platforms.style.values['--platform-opacity'], '0');
  assert.equal(harness.platforms.style.values['--platform-translate-y'], '24px');
  assert.equal(harness.platforms.inert, true);
  assert.equal(harness.platforms.attrs['aria-hidden'], 'true');
  controller.destroy();
  assert.equal(harness.listeners.size, 0);
  assert.equal(harness.rafs.size, 0);
});

test('controller applies reduced-motion translation directly and staggers cards reversibly', () => {
  const harness = createControllerHarness({ reduced: true });
  const cards = [0, 1, 2].map(() => ({ style: { values: {}, setProperty(name, value) { this.values[name] = value; } } }));
  harness.platforms.children = cards;
  harness.sequence.getBoundingClientRect = () => ({ top: -800 });
  const controller = createIntroScrollController({ ...harness, cards, settle: false });
  harness.windowRef.flushRaf();
  assert.ok(Math.abs(Number.parseFloat(harness.platforms.style.values['--platform-translate-y']) - 4.8) < 0.001);
  assert.ok(Number(cards[0].style.values['--platform-card-opacity']) > 0);
  assert.ok(Number(cards[2].style.values['--platform-card-opacity']) < Number(cards[0].style.values['--platform-card-opacity']));
  controller.destroy();
});

test('midpoint settle follows the most recent scroll direction', () => {
  const down = createControllerHarness();
  const downController = createIntroScrollController(down);
  down.windowRef.flushRaf();
  down.setSequenceTop(-500);
  down.listeners.get('scroll')();
  down.windowRef.flushRaf();
  down.windowRef.runTimer();
  assert.deepEqual(down.scrollCalls.at(-1), { top: 1000, behavior: 'smooth' });
  downController.destroy();

  const up = createControllerHarness();
  up.setSequenceTop(-700);
  const upController = createIntroScrollController(up);
  up.windowRef.flushRaf();
  up.setSequenceTop(-500);
  up.listeners.get('scroll')();
  up.windowRef.flushRaf();
  up.windowRef.runTimer();
  assert.deepEqual(up.scrollCalls.at(-1), { top: 0, behavior: 'smooth' });
  upController.destroy();
});

test('programmatic settle scrolls continue until new user input cancels them', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController(harness);
  harness.windowRef.flushRaf();
  harness.setSequenceTop(-600);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf();
  harness.windowRef.runTimer();
  assert.deepEqual(harness.scrollCalls, [{ top: 1000, behavior: 'smooth' }]);

  harness.setSequenceTop(-650);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf();
  assert.deepEqual(harness.scrollCalls, [{ top: 1000, behavior: 'smooth' }]);

  harness.listeners.get('wheel')();
  assert.deepEqual(harness.scrollCalls.at(-1), { top: 650, behavior: 'auto' });
  controller.destroy();
  assert.equal(harness.listeners.size, 0);
});

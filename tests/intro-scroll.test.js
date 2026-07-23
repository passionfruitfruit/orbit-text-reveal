 import assert from 'node:assert/strict';
 import test from 'node:test';
import {
  advanceDampedProgress,
  clampProgress,
  computeIntroScrollGeometry,
  computeIntroFrame,
  createIntroScrollController
} from '../src/intro-scroll.js';

 test('clamps intro progress and reaches exact Orbit endpoints', () => {
   assert.equal(clampProgress(-1), 0);
   assert.equal(clampProgress(2), 1);
   const start = computeIntroFrame(0, { width: 1920, height: 1080 });
   const end = computeIntroFrame(1, { width: 1920, height: 1080 });
   assert.equal(start.orbitScale, 1);
   assert.ok(Math.abs(start.orbitOffsetY - (-37.8)) < 1e-9);
   assert.equal(end.orbitScale, 0.65);
   assert.equal(end.orbitOffsetY, 216 - 540);
 });

test('opening Orbit uses a modest responsive optical lift', () => {
  const desktop = computeIntroFrame(0, { width: 1280, height: 720 });
  const mobile = computeIntroFrame(0, { width: 430, height: 374 });

  assert.ok(Math.abs(desktop.orbitOffsetY - (-25.2)) < 1e-9);
  assert.ok(Math.abs(mobile.orbitOffsetY - (-13.09)) < 1e-9);
});

test('platform reveal starts at 0.45 and is complete by 0.75', () => {
   assert.equal(computeIntroFrame(0.45, { width: 1280, height: 863 }).platformOpacity, 0);
   assert.ok(computeIntroFrame(0.6, { width: 1280, height: 863 }).platformOpacity > 0);
   assert.equal(computeIntroFrame(0.75, { width: 1280, height: 863 }).platformOpacity, 1);
   assert.equal(computeIntroFrame(0.75, { width: 1280, height: 863 }).interactive, true);
   assert.ok(computeIntroFrame(0.84, { width: 1280, height: 863 }).platformTranslateY < 0);
   assert.equal(computeIntroFrame(1, { width: 1280, height: 863 }).platformTranslateY, 0);
});

test('damped progress is monotonic and frame-rate independent', () => {
  const oneFrame = advanceDampedProgress(0, 1, 16, 72);
  const firstHalf = advanceDampedProgress(0, 1, 8, 72);
  const twoHalves = advanceDampedProgress(firstHalf, 1, 8, 72);

  assert.ok(oneFrame > 0 && oneFrame < 1);
  assert.ok(twoHalves > firstHalf && twoHalves < 1);
  assert.ok(Math.abs(oneFrame - twoHalves) < 1e-12);
  assert.equal(advanceDampedProgress(0.99999, 1, 16, 72), 1);
});

test('intro geometry separates approved travel from tall-scene overflow', () => {
  assert.deepEqual(computeIntroScrollGeometry({
    viewportHeight: 374,
    sceneHeight: 828,
    sequenceHeight: 1348,
    travel: 520,
  }), {
    viewportHeight: 374,
    sceneHeight: 828,
    sequenceHeight: 1348,
    travel: 520,
    naturalOverflow: 454,
  });
});

test('intro geometry clamps invalid and undersized values', () => {
  assert.deepEqual(computeIntroScrollGeometry({
    viewportHeight: 800,
    sceneHeight: 600,
    sequenceHeight: 500,
    travel: -10,
  }), {
    viewportHeight: 800,
    sceneHeight: 800,
    sequenceHeight: 800,
    travel: 0,
    naturalOverflow: 0,
  });
});

function createControllerHarness({ reduced = false, innerHeight = 1080, sceneHeight = 1080, sequenceHeight = 2080 } = {}) {
  const listeners = new Map();
  const rafs = new Map();
  const timers = new Map();
  const scrollCalls = [];
  let nextRaf = 1;
  let nextTimer = 1;
  let sequenceTop = 0;
  let queriedCards = [];
  const media = {
    matches: reduced,
    addEventListener(type, listener) { this.listener = listener; },
    removeEventListener(type, listener) { if (this.listener === listener) this.listener = null; },
    setMatches(value) {
      this.matches = value;
      this.listener?.({ matches: value });
    }
  };
  const windowRef = {
    innerWidth: 1920,
    innerHeight,
    matchMedia: () => media,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    requestAnimationFrame(callback) { const id = nextRaf++; rafs.set(id, callback); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    scrollTo(options) { scrollCalls.push(options); sequenceTop = -options.top; },
    flushRaf(timestamp = 0) {
      for (const [id, callback] of [...rafs]) {
        rafs.delete(id);
        callback(timestamp);
      }
    },
    runTimer() { const [entry] = timers; if (!entry) return; timers.delete(entry[0]); entry[1].callback(); }
  };
  const host = { style: { values: {}, setProperty(name, value) { this.values[name] = value; } } };
  const platforms = {
    style: { values: {}, setProperty(name, value) { this.values[name] = value; } },
    parentElement: { scrollHeight: sceneHeight, style: { setProperty() {} } },
    inert: false,
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelectorAll() { return queriedCards; },
    children: []
  };
  const sequence = { scrollHeight: sequenceHeight, getBoundingClientRect: () => ({ top: sequenceTop }) };
  return {
    windowRef, host, platforms, sequence, listeners, rafs, timers, scrollCalls, media,
    setSequenceTop(value) { sequenceTop = value; },
    setQueriedCards(value) { queriedCards = value; }
  };
}

test('controller refreshes its card cache after platform DOM replacement', () => {
  const harness = createControllerHarness({ reduced: true });
  const createCard = () => ({
    writes: 0,
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
        if (name === '--platform-card-opacity') this.owner.writes += 1;
      },
      owner: null,
    },
  });
  const connectOwner = (card) => {
    card.style.owner = card;
    return card;
  };
  const removed = connectOwner(createCard());
  harness.setQueriedCards([removed]);
  harness.setSequenceTop(-1000);
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf();
  const removedWrites = removed.writes;

  const replacements = [connectOwner(createCard()), connectOwner(createCard()), connectOwner(createCard())];
  harness.setQueriedCards(replacements);
  controller.refreshCards();
  harness.windowRef.flushRaf();

  assert.equal(removed.writes, removedWrites);
  assert.deepEqual(
    replacements.map((card) => card.style.values['--platform-card-opacity']),
    ['1', '1', '1'],
  );
  controller.destroy();
});

test('tall platform scenes do not lengthen the approved intro motion', () => {
  const harness = createControllerHarness({
    reduced: true,
    innerHeight: 374,
    sceneHeight: 828,
    sequenceHeight: 1348,
  });
  harness.setSequenceTop(-520);
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf();

  assert.equal(harness.host.style.values['--orbit-page-scale'], '0.65');
  assert.equal(harness.platforms.style.values['--platform-opacity'], '1');
  controller.destroy();
});

test('controller resolves approved travel from the spacer when the scene height changes', () => {
  const harness = createControllerHarness({
    reduced: true,
    innerHeight: 700,
    sceneHeight: 1140,
    sequenceHeight: 1711,
  });
  harness.windowRef.getComputedStyle = (_element, pseudo) => ({
    height: pseudo === '::after' ? '595px' : '',
    getPropertyValue: () => 'clamp(520px, 85svh, 900px)',
  });
  harness.setSequenceTop(-297.5);
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf();

  assert.equal(harness.host.style.values['--orbit-page-scale'], '0.825');
  controller.destroy();
});

test('controller initializes platform section hidden and writes variables on owned nodes', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf();
  assert.equal(harness.host.style.values['--orbit-page-scale'], '1');
  assert.equal(harness.host.style.values['--orbit-stage-width'], '768px');
  assert.equal(harness.platforms.style.values['--platform-opacity'], '0');
  assert.equal(harness.platforms.style.values['--platform-translate-y'], '24px');
  assert.equal(harness.platforms.inert, true);
  assert.equal(harness.platforms.attrs['aria-hidden'], 'true');
  controller.destroy();
  assert.equal(harness.listeners.size, 0);
  assert.equal(harness.rafs.size, 0);
});

test('controller updates the stage width to the mobile 1/7/1 ratio on resize', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf();

  harness.windowRef.innerWidth = 320;
  harness.windowRef.innerHeight = 844;
  harness.listeners.get('resize')();
  harness.windowRef.flushRaf();

  assert.equal(
    Number.parseFloat(harness.host.style.values['--orbit-stage-width']),
    320 * (7 / 9),
  );
  controller.destroy();
});

test('controller damps sparse scroll updates across animation frames', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf(0);

  harness.setSequenceTop(-1000);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf(16);
  const firstScale = Number(harness.host.style.values['--orbit-page-scale']);
  assert.ok(firstScale < 1 && firstScale > 0.65);

  for (let timestamp = 32; timestamp <= 800; timestamp += 16) {
    harness.windowRef.flushRaf(timestamp);
  }
  assert.equal(harness.host.style.values['--orbit-page-scale'], '0.65');
  controller.destroy();
});

test('controller damping accounts for frame gaps longer than 64ms', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController({ ...harness, settle: false });
  harness.windowRef.flushRaf(0);
  harness.setSequenceTop(-1000);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf(16);

  const firstProgress = (1 - Number(harness.host.style.values['--orbit-page-scale'])) / 0.35;
  harness.windowRef.flushRaf(116);
  const expectedProgress = advanceDampedProgress(firstProgress, 1, 100, 72);
  const expectedScale = 1 - 0.35 * expectedProgress;

  assert.ok(Math.abs(Number(harness.host.style.values['--orbit-page-scale']) - expectedScale) < 1e-12);
  controller.destroy();
});

test('controller applies reduced-motion translation directly and staggers cards reversibly', () => {
  const harness = createControllerHarness({ reduced: true });
  const cards = [0, 1, 2].map(() => ({ style: { values: {}, setProperty(name, value) { this.values[name] = value; } } }));
  harness.platforms.children = cards;
  harness.sequence.getBoundingClientRect = () => ({ top: -600 });
  const controller = createIntroScrollController({ ...harness, cards, settle: false });
  harness.windowRef.flushRaf();
  assert.ok(Math.abs(Number.parseFloat(harness.platforms.style.values['--platform-translate-y']) - 9.6) < 0.001);
  assert.ok(Number(cards[0].style.values['--platform-card-opacity']) > 0);
  assert.ok(Number(cards[2].style.values['--platform-card-opacity']) < Number(cards[0].style.values['--platform-card-opacity']));
  controller.destroy();
});

test('midpoint settle follows the most recent scroll direction', () => {
  const down = createControllerHarness();
  const downController = createIntroScrollController(down);
  down.windowRef.flushRaf(0);
  down.setSequenceTop(-500);
  down.listeners.get('scroll')();
  down.windowRef.flushRaf(16);
  down.windowRef.runTimer();
  assert.equal(down.scrollCalls.length, 0);
  down.windowRef.flushRaf(32);
  down.windowRef.flushRaf(320);
  assert.deepEqual(down.scrollCalls.at(-1), { top: 1000, behavior: 'auto' });
  assert.equal(down.host.style.values['--orbit-page-scale'], '0.65');
  downController.destroy();

  const up = createControllerHarness();
  up.setSequenceTop(-700);
  const upController = createIntroScrollController(up);
  up.windowRef.flushRaf(0);
  up.setSequenceTop(-500);
  up.listeners.get('scroll')();
  up.windowRef.flushRaf(16);
  up.windowRef.runTimer();
  up.windowRef.flushRaf(32);
  up.windowRef.flushRaf(320);
  assert.deepEqual(up.scrollCalls.at(-1), { top: 0, behavior: 'auto' });
  upController.destroy();
});

test('frame-owned settle stops immediately on new user input', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController(harness);
  harness.windowRef.flushRaf(0);
  harness.setSequenceTop(-600);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf(16);
  harness.windowRef.runTimer();
  harness.windowRef.flushRaf(32);
  harness.windowRef.flushRaf(112);
  assert.ok(harness.scrollCalls.length > 0);
  assert.ok(harness.scrollCalls.every((call) => call.behavior === 'auto'));

  const callsBeforeCancel = harness.scrollCalls.length;
  harness.listeners.get('wheel')();
  harness.windowRef.flushRaf(320);
  assert.equal(harness.scrollCalls.length, callsBeforeCancel);
  controller.destroy();
  assert.equal(harness.listeners.size, 0);
});

test('unexpected manual scroll cancels an active settle without fighting it', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController(harness);
  harness.windowRef.flushRaf(0);
  harness.setSequenceTop(-600);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf(16);
  harness.windowRef.runTimer();
  harness.windowRef.flushRaf(32);

  const callsBeforeDrag = harness.scrollCalls.length;
  harness.setSequenceTop(-450);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf(112);

  assert.equal(harness.scrollCalls.length, callsBeforeDrag);
  controller.destroy();
});

test('enabling reduced motion cancels an active settle and applies progress directly', () => {
  const harness = createControllerHarness();
  const controller = createIntroScrollController(harness);
  harness.windowRef.flushRaf(0);
  harness.setSequenceTop(-600);
  harness.listeners.get('scroll')();
  harness.windowRef.flushRaf(16);
  harness.windowRef.runTimer();
  harness.windowRef.flushRaf(32);

  const callsBeforePreferenceChange = harness.scrollCalls.length;
  harness.media.setMatches(true);
  harness.windowRef.flushRaf(112);

  assert.equal(harness.scrollCalls.length, callsBeforePreferenceChange);
  assert.equal(harness.host.style.values['--orbit-page-scale'], '0.79');
  controller.destroy();
});

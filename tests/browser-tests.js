import '../src/orbit-text-reveal.js?v=20260718-1';

const results = document.querySelector('#results');
const host = document.querySelector('#host');
const checks = [];
const check = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(`PASS ${message}`);
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const nearlyEqual = (actual, expected, tolerance = 0.5) => Math.abs(actual - expected) <= tolerance;
const assertClose = (actual, expected, tolerance, message) => {
  check(Math.abs(actual - expected) <= tolerance, message);
};
const samePoint = (actual, expected) => actual.x === expected.x && actual.y === expected.y;

function geometryFitsBounds(geometry, availableWidth, availableHeight, safeMargin) {
  const minX = safeMargin;
  const maxX = availableWidth - safeMargin;
  return geometry.lines.every((line) => {
    const textFits = line.x >= minX && line.x + line.width <= maxX;
    const ballFits = [line.start, line.end].every((point) => (
      point.x - geometry.ballSize / 2 >= minX
      && point.x + geometry.ballSize / 2 <= maxX
      && point.y - geometry.ballSize / 2 >= safeMargin
      && point.y + geometry.ballSize / 2 <= availableHeight - safeMargin
    ));
    const textFitsVertically = line.y >= safeMargin
      && line.y + geometry.lineHeightPx <= availableHeight - safeMargin;
    return textFits && textFitsVertically && ballFits;
  });
}

async function waitFor(predicate, message, timeoutMs = 1500) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await nextFrame();
  }
  throw new Error(message);
}

function animationConfig(texts, overrides = {}) {
  return {
    texts,
    layout: { autoWrap: false },
    timing: {
      revealMs: 120,
      retractMs: 120,
      lineTravelMs: 40,
      centerHoldMs: 10,
      ...overrides
    }
  };
}

async function appendElement(config) {
  const element = document.createElement('orbit-text-reveal');
  element.config = config;
  host.append(element);
  await element.ready;
  return element;
}

function matrixFor(transform) {
  return new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
}

async function runMainCycle() {
  const element = document.createElement('orbit-text-reveal');
  element.config = {
    ...animationConfig([{ text: 'Longest\nMedium\nx', holdMs: 30 }]),
    layout: { maxWidth: 680, fontSize: 48, lineHeight: 1.16, ballSizeEm: 0.78, ballGapEm: 0.08, autoWrap: false },
    motion: {
      easing: 'cubic-bezier(0.333333, 0, 0.666667, 0.5)',
      continuationEasing: 'linear',
      exitEasing: 'cubic-bezier(0.333333, 0.5, 0.666667, 1)',
      singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)'
    }
  };

  const states = [];
  const stateSnapshots = [];
  let cycleClosed = false;
  let recenterSnapshot;
  let recenterInlineMatrix;
  let recenterComputedMatrix;
  let activeBallAnimationsAtRecenter;
  let easingSamplePromise;
  let resolveEasingSample;
  const revealTimingSamples = [];
  const retractTimingSamples = [];
  const seenRevealClocks = new Set();
  const seenRetractClocks = new Set();
  easingSamplePromise = new Promise((resolve) => { resolveEasingSample = resolve; });

  element.addEventListener('orbit-state-change', (event) => {
    if (cycleClosed) return;
    const state = event.detail.state;
    states.push(state);
    stateSnapshots.push({ state, snapshot: element.debugSnapshot() });

    if (state === 'reveal-line') {
      requestAnimationFrame(() => {
        const active = element.shadowRoot.querySelector('.timeline-clock').getAnimations()[0];
        if (!active || seenRevealClocks.has(active)) return;
        seenRevealClocks.add(active);
        const animationTiming = active.effect.getTiming();
        revealTimingSamples.push({
          easing: animationTiming.easing,
          duration: Number(animationTiming.duration)
        });
      });
    }

    if (state === 'retract-line') {
      requestAnimationFrame(() => {
        const active = element.shadowRoot.querySelector('.timeline-clock').getAnimations()[0];
        if (!active || seenRetractClocks.has(active)) return;
        seenRetractClocks.add(active);
        const animationTiming = active.effect.getTiming();
        retractTimingSamples.push({
          easing: animationTiming.easing,
          duration: Number(animationTiming.duration)
        });
      });
    }

    if (state === 'reveal-line' && states.filter((value) => value === state).length === 1) {
      setTimeout(async () => {
        await nextFrame();
        const line = element.shadowRoot.querySelector('.line');
        const glyphs = [...line.querySelectorAll('.glyph')];
        const geometry = element.debugSnapshot().geometry.lines[0];
        const ballMatrix = matrixFor(getComputedStyle(element.shadowRoot.querySelector('.ball')).transform);
        const ballProgress = (ballMatrix.e - geometry.start.x) / (geometry.end.x - geometry.start.x);
        const contentX = matrixFor(getComputedStyle(line.querySelector('.line-content')).transform).e;
        const contentProgress = (geometry.contentStartX - contentX) / (geometry.contentStartX - geometry.x);
        const scales = glyphs.map((glyph) => matrixFor(getComputedStyle(glyph).transform).a);
        const clipNumbers = getComputedStyle(line).clipPath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        const clipRight = element.clientWidth - (clipNumbers[1] ?? 0);
        resolveEasingSample({ contentProgress, ballProgress, scales, glyphs, clipRight, ballX: ballMatrix.e });
      }, 35);
    }

    if (state === 'recenter') {
      const ball = element.shadowRoot.querySelector('.ball');
      recenterSnapshot = element.debugSnapshot();
      recenterInlineMatrix = matrixFor(ball.style.transform);
      recenterComputedMatrix = matrixFor(getComputedStyle(ball).transform);
      activeBallAnimationsAtRecenter = ball.getAnimations().length;
      cycleClosed = true;
    }
  });

  const indexEvents = [];
  const firstIndexChange = new Promise((resolve) => {
    element.addEventListener('orbit-index-change', (event) => {
      indexEvents.push(event.detail.index);
      resolve();
    }, { once: true });
  });

  host.append(element);
  await element.ready;

  check(customElements.get('orbit-text-reveal'), 'custom element is registered');
  const lines = [...element.shadowRoot.querySelectorAll('.line')];
  const glyphs = [...element.shadowRoot.querySelectorAll('.glyph')];
  const linesLayer = element.shadowRoot.querySelector('.lines');
  const ball = element.shadowRoot.querySelector('.ball');
  check(lines.length === 3, 'three-line item renders exactly three lines');
  check(lines.slice(1).every((line) => line.hidden), 'future multiline rows stay hidden until introduced');
  check(lines.every((line) => line.style.clipPath.includes('inset')), 'every unrevealed line rests behind an inset clip');
  check(glyphs.length > 0, 'characters render as glyph spans');
  check(lines.every((line) => getComputedStyle(line).overflowX === 'hidden' && getComputedStyle(line).overflowY === 'hidden'), 'computed line overflow clips undisclosed text');
  check(linesLayer.compareDocumentPosition(ball) & Node.DOCUMENT_POSITION_FOLLOWING, 'ball follows line masks in shadow DOM order');
  check(Number(getComputedStyle(ball).zIndex) > Number(getComputedStyle(linesLayer).zIndex), 'ball computed z-index is above line masks');
  const expectedBallSize = element.config.layout.fontSize
    * element.config.layout.scale
    * element.config.layout.ballSizeEm;
  check(nearlyEqual(Number.parseFloat(ball.style.width), expectedBallSize, 0.01), 'ball size derives from configured font size');

  const layoutWidths = glyphs.map((glyph) => glyph.offsetWidth);
  const easingSample = await easingSamplePromise;
  check(nearlyEqual(easingSample.ballProgress, easingSample.contentProgress, 0.05), 'ball and moving text share eased progress in opposite directions');
  check(easingSample.scales.every((scale) => scale >= element.config.motion.characterMinScale - 0.01 && scale <= 1.01), 'glyphs only grow from the configured minimum to normal size');
  check(nearlyEqual(easingSample.clipRight, easingSample.ballX + expectedBallSize / 2, 1), 'line clip follows ball right edge until full occlusion');
  check(easingSample.glyphs.every((glyph, index) => glyph.offsetWidth === layoutWidths[index]), 'glyph scale does not change layout width');

  await firstIndexChange;
  const expectedStates = [
    'center-hold',
    'reveal-line',
    'line-jump',
    'reveal-line',
    'line-jump',
    'reveal-line',
    'expanded-hold',
    'retract-line',
    'line-jump',
    'retract-line',
    'line-jump',
    'retract-line',
    'recenter'
  ];
  check(JSON.stringify(states) === JSON.stringify(expectedStates), `three-line state sequence is exact forward snake plus reverse: ${states.join(' -> ')}`);

  const geometry = recenterSnapshot.geometry;
  const firstReveal = stateSnapshots.find(({ state }) => state === 'reveal-line');
  const expanded = stateSnapshots.find(({ state }) => state === 'expanded-hold');
  const reverseSnapshots = stateSnapshots.filter(({ state }) => state === 'retract-line');
  check(firstReveal.snapshot.ball.y === firstReveal.snapshot.center.y, 'first multiline row starts at configured center');
  const expandedCenters = expanded.snapshot.renderedLines.map(({ centerY }) => centerY);
  check(
    nearlyEqual((expandedCenters[0] + expandedCenters.at(-1)) / 2, expanded.snapshot.center.y, 0.01),
    'final multiline block is vertically centered'
  );
  const finalLine = geometry.lines.at(-1);
  check(
    nearlyEqual(
      geometry.center.x - finalLine.x,
      finalLine.end.x + geometry.ballSize / 2 - geometry.center.x,
      0.01
    ),
    'short final row is independently centered'
  );
  check(revealTimingSamples.length === 1, 'multiline reveal uses exactly one global clock');
  check(revealTimingSamples[0]?.easing === element.config.motion.singleLineEasing, 'global reveal clock uses whole-pass easing');
  check(revealTimingSamples[0]?.duration === element.config.timing.revealMs, 'global reveal clock uses the complete configured duration');
  check(retractTimingSamples.length === 1, 'multiline retract uses exactly one global clock');
  check(retractTimingSamples[0]?.easing === element.config.motion.singleLineEasing, 'global retract clock uses whole-pass easing');
  check(retractTimingSamples[0]?.duration === element.config.timing.retractMs, 'global retract clock uses the complete configured duration');
  check(
    samePoint(reverseSnapshots[0].snapshot.ball, {
      x: geometry.lines[2].end.x,
      y: reverseSnapshots[0].snapshot.renderedLines[2].centerY
    }),
    'reverse starts at last line end'
  );
  check(
    samePoint(reverseSnapshots[1].snapshot.ball, {
      x: geometry.lines[1].end.x,
      y: reverseSnapshots[1].snapshot.renderedLines[1].centerY
    }),
    'reverse instantly jumps to the previous line end'
  );
  check(reverseSnapshots.every(({ snapshot }) => snapshot.ball.x >= snapshot.center.x), 'retract never moves the ball left of center');
  check(recenterSnapshot.ball.x === recenterSnapshot.center.x && recenterSnapshot.ball.y === recenterSnapshot.center.y, 'recenter logical ball equals center');
  check(nearlyEqual(recenterInlineMatrix.e, recenterSnapshot.center.x, 0.01) && nearlyEqual(recenterInlineMatrix.f, recenterSnapshot.center.y, 0.01), 'recenter inline transform equals center CSS coordinates');
  check(nearlyEqual(recenterComputedMatrix.e, recenterSnapshot.center.x, 0.01) && nearlyEqual(recenterComputedMatrix.f, recenterSnapshot.center.y, 0.01), 'recenter computed transform equals center CSS coordinates');
  check(activeBallAnimationsAtRecenter === 0, 'recenter leaves no fill animation overriding exact CSS center');

  const cloned = element.debugSnapshot();
  const originalCenterX = cloned.center.x;
  const originalLineX = cloned.geometry.lines[0].x;
  cloned.center.x = -999;
  cloned.geometry.lines[0].x = -999;
  const fresh = element.debugSnapshot();
  check(fresh.center.x === originalCenterX && fresh.geometry.lines[0].x === originalLineX, 'debugSnapshot returns a deep clone');
  check(indexEvents[0] === 0, 'completed cycle dispatches index event');

  element.destroy();
}

async function runControlAndLifecycleChecks() {
  const singleProbe = await appendElement(animationConfig([{ text: 'Single line', holdMs: 1000 }], {
    centerHoldMs: 0,
    revealMs: 300
  }));
  check(singleProbe.shadowRoot.querySelectorAll('.line').length === 1, 'single-line item renders exactly one line');
  await waitFor(() => singleProbe.debugSnapshot().state === 'reveal-line', 'single-line probe never reached reveal');
  const singleAnimations = singleProbe.shadowRoot.querySelector('.timeline-clock').getAnimations();
  check(
    singleAnimations.some((animation) => animation.effect.getTiming().easing === singleProbe.config.motion.singleLineEasing),
    'single-line traversal uses single-line easing'
  );
  singleProbe.destroy();
  singleProbe.remove();

  const restartProbe = await appendElement(animationConfig([{ text: 'Restart', holdMs: 1000 }], {
    centerHoldMs: 60,
    lineTravelMs: 60,
    revealMs: 60,
    retractMs: 60
  }));
  const restartStates = [];
  const restartIndexes = [];
  restartProbe.addEventListener('orbit-state-change', (event) => restartStates.push(event.detail.state));
  restartProbe.addEventListener('orbit-index-change', (event) => restartIndexes.push(event.detail.index));
  restartProbe.restart();
  await restartProbe.ready;
  await waitFor(() => restartStates.includes('reveal-line'), 'restarted run did not cross the old run boundary');
  await sleep(40);
  check(
    JSON.stringify(restartStates.slice(0, 2)) === JSON.stringify(['center-hold', 'reveal-line'])
      && restartStates.filter((state) => state === 'reveal-line').length === 1
      && restartIndexes.length === 0,
    'restart aborts the old run without duplicate events past its original boundary'
  );
  restartProbe.destroy();
  restartProbe.remove();

  const delayProbe = document.createElement('orbit-text-reveal');
  delayProbe.config = animationConfig([{ text: 'Delay', holdMs: 1000 }], {
    centerHoldMs: 180,
    lineTravelMs: 100,
    revealMs: 100,
    retractMs: 100
  });
  const delayStates = [];
  delayProbe.addEventListener('orbit-state-change', (event) => delayStates.push(event.detail.state));
  host.append(delayProbe);
  await delayProbe.ready;
  delayProbe.pause();
  await sleep(220);
  check(!delayStates.includes('reveal-line'), 'pause freezes logical delay clock');
  delayProbe.play();
  await waitFor(() => delayStates.includes('reveal-line'), 'play did not resume logical delay clock');
  check(delayStates.includes('reveal-line'), 'play resumes logical delay clock');
  delayProbe.destroy();
  delayProbe.remove();

  const pauseProbe = await appendElement(animationConfig([{ text: 'Pause', holdMs: 1000 }], {
    centerHoldMs: 0,
    lineTravelMs: 300,
    revealMs: 300,
    retractMs: 300
  }));
  const pauseClock = pauseProbe.shadowRoot.querySelector('.timeline-clock');
  await waitFor(() => pauseClock.getAnimations().length === 1, 'pause probe never started');
  const activeAnimation = pauseClock.getAnimations()[0];
  pauseProbe.pause();
  const pausedTime = Number(activeAnimation.currentTime);
  await sleep(60);
  check(nearlyEqual(Number(activeAnimation.currentTime), pausedTime, 2), 'pause freezes active WAAPI time');
  pauseProbe.play();
  await sleep(60);
  check(Number(activeAnimation.currentTime) > pausedTime, 'play resumes active WAAPI time');
  pauseProbe.destroy();
  pauseProbe.remove();

  const controlProbe = await appendElement(animationConfig([
    { text: 'First', holdMs: 1000 },
    { text: 'Second', holdMs: 1000 }
  ], { centerHoldMs: 1000 }));
  const indexEvents = [];
  controlProbe.addEventListener('orbit-index-change', (event) => indexEvents.push(event.detail.index));
  const indexEventCountBeforeNext = indexEvents.length;
  controlProbe.next();
  await controlProbe.ready;
  check(indexEvents.length === indexEventCountBeforeNext + 1 && indexEvents.at(-1) === 1 && controlProbe.debugSnapshot().index === 1, 'next advances index exactly once');
  check(controlProbe.shadowRoot.querySelector('.sr-text').textContent === 'Second', 'next renders the next live-region text');
  controlProbe.updateConfig(animationConfig([{ text: 'Replacement', holdMs: 1000 }], { centerHoldMs: 1000 }), { immediate: true });
  await controlProbe.ready;
  check(indexEvents.filter((index) => index === 0).length === 1, 'config replacement dispatches one index reset from nonzero to zero');
  const eventCountAtZero = indexEvents.length;
  controlProbe.updateConfig(animationConfig([{ text: 'Replacement again', holdMs: 1000 }], { centerHoldMs: 1000 }), { immediate: true });
  await controlProbe.ready;
  check(indexEvents.length === eventCountAtZero, 'config replacement at index zero does not duplicate index event');

  controlProbe.updateConfig(animationConfig([{ text: 'Disconnect active', holdMs: 1000 }], {
    centerHoldMs: 0,
    lineTravelMs: 500,
    revealMs: 500,
    retractMs: 500
  }), { immediate: true });
  await controlProbe.ready;
  await waitFor(() => controlProbe.shadowRoot.querySelector('.timeline-clock').getAnimations().length > 0, 'disconnect probe never started');

  let stateCount = 0;
  controlProbe.addEventListener('orbit-state-change', () => { stateCount += 1; });
  controlProbe.remove();
  const disconnectedStateCount = stateCount;
  await sleep(80);
  check(controlProbe.shadowRoot.querySelector('.timeline-clock').getAnimations().length === 0, 'disconnect cancels active animations');
  check(stateCount === disconnectedStateCount, 'disconnect leaves no stale state loop');

  host.append(controlProbe);
  await sleep(30);
  controlProbe.destroy();
  await sleep(30);
  check(controlProbe.debugSnapshot().state === 'destroyed', 'destroy enters destroyed state');
  check(controlProbe.shadowRoot.querySelector('.lines').children.length === 0, 'destroy clears line masks');
  check(controlProbe.shadowRoot.querySelector('.ball').hidden, 'destroy hides ball');
  check(controlProbe.shadowRoot.querySelector('.sr-text').textContent === '', 'destroy clears live-region text');
  check(controlProbe.shadowRoot.querySelector('.timeline-clock').getAnimations().length === 0, 'destroy cancels active animations');
  controlProbe.remove();

  const emptyProbe = await appendElement({ texts: [] });
  check(emptyProbe.debugSnapshot().state === 'empty', 'empty config enters empty state');
  check(emptyProbe.debugSnapshot().lineCount === 0, 'empty config renders no lines');
  const emptyBall = emptyProbe.shadowRoot.querySelector('.ball');
  const emptyBallMatrix = matrixFor(getComputedStyle(emptyBall).transform);
  check(
    !emptyBall.hidden
      && emptyProbe.shadowRoot.querySelector('.lines').children.length === 0
      && nearlyEqual(emptyBallMatrix.e, emptyProbe.clientWidth / 2, 0.01)
      && nearlyEqual(emptyBallMatrix.f, emptyProbe.clientHeight / 2, 0.01),
    'empty config leaves only the centered ball'
  );
  await sleep(40);
  check(emptyProbe.shadowRoot.querySelector('.ball').getAnimations().length === 0, 'empty config starts no animation loop');
  emptyProbe.destroy();
  emptyProbe.remove();
}

async function runSafeBoundaryAndVisibilityChecks() {
  const configProbe = await appendElement(animationConfig([
    { text: 'Original active reveal', holdMs: 20 }
  ], { centerHoldMs: 0, lineTravelMs: 30, revealMs: 180, retractMs: 180 }));
  await waitFor(() => configProbe.debugSnapshot().state === 'reveal-line', 'config boundary probe never reached reveal');
  const states = [];
  configProbe.addEventListener('orbit-state-change', (event) => states.push(event.detail.state));
  configProbe.config = animationConfig([{ text: 'Boundary replacement', holdMs: 20 }], {
    centerHoldMs: 0, lineTravelMs: 30, revealMs: 30, retractMs: 30
  });
  const pendingReady = configProbe.ready;
  await sleep(40);
  check(configProbe.shadowRoot.querySelector('.sr-text').textContent === 'Original active reveal', 'mid-reveal config remains queued while active');
  check(!states.includes('center-hold'), 'mid-reveal config does not restart the active cycle');
  await pendingReady;
  check(states.includes('retract-line') && states.includes('recenter'), 'queued config waits through retract and recenter');
  check(configProbe.shadowRoot.querySelector('.sr-text').textContent === 'Boundary replacement', 'queued config applies at the recenter boundary');
  configProbe.destroy();
  configProbe.remove();

  const resizeProbe = await appendElement(animationConfig([{ text: 'Resize during retract', holdMs: 0 }], {
    centerHoldMs: 0, lineTravelMs: 20, revealMs: 30, retractMs: 180
  }));
  await waitFor(() => resizeProbe.debugSnapshot().state === 'retract-line', 'resize boundary probe never reached retract');
  const oldCenter = resizeProbe.debugSnapshot().center.x;
  resizeProbe.style.width = '280px';
  await sleep(40);
  check(resizeProbe.debugSnapshot().state === 'retract-line', 'mid-retract resize does not restart the active cycle');
  check(resizeProbe.debugSnapshot().center.x === oldCenter, 'mid-retract resize preserves active geometry until boundary');
  await waitFor(() => resizeProbe.debugSnapshot().center.x !== oldCenter, 'queued resize did not apply at next prepare');
  check(resizeProbe.debugSnapshot().center.x === 140, 'queued resize uses the new stage width at safe boundary');
  resizeProbe.destroy();
  resizeProbe.remove();

  const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  if (visibilityDescriptor && !visibilityDescriptor.configurable) {
    check(true, 'browser locks visibilityState; visibility lifecycle remains covered by source regression');
    return;
  }
  let visibilityState = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibilityState
  });
  try {
    const visibilityProbe = await appendElement(animationConfig([{ text: 'Visibility', holdMs: 1000 }], {
      centerHoldMs: 0, lineTravelMs: 220, revealMs: 220, retractMs: 220
    }));
    await waitFor(() => visibilityProbe.shadowRoot.querySelector('.timeline-clock').getAnimations().length > 0, 'visibility probe never started');
    const animation = visibilityProbe.shadowRoot.querySelector('.timeline-clock').getAnimations()[0];
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    const hiddenTime = Number(animation.currentTime);
    await sleep(60);
    check(nearlyEqual(Number(animation.currentTime), hiddenTime, 2), 'visibility hidden auto-pauses active timing');
    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(60);
    check(Number(animation.currentTime) > hiddenTime, 'visibility visible resumes when not user-paused');
    visibilityProbe.pause();
    const userPausedTime = Number(animation.currentTime);
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(60);
    check(nearlyEqual(Number(animation.currentTime), userPausedTime, 2), 'hide-show preserves an existing user pause');
    visibilityProbe.destroy();
    visibilityProbe.remove();
  } finally {
    if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    else delete document.visibilityState;
  }
}

async function runTypographyAndEasingChecks() {
  const typographyProbe = await appendElement({
    ...animationConfig([{ text: 'AV To fi', holdMs: 1000 }], { centerHoldMs: 1000 }),
    style: { fontFamily: 'serif', fontWeight: 700 }
  });
  const glyphs = [...typographyProbe.shadowRoot.querySelectorAll('.glyph')];
  const lineGeometry = typographyProbe.debugSnapshot().geometry.lines[0];
  const glyphWidth = glyphs.reduce((sum, glyph) => sum + Number.parseFloat(glyph.style.width), 0);
  check(nearlyEqual(glyphWidth, lineGeometry.width, 0.01), 'AV To fi DOM glyph widths equal geometry and mask width');
  typographyProbe.style.setProperty('--orbit-font-family', 'monospace');
  typographyProbe.style.setProperty('--orbit-font-size', '42px');
  typographyProbe.style.setProperty('--orbit-ball-size', '0.5em');
  typographyProbe.style.setProperty('--orbit-ball-color', 'rgb(239, 91, 53)');
  typographyProbe.restart();
  await typographyProbe.ready;
  const typographyBall = typographyProbe.shadowRoot.querySelector('.ball');
  check(nearlyEqual(Number.parseFloat(typographyBall.style.width), 21, 0.1), 'external typography and ball CSS variables override config defaults');
  check(getComputedStyle(typographyBall).backgroundColor === 'rgb(239, 91, 53)', 'external CSS ball color override applies to normal text');
  typographyProbe.destroy();
  typographyProbe.remove();

  const easingProbe = await appendElement({
    ...animationConfig([{ text: 'First\nSecond', holdMs: 10 }], {
      centerHoldMs: 0, lineTravelMs: 160, revealMs: 160, retractMs: 160
    }),
    motion: {
      easing: 'linear',
      singleLineEasing: 'linear',
      lineEasing: 'cubic-bezier(0.1, 0.8, 0.2, 1)'
    }
  });
  let lineJumpBallAnimationCount = -1;
  const lineJump = new Promise((resolve) => {
    easingProbe.addEventListener('orbit-state-change', (event) => {
      if (event.detail.state === 'line-jump') {
        lineJumpBallAnimationCount = easingProbe.shadowRoot.querySelector('.ball').getAnimations().length;
        resolve();
      }
    });
  });
  await waitFor(() => easingProbe.debugSnapshot().state === 'reveal-line', 'easing probe never reached reveal');
  await nextFrame();
  const revealEasings = easingProbe.shadowRoot.querySelector('.timeline-clock').getAnimations()
    .map((animation) => animation.effect.getTiming().easing);
  check(revealEasings.includes('linear'), 'reveal and retract use the global timeline easing');
  await lineJump;
  check(lineJumpBallAnimationCount === 0, 'cross-line movement is an instantaneous jump without travel animation');
  easingProbe.destroy();
  easingProbe.remove();

  const distanceProbe = document.createElement('orbit-text-reveal');
  distanceProbe.config = {
    ...animationConfig([{ text: 'Longest\nMedium\nx', holdMs: 0 }], {
      centerHoldMs: 0, revealMs: 600, retractMs: 600
    }),
    layout: { maxWidth: 680, fontSize: 48, autoWrap: false },
    motion: { singleLineEasing: 'linear' }
  };
  const revealJumpTimes = [];
  const retractJumpTimes = [];
  let retracting = false;
  const distanceCycle = new Promise((resolve) => {
    distanceProbe.addEventListener('orbit-state-change', (event) => {
      if (event.detail.state === 'retract-line') retracting = true;
      if (event.detail.state === 'line-jump') {
        const clock = distanceProbe.shadowRoot.querySelector('.timeline-clock').getAnimations()[0];
        if (clock) (retracting ? retractJumpTimes : revealJumpTimes).push(Number(clock.currentTime));
      }
      if (event.detail.state === 'recenter') resolve();
    });
  });
  host.append(distanceProbe);
  await distanceProbe.ready;
  const distances = distanceProbe.debugSnapshot().geometry.lines
    .map((line) => line.end.x - line.start.x);
  const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);
  await distanceCycle;
  const expectedRevealJumps = [
    600 * distances[0] / totalDistance,
    600 * (distances[0] + distances[1]) / totalDistance
  ];
  const expectedRetractJumps = [
    600 * distances[2] / totalDistance,
    600 * (distances[2] + distances[1]) / totalDistance
  ];
  check(
    revealJumpTimes.length === 2
      && revealJumpTimes.every((time, index) => nearlyEqual(time, expectedRevealJumps[index], 35)),
    'reveal row boundaries follow cumulative pixel distance on one clock'
  );
  check(
    retractJumpTimes.length === 2
      && retractJumpTimes.every((time, index) => nearlyEqual(time, expectedRetractJumps[index], 35)),
    'retract row boundaries follow cumulative pixel distance on one clock'
  );
  distanceProbe.destroy();
  distanceProbe.remove();
}

async function runResizeObserverChecks() {
  const resizeProbe = document.createElement('orbit-text-reveal');
  resizeProbe.style.cssText = 'width:720px;height:300px';
  resizeProbe.config = {
    ...animationConfig([{ text: '一二三四五六七八九十', holdMs: 20 }], {
      centerHoldMs: 200, revealMs: 80, retractMs: 80, lineTravelMs: 40
    }),
    layout: { maxWidth: 680, fontSize: 60, ballSizeEm: 0.8, ballGapEm: 0.1, scale: 1 }
  };
  const resizeStates = [];
  resizeProbe.addEventListener('orbit-state-change', (event) => resizeStates.push(event.detail.state));
  host.append(resizeProbe);
  await resizeProbe.ready;
  await sleep(80);
  check(resizeStates.filter((state) => state === 'center-hold').length === 1, 'initial ResizeObserver delivery does not restart the loop');

  const initialCenterX = resizeProbe.debugSnapshot().center.x;
  const initialLineCount = resizeProbe.debugSnapshot().lineCount;
  resizeProbe.style.width = '300px';
  await waitFor(
    () => resizeStates.filter((state) => state === 'center-hold').length === 2,
    'real size change did not trigger reflow'
  );
  await sleep(80);
  check(resizeStates.filter((state) => state === 'center-hold').length === 2, 'real size change triggers exactly one safe reflow');
  check(resizeProbe.debugSnapshot().center.x !== initialCenterX, 'real size change recomputes geometry center');
  check(resizeProbe.debugSnapshot().lineCount > initialLineCount, 'narrow resize rewraps with the new effective width');
  check(
    geometryFitsBounds(resizeProbe.debugSnapshot().geometry, 300, 300, 16),
    'narrow resize keeps every text range and ball endpoint inside safe bounds'
  );
  check(resizeProbe.debugSnapshot().autoFitScale > 0, 'resolved auto-fit scale remains positive');
  check(
    nearlyEqual(
      resizeProbe.debugSnapshot().resolvedScale,
      resizeProbe.config.layout.scale * resizeProbe.debugSnapshot().autoFitScale,
      0.000001
    ),
    'debug snapshot exposes the actual resolved render scale'
  );
  resizeProbe.destroy();
  resizeProbe.remove();

  const zeroProbe = document.createElement('orbit-text-reveal');
  zeroProbe.style.cssText = 'width:0px;height:0px';
  zeroProbe.config = animationConfig([{ text: 'First usable size', holdMs: 1000 }], { centerHoldMs: 1000 });
  const zeroStates = [];
  zeroProbe.addEventListener('orbit-state-change', (event) => zeroStates.push(event.detail.state));
  host.append(zeroProbe);
  await nextFrame();
  await nextFrame();
  check(zeroProbe.debugSnapshot().geometry === null, 'zero-size connection waits for a usable layout');
  zeroProbe.style.cssText = 'width:320px;height:160px';
  await zeroProbe.ready;
  await sleep(80);
  check(zeroProbe.debugSnapshot().geometry !== null, 'zero-to-nonzero layout starts normally');
  check(zeroStates.filter((state) => state === 'center-hold').length === 1, 'first usable layout starts exactly one loop');
  zeroProbe.destroy();
  zeroProbe.remove();

  const shortProbe = document.createElement('orbit-text-reveal');
  shortProbe.style.cssText = 'width:150px;height:96px';
  shortProbe.config = {
    texts: [{ text: 'one two three four five six seven eight', holdMs: 1000 }],
    timing: { centerHoldMs: 1000 },
    layout: { maxWidth: 680, fontSize: 64, lineHeight: 1.16 }
  };
  host.append(shortProbe);
  await shortProbe.ready;
  check(geometryFitsBounds(shortProbe.debugSnapshot().geometry, 150, 96, 16), 'narrow short stage fits text block and ball endpoints on both axes');
  shortProbe.destroy();
  shortProbe.remove();

  const liveProbe = document.createElement('orbit-text-reveal');
  liveProbe.style.cssText = 'width:600px;height:300px';
  liveProbe.style.setProperty('--orbit-font-size', '60px');
  liveProbe.config = {
    ...animationConfig([{ text: 'Live resize probe', holdMs: 20 }], {
      centerHoldMs: 10, revealMs: 600, retractMs: 100, lineTravelMs: 40
    }),
    layout: { maxWidth: 600, fontSize: 60, ballSizeEm: 0.8, ballGapEm: 0.1, scale: 1 }
  };
  const liveStates = [];
  liveProbe.addEventListener('orbit-state-change', (event) => liveStates.push(event.detail.state));
  host.append(liveProbe);
  await liveProbe.ready;

  await waitFor(
    () => liveProbe.debugSnapshot().state === 'reveal-line',
    'live resize probe never reached reveal'
  );

  const before = liveProbe.debugSnapshot();
  const beforeIndex = before.index;
  const centerHoldCountBefore = liveStates.filter((state) => state === 'center-hold').length;
  liveProbe.style.width = '420px';
  liveProbe.style.setProperty('--orbit-font-size', '42px');
  await nextFrame();
  await nextFrame();

  const during = liveProbe.debugSnapshot();
  check(during.index === beforeIndex, 'live resize preserves the active index');
  check(during.state !== 'center-hold', 'live resize does not return the active animation to its initial hold');
  check(Boolean(during.liveResizeTransform), 'live resize exposes a temporary transform');
  check(during.liveResizeTransform.scale < 1, 'live resize follows the smaller resolved font continuously');
  assertClose(
    before.center.x + during.liveResizeTransform.x,
    liveProbe.clientWidth / 2,
    1,
    'live resize maps the old geometry center to the latest stage center'
  );
  check(
    liveStates.filter((state) => state === 'center-hold').length === centerHoldCountBefore,
    'live resize does not restart the active loop'
  );

  await waitFor(
    () => liveProbe.debugSnapshot().liveResizeTransform.scale === 1,
    'safe resize reflow did not clear the temporary transform'
  );
  check(liveProbe.debugSnapshot().center.x === liveProbe.clientWidth / 2, 'safe resize reflow commits the latest center');

  liveProbe.destroy();
  liveProbe.remove();
}

async function runReducedMotionCheck() {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; }
  });
  try {
    const reducedProbe = await appendElement({
      texts: [{ text: 'Still', holdMs: 10 }, { text: 'Next', holdMs: 10 }],
      accessibility: { reducedMotionRotate: false }
    });
    await sleep(50);
    const snapshot = reducedProbe.debugSnapshot();
    const line = reducedProbe.shadowRoot.querySelector('.line');
    check(snapshot.state === 'expanded-hold', 'reduced motion produces static text');
    check(snapshot.index === 0, 'reduced motion without rotation does not advance index');
    const reducedContentX = matrixFor(line.querySelector('.line-content').style.transform).e;
    check(
      nearlyEqual(reducedContentX, snapshot.geometry.lines[0].x, 0.01)
        && line.style.clipPath.includes('inset'),
      'reduced motion fully expands text'
    );
    check(reducedProbe.shadowRoot.querySelector('.ball').getAnimations().length === 0, 'reduced motion starts no travel animation');
    reducedProbe.destroy();
    reducedProbe.remove();
  } finally {
    window.matchMedia = originalMatchMedia;
  }
}

async function runProductionBoundaryCheck() {
  const response = await fetch('/index.html');
  const source = await response.text();

  check(response.ok, 'production page is available');
  check(source.includes('<orbit-text-reveal'), 'production page contains the component host');
  for (const forbidden of ['dev-app', 'textarea', 'Export configuration', '导出配置']) {
    check(!source.includes(forbidden), `production page excludes ${forbidden}`);
  }

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;visibility:hidden;pointer-events:none';
  frame.src = `/index.html?browser-test=${Date.now()}`;
  document.body.append(frame);
  await new Promise((resolve, reject) => {
    frame.addEventListener('load', resolve, { once: true });
    frame.addEventListener('error', () => reject(new Error('production page iframe failed to load')), { once: true });
  });

  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  const probe = frameDocument.querySelector('orbit-text-reveal');
  check(Boolean(probe), 'production frame exposes the real component host');
  await probe.ready;
  await nextFrame();
  await nextFrame();

  const hostRect = probe.getBoundingClientRect();
  const expectedWidth = Math.max(
    frameWindow.innerWidth * 0.4,
    Math.min(
      frameWindow.innerWidth * 7 / 9,
      frameWindow.innerWidth * 0.269230769 + frameWindow.innerHeight * 0.232478632
    )
  );
  assertClose(hostRect.width, expectedWidth, 1, `stage width at ${frameWindow.innerWidth}px`);
  assertClose(hostRect.left + hostRect.width / 2, frameWindow.innerWidth / 2, 1, 'horizontal center');
  assertClose(hostRect.top + hostRect.height / 2, frameWindow.innerHeight / 2, 1, 'vertical center');
  check(frameDocument.documentElement.scrollWidth === frameWindow.innerWidth, 'no horizontal overflow');

  if (frameWindow.innerWidth === 320) {
    const fontStyle = frameWindow.getComputedStyle(probe).fontSize;
    assertClose(parseFloat(fontStyle), 19, 0.1, `font size 19px at 320px: ${fontStyle}`);

    probe.updateConfig({
      texts: [{ text: '一二三四五六七八九十', holdMs: 100 }],
      layout: { autoWrap: true }
    }, { immediate: true });
    await probe.ready;
    await nextFrame();
    await nextFrame();

    const snapshot = probe.debugSnapshot();
    check(
      snapshot.geometry.lines.length === 1,
      `ten characters form one line at 320px (${JSON.stringify({
        lines: snapshot.geometry.lines.map(({ text, width }) => ({ text, width })),
        autoFitScale: snapshot.autoFitScale,
        resolvedScale: snapshot.resolvedScale,
        hostWidth: hostRect.width,
        hostHeight: hostRect.height
      })})`
    );
    check(snapshot.geometry.lines[0].graphemes.length === 10, 'ten-character line preserves every grapheme at 320px');
    assertClose(
      snapshot.geometry.ballSize,
      19 * probe.config.layout.ballSizeEm,
      0.1,
      'component geometry uses the resolved 19px fluid font size'
    );
    check(geometryFitsBounds(snapshot.geometry, hostRect.width, hostRect.height, 16), 'ten characters fit 16px margin at 320px');
  }

  frame.remove();
}

async function runDeveloperPageCheck() {
  const response = await fetch('/dev.html');
  const source = await response.text();

  check(response.ok, 'developer page is available');
  check(source.includes('<orbit-text-reveal'), 'developer page contains the preview component');
  for (const section of ['文本队列', '时间', '排版与位置', '外观', '字符形变']) {
    check(source.includes(section), `developer page contains ${section} section`);
  }
  check(source.includes('data-action="copy-config"'), 'developer page source exposes export action');

  const harness = {
    clipboardMode: 'success',
    clipboardText: '',
    fallbackText: '',
    downloadedBlob: null,
    downloadedName: '',
    revokedUrl: '',
    environment: {
      async clipboardWriteText(text) {
        if (harness.clipboardMode === 'fallback') throw new Error('permission denied');
        harness.clipboardText = text;
      },
      copyFallback(textarea) {
        harness.fallbackText = textarea.value;
        return textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length;
      },
      createObjectURL(blob) {
        harness.downloadedBlob = blob;
        return 'blob:orbit-dev-test';
      },
      revokeObjectURL(url) { harness.revokedUrl = url; },
      triggerDownload(link) { harness.downloadedName = link.download; }
    }
  };
  window.__orbitDevTestHarness = harness;

  const frame = document.createElement('iframe');
  frame.title = 'developer page integration test';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:800px;border:0';
  const bootScript = '<script>window.__ORBIT_DEV_TEST_ENV__ = parent.__orbitDevTestHarness.environment;<\/script>';
  frame.srcdoc = source
    .replace('<head>', '<head><base href="/">')
    .replace('<script type="module"', `${bootScript}<script type="module"`);
  const frameLoaded = new Promise((resolve, reject) => {
    frame.addEventListener('load', resolve, { once: true });
    frame.addEventListener('error', reject, { once: true });
  });
  document.body.append(frame);
  await frameLoaded;
  await waitFor(
    () => frame.contentDocument?.querySelectorAll('[data-text-item]').length > 0,
    'developer page module did not render text entries'
  );

  const frameDoc = frame.contentDocument;
  check(frameDoc.querySelectorAll('[data-text-item]').length >= 1, 'developer page renders text entries');
  check(frameDoc.querySelector('[name="text"]'), 'developer page exposes manual newline text area');
  check(frameDoc.querySelector('[data-action="add-text"]'), 'developer page can add text');
  check(frameDoc.querySelector('[data-action="copy-config"]'), 'developer page can copy config');
  check(frameDoc.querySelector('[data-action="download-config"]'), 'developer page can download config');

  const frameWindow = frame.contentWindow;
  const preview = frameDoc.querySelector('orbit-text-reveal');
  const editor = frameDoc.querySelector('[data-editor]');
  const textValues = () => [...frameDoc.querySelectorAll('[name="text"]')].map((input) => input.value);
  const click = (selector, root = frameDoc) => root.querySelector(selector).click();
  const input = (control, value) => {
    control.value = value;
    control.dispatchEvent(new frameWindow.Event('input', { bubbles: true }));
  };
  const importFile = async (name, contents) => {
    const control = frameDoc.querySelector('[data-action="import-config"]');
    Object.defineProperty(control, 'files', {
      configurable: true,
      value: [new frameWindow.File([contents], name, { type: 'application/json' })]
    });
    control.dispatchEvent(new frameWindow.Event('change', { bubbles: true }));
    await waitFor(
      () => frameDoc.querySelector('[data-io-status]').textContent !== '',
      `developer import ${name} did not settle`
    );
  };

  const initialCount = frameDoc.querySelectorAll('[data-text-item]').length;
  click('[data-action="add-text"]');
  check(frameDoc.querySelectorAll('[data-text-item]').length === initialCount + 1, 'developer page adds a text card');
  input(frameDoc.querySelector('[data-text-item]:last-child [name="text"]'), 'Added\nline');

  let immediateUpdates = 0;
  let explicitRestarts = 0;
  const originalUpdateConfig = preview.updateConfig.bind(preview);
  preview.updateConfig = (value, options) => {
    if (options?.immediate) immediateUpdates += 1;
    return originalUpdateConfig(value, options);
  };
  const originalRestart = preview.restart.bind(preview);
  preview.restart = () => {
    explicitRestarts += 1;
    return originalRestart();
  };

  const debounceInput = frameDoc.querySelector('[data-text-item]:last-child [name="text"]');
  input(debounceInput, 'Added\nline one');
  await sleep(60);
  input(debounceInput, 'Added\nline two');
  await sleep(90);
  check(immediateUpdates === 0 && explicitRestarts === 0, 'developer inputs wait for the 120ms trailing debounce');
  await waitFor(() => immediateUpdates === 1 && explicitRestarts === 0, 'developer input did not apply one debounced immediate preview update');
  check(preview.config.texts.at(-1).text === 'Added\nline two', 'developer preview preserves literal textarea newlines');
  input(frameDoc.querySelector('[data-text-item]:last-child [data-text-layout="fontSize"]'), '37');
  await waitFor(() => preview.config.texts.at(-1).layout?.fontSize === 37, 'per-text layout override did not reach shared preview');
  check(preview.debugSnapshot().resolvedScale > 0, 'per-text layout override is rendered by shared component');

  input(frameDoc.querySelector('[data-path="timing.centerHoldMs"]'), '0');
  await waitFor(() => preview.config.timing.centerHoldMs === 0, 'developer timing control did not reach preview');
  const previewClock = preview.shadowRoot.querySelector('.timeline-clock');
  await waitFor(() => previewClock.getAnimations().length > 0, 'developer preview controls had no active animation');
  click('[data-action="pause-preview"]');
  check(previewClock.getAnimations().length > 0
    && previewClock.getAnimations().every((animation) => animation.playState === 'paused'), 'developer pause control calls shared component pause');
  click('[data-action="play-preview"]');
  check(previewClock.getAnimations().every((animation) => animation.playState !== 'paused'), 'developer play control calls shared component play');
  click('[data-action="replay-current"]');
  await preview.ready;
  check(explicitRestarts === 1, 'developer replay-current control calls shared component restart');
  preview.next();
  await preview.ready;
  click('[data-action="preview-full-loop"]');
  await preview.ready;
  check(preview.debugSnapshot().index === 0, 'developer full-loop control restarts from first item');

  const beforeDuplicate = textValues();
  click('[data-action="duplicate-text"]', frameDoc.querySelector('[data-text-item]'));
  check(textValues()[1] === beforeDuplicate[0] && textValues().length === beforeDuplicate.length + 1, 'developer page duplicates a text card');
  const beforeDown = textValues();
  click('[data-action="move-down"]', frameDoc.querySelector('[data-text-item]'));
  check(textValues()[0] === beforeDown[1] && textValues()[1] === beforeDown[0], 'developer page moves text down');
  click('[data-action="move-up"]', frameDoc.querySelectorAll('[data-text-item]')[1]);
  check(textValues()[0] === beforeDown[0], 'developer page moves text up');
  click('[data-action="delete-text"]', frameDoc.querySelector('[data-text-item]'));
  check(textValues().length === beforeDown.length - 1, 'developer page deletes a text card');

  while (frameDoc.querySelectorAll('[data-text-item]').length > 1) {
    click('[data-action="delete-text"]', frameDoc.querySelector('[data-text-item]'));
  }
  click('[data-action="delete-text"]');
  await waitFor(() => preview.getAttribute('aria-disabled') === 'true', 'final deletion did not disable preview');
  check(frameDoc.querySelectorAll('[data-text-item]').length === 1, 'final deletion keeps one validation card');
  check(frameDoc.querySelector('[data-text-item]').classList.contains('is-invalid'), 'final deletion marks the card invalid');
  check(frameWindow.getComputedStyle(preview).display === 'none', 'disabled preview is computed display none');

  input(frameDoc.querySelector('[name="text"]'), 'Restored');
  await waitFor(() => preview.getAttribute('aria-disabled') === 'false', 'valid text did not restore preview');
  check(frameWindow.getComputedStyle(preview).display !== 'none', 'valid text makes preview visible again');

  const validBeforeBadImport = textValues();
  await importFile('bad.json', '{bad json');
  check(JSON.stringify(textValues()) === JSON.stringify(validBeforeBadImport), 'bad JSON import preserves draft controls');
  check(frameDoc.querySelector('[data-io-status]').classList.contains('is-error'), 'bad JSON import shows inline error');

  frameDoc.querySelector('[data-io-status]').textContent = '';
  await importFile('empty.json', '{"texts":[]}');
  await waitFor(() => preview.getAttribute('aria-disabled') === 'true', 'empty import did not disable preview');
  check(frameDoc.querySelectorAll('[data-text-item]').length === 1, 'empty import keeps one validation card');
  check(frameDoc.querySelector('[data-text-item]').classList.contains('is-invalid'), 'empty import marks its validation card invalid');
  check(frameWindow.getComputedStyle(preview).display === 'none', 'empty import hides preview');

  input(frameDoc.querySelector('[name="text"]'), 'Exportable');
  await waitFor(() => preview.getAttribute('aria-disabled') === 'false', 'exportable text did not restore preview');
  input(frameDoc.querySelector('[data-text-layout="fontSize"]'), '39');
  await waitFor(() => preview.config.texts[0].layout?.fontSize === 39, 'exportable per-text layout did not reach preview');
  click('[data-action="copy-config"]');
  await waitFor(() => harness.clipboardText !== '', 'Clipboard API copy did not complete');
  check(JSON.parse(harness.clipboardText).texts[0].text === 'Exportable', 'Clipboard API copies normalized JSON');

  harness.clipboardMode = 'fallback';
  click('[data-action="copy-config"]');
  await waitFor(() => harness.fallbackText !== '', 'clipboard fallback did not complete');
  check(JSON.parse(harness.fallbackText).texts[0].text === 'Exportable', 'selected textarea fallback copies normalized JSON');

  click('[data-action="download-config"]');
  await waitFor(() => harness.downloadedBlob !== null, 'Blob download did not complete');
  check(harness.downloadedName === 'orbit-text-config.json', 'download uses orbit-text-config.json filename');
  const downloadedConfig = JSON.parse(await harness.downloadedBlob.text());
  check(downloadedConfig.texts[0].text === 'Exportable', 'download Blob contains normalized JSON');
  check(downloadedConfig.texts[0].layout.fontSize === 39, 'download preserves per-text layout overrides');
  const exportProbe = frameDoc.createElement('orbit-text-reveal');
  exportProbe.style.cssText = 'display:block;width:480px;height:240px';
  exportProbe.config = downloadedConfig;
  frameDoc.body.append(exportProbe);
  await exportProbe.ready;
  check(
    exportProbe.shadowRoot.querySelector('.sr-text').textContent === 'Exportable'
      && exportProbe.shadowRoot.querySelectorAll('.line').length > 0,
    'exported developer JSON drives the shared component'
  );
  exportProbe.destroy();
  exportProbe.remove();
  await sleep(0);
  check(harness.revokedUrl === 'blob:orbit-dev-test', 'download object URL is revoked');

  check(frameWindow.getComputedStyle(frameDoc.querySelector('.dev-layout')).gridTemplateColumns.split(' ').length === 1, 'developer page uses one column below 960px');
  frame.style.width = '1200px';
  await nextFrame();
  await nextFrame();
  check(frameWindow.getComputedStyle(frameDoc.querySelector('.dev-layout')).gridTemplateColumns.split(' ').length === 2, 'developer page uses two columns at desktop width');

  delete window.__orbitDevTestHarness;
  frame.remove();
}

async function run() {
  await runProductionBoundaryCheck();
  await runDeveloperPageCheck();
  await runMainCycle();
  await runControlAndLifecycleChecks();
  await runSafeBoundaryAndVisibilityChecks();
  await runTypographyAndEasingChecks();
  await runResizeObserverChecks();
  await runReducedMotionCheck();
  checks.push('ALL TESTS PASSED');
  results.textContent = checks.join('\n');
  document.body.dataset.status = 'passed';
}

run().catch((error) => {
  results.textContent = `${checks.join('\n')}\nFAIL ${error.stack || error.message}`.trim();
  document.body.dataset.status = 'failed';
  throw error;
});

import { computeResponsiveStageWidth } from './responsive-layout.js?v=20260724-1';

export function clampProgress(value) {
  return Math.min(1, Math.max(0, value));
}

const DAMPING_EPSILON = 0.0001;

export function advanceDampedProgress(current, target, deltaMs, responseMs = 72) {
  const from = clampProgress(current);
  const to = clampProgress(target);
  if (Math.abs(to - from) <= DAMPING_EPSILON) return to;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return from;
  const response = Math.max(1, Number.isFinite(responseMs) ? responseMs : 72);
  const alpha = 1 - Math.exp(-deltaMs / response);
  const next = from + (to - from) * alpha;
  return Math.abs(to - next) <= DAMPING_EPSILON ? to : next;
}

export function computeIntroFrame(progress, viewport, { reducedMotion = false } = {}) {
  const p = clampProgress(progress);
  const { width, height } = viewport;
  const centerY = height / 2;
  const orbitTargetY = Math.min(
    Math.max(0.18 * height, 0.15 * height + 0.03 * width),
    0.20 * height
  );
  const orbitScale = 1 - 0.35 * p;
  const orbitOffsetY = p === 0 ? 0 : p * (orbitTargetY - centerY);

  const platformAppearStart = 0.62;
  const platformAppearEnd = 0.88;
  const platformOpacity = p <= platformAppearStart
    ? 0
    : p >= platformAppearEnd
      ? 1
      : (p - platformAppearStart) / (platformAppearEnd - platformAppearStart);

  let platformTranslateY;
  if (reducedMotion) {
    platformTranslateY = 24 * (1 - p);
  } else if (p < 0.62) {
    platformTranslateY = 24;
  } else if (p < 0.84) {
    const t = (p - 0.62) / (0.84 - 0.62);
    platformTranslateY = 24 * (1 - t);
  } else if (p < 0.90) {
    const t = (p - 0.84) / (0.90 - 0.84);
    platformTranslateY = -5 * t;
  } else if (p < 1) {
    const t = (p - 0.90) / (1 - 0.90);
    platformTranslateY = -5 * (1 - t);
  } else {
    platformTranslateY = 0;
  }

  return {
    progress: p,
    orbitStageWidth: computeResponsiveStageWidth(width, height),
    orbitScale,
    orbitOffsetY,
    platformOpacity,
    platformTranslateY,
    interactive: platformOpacity >= 0.98
  };
}

function asCards(platforms, cards) {
  if (cards) return [...cards];
  return [...platforms.querySelectorAll?.('.platform-card__action') ?? []];
}

export function createIntroScrollController({
  windowRef = globalThis,
  documentRef = globalThis.document,
  sequence,
  host,
  platforms,
  cards,
  reducedMotionQuery = '(prefers-reduced-motion: reduce)',
  settle = true
} = {}) {
  if (!sequence || !host || !platforms) {
    throw new Error('createIntroScrollController requires sequence, host, and platforms');
  }

  let settleTimer = null;
  let pendingRaf = null;
  let isDestroyed = false;
  let lastInteractive = null;
  let activeSettle = null;
  let lastFrameTime = null;
  const getTravel = () => Math.max(0, sequence.scrollHeight - windowRef.innerHeight);
  const getScrollTop = () => Math.max(0, -sequence.getBoundingClientRect().top);
  const getProgress = () => {
    const travel = getTravel();
    return travel > 0 ? clampProgress(getScrollTop() / travel) : 0;
  };
  let lastScrollTop = getScrollTop();
  let targetProgress = getProgress();
  let displayedProgress = targetProgress;
  let lastScrollDirection = 0;
  const cardElements = asCards(platforms, cards);
  const media = typeof windowRef.matchMedia === 'function'
    ? windowRef.matchMedia(reducedMotionQuery)
    : null;

  const reducedMotion = () => Boolean(media?.matches);
  const cancelPendingSettle = () => {
    if (settleTimer !== null) windowRef.clearTimeout?.(settleTimer);
    settleTimer = null;
  };
  const cancelActiveSettle = () => {
    if (!activeSettle) return;
    activeSettle = null;
    lastFrameTime = null;
    targetProgress = getProgress();
  };

  function applyFrame(frame) {
    host.style.setProperty('--orbit-stage-width', `${frame.orbitStageWidth}px`);
    host.style.setProperty('--orbit-page-y', `${frame.orbitOffsetY}px`);
    host.style.setProperty('--orbit-page-scale', String(frame.orbitScale));
    platforms.style.setProperty('--platform-opacity', String(frame.platformOpacity));
    platforms.style.setProperty('--platform-translate-y', `${frame.platformTranslateY}px`);
    platforms.style.pointerEvents = frame.interactive ? 'auto' : 'none';

    const total = Math.max(1, cardElements.length - 1);
    cardElements.forEach((card, index) => {
      const delay = cardElements.length > 1 ? (index / total) * 0.06 : 0;
      const cardProgress = clampProgress((frame.platformOpacity - delay) / (1 - delay));
      card.style.setProperty('--platform-card-opacity', String(cardProgress));
      card.style.setProperty('--platform-card-y', `${24 * (1 - cardProgress)}px`);
    });

    if (lastInteractive === null || lastInteractive !== frame.interactive) {
      platforms.inert = !frame.interactive;
      platforms.setAttribute('aria-hidden', String(!frame.interactive));
      lastInteractive = frame.interactive;
    }
  }

  function sampleScrollTarget() {
    const travel = getTravel();
    const scrollTop = getScrollTop();
    const delta = scrollTop - lastScrollTop;
    if (delta !== 0) lastScrollDirection = delta > 0 ? 1 : -1;
    lastScrollTop = scrollTop;
    targetProgress = travel > 0 ? clampProgress(scrollTop / travel) : 0;
  }

  function runActiveSettle(timestamp) {
    if (!activeSettle) return false;
    if (activeSettle.startedAt === null) activeSettle.startedAt = timestamp;
    const elapsed = Math.max(0, timestamp - activeSettle.startedAt);
    const t = clampProgress(elapsed / activeSettle.durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const top = t >= 1
      ? activeSettle.toTop
      : activeSettle.fromTop + (activeSettle.toTop - activeSettle.fromTop) * eased;
    windowRef.scrollTo?.({ top, behavior: 'auto' });
    activeSettle.lastCommandedTop = top;
    lastScrollTop = top;
    const travel = getTravel();
    targetProgress = travel > 0 ? clampProgress(top / travel) : 0;
    displayedProgress = clampProgress(
      activeSettle.fromDisplayedProgress
        + (activeSettle.toProgress - activeSettle.fromDisplayedProgress) * eased
    );
    if (t >= 1) activeSettle = null;
    return true;
  }

  function readFrame(timestamp = 0) {
    if (isDestroyed) return;
    const settlingThisFrame = runActiveSettle(timestamp);

    if (settlingThisFrame) {
      // The settle curve is already continuous and owns the visual progress.
    } else if (reducedMotion()) {
      displayedProgress = targetProgress;
    } else {
      const deltaMs = lastFrameTime === null
        ? 16
        : Math.max(0, timestamp - lastFrameTime);
      displayedProgress = advanceDampedProgress(displayedProgress, targetProgress, deltaMs);
    }
    lastFrameTime = timestamp;

    const frame = computeIntroFrame(displayedProgress, {
      width: windowRef.innerWidth,
      height: windowRef.innerHeight
    }, { reducedMotion: reducedMotion() });
    applyFrame(frame);

    if (activeSettle || Math.abs(displayedProgress - targetProgress) > DAMPING_EPSILON) {
      scheduleFrame();
    } else {
      displayedProgress = targetProgress;
      lastFrameTime = null;
    }
  }

  function armSettle() {
    cancelPendingSettle();
    if (!settle || reducedMotion() || activeSettle || targetProgress <= 0 || targetProgress >= 1) return;
    settleTimer = windowRef.setTimeout?.(() => {
      settleTimer = null;
      if (isDestroyed) return;
      const currentTravel = getTravel();
      if (currentTravel <= 0) return;
      const currentTop = getScrollTop();
      const currentProgress = clampProgress(currentTop / currentTravel);
      if (currentProgress <= 0 || currentProgress >= 1) return;
      const targetTop = currentProgress < 0.5 || (currentProgress === 0.5 && lastScrollDirection <= 0)
        ? 0
        : sequence.scrollHeight - windowRef.innerHeight;
      activeSettle = {
        fromTop: currentTop,
        toTop: targetTop,
        lastCommandedTop: currentTop,
        fromDisplayedProgress: displayedProgress,
        toProgress: clampProgress(targetTop / currentTravel),
        startedAt: null,
        durationMs: 260
      };
      scheduleFrame();
    }, 140) ?? null;
  }

  function scheduleFrame() {
    if (isDestroyed || pendingRaf !== null) return;
    if (typeof windowRef.requestAnimationFrame !== 'function') {
      readFrame();
      return;
    }
    pendingRaf = windowRef.requestAnimationFrame((timestamp) => {
      pendingRaf = null;
      readFrame(timestamp);
    });
  }

  function onScroll() {
    cancelPendingSettle();
    if (activeSettle) {
      const currentTop = getScrollTop();
      if (Math.abs(currentTop - activeSettle.lastCommandedTop) > 1) {
        cancelActiveSettle();
      }
    }
    sampleScrollTarget();
    scheduleFrame();
    if (!activeSettle) armSettle();
  }
  function onUserInput() {
    cancelPendingSettle();
    cancelActiveSettle();
  }
  function onResize() {
    sampleScrollTarget();
    scheduleFrame();
  }
  function onMotionPreferenceChange() {
    cancelPendingSettle();
    cancelActiveSettle();
    sampleScrollTarget();
    lastFrameTime = null;
    scheduleFrame();
  }

  windowRef.addEventListener?.('scroll', onScroll, { passive: true });
  windowRef.addEventListener?.('wheel', onUserInput, { passive: true });
  windowRef.addEventListener?.('touchstart', onUserInput, { passive: true });
  windowRef.addEventListener?.('resize', onResize, { passive: true });
  media?.addEventListener?.('change', onMotionPreferenceChange);
  scheduleFrame();

  return {
    start: scheduleFrame,
    update: scheduleFrame,
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      cancelPendingSettle();
      activeSettle = null;
      if (pendingRaf !== null) windowRef.cancelAnimationFrame?.(pendingRaf);
      pendingRaf = null;
      windowRef.removeEventListener?.('scroll', onScroll);
      windowRef.removeEventListener?.('wheel', onUserInput);
      windowRef.removeEventListener?.('touchstart', onUserInput);
      windowRef.removeEventListener?.('resize', onResize);
      media?.removeEventListener?.('change', onMotionPreferenceChange);
    }
  };
}

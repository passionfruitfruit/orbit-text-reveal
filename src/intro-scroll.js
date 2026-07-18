export function clampProgress(value) {
  return Math.min(1, Math.max(0, value));
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
  let activeSettle = false;
  let lastScrollTop = Math.max(0, -sequence.getBoundingClientRect().top);
  let lastScrollDirection = 0;
  const cardElements = asCards(platforms, cards);
  const media = typeof windowRef.matchMedia === 'function'
    ? windowRef.matchMedia(reducedMotionQuery)
    : null;

  const reducedMotion = () => Boolean(media?.matches);
  const getTravel = () => Math.max(0, sequence.scrollHeight - windowRef.innerHeight);
  const cancelPendingSettle = () => {
    if (settleTimer !== null) windowRef.clearTimeout?.(settleTimer);
    settleTimer = null;
  };
  const cancelActiveSettle = () => {
    if (!activeSettle) return;
    activeSettle = false;
    const top = Math.max(0, -sequence.getBoundingClientRect().top);
    windowRef.scrollTo?.({ top, behavior: 'auto' });
  };

  function applyFrame(frame) {
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

  function readFrame() {
    if (isDestroyed) return;
    const travel = getTravel();
    const scrollTop = Math.max(0, -sequence.getBoundingClientRect().top);
    const delta = scrollTop - lastScrollTop;
    if (delta !== 0) lastScrollDirection = delta > 0 ? 1 : -1;
    lastScrollTop = scrollTop;
    const rawProgress = travel > 0 ? scrollTop / travel : 0;
    const frame = computeIntroFrame(rawProgress, {
      width: windowRef.innerWidth,
      height: windowRef.innerHeight
    }, { reducedMotion: reducedMotion() });
    applyFrame(frame);

    cancelPendingSettle();
    if (activeSettle && (frame.progress <= 0 || frame.progress >= 1)) activeSettle = false;
    if (activeSettle) return;
    if (!settle || reducedMotion() || frame.progress <= 0 || frame.progress >= 1) return;
    settleTimer = windowRef.setTimeout?.(() => {
      settleTimer = null;
      if (isDestroyed) return;
      const currentTravel = getTravel();
      if (currentTravel <= 0) return;
      const currentProgress = clampProgress(-sequence.getBoundingClientRect().top / currentTravel);
      if (currentProgress <= 0 || currentProgress >= 1) return;
      const top = currentProgress < 0.5 || (currentProgress === 0.5 && lastScrollDirection <= 0)
        ? 0
        : sequence.scrollHeight - windowRef.innerHeight;
      activeSettle = true;
      windowRef.scrollTo?.({ top, behavior: 'smooth' });
    }, 140) ?? null;
  }

  function scheduleFrame() {
    if (isDestroyed || pendingRaf !== null) return;
    if (typeof windowRef.requestAnimationFrame !== 'function') {
      readFrame();
      return;
    }
    pendingRaf = windowRef.requestAnimationFrame(() => {
      pendingRaf = null;
      readFrame();
    });
  }

  function onScroll() {
    cancelPendingSettle();
    scheduleFrame();
  }
  function onUserInput() {
    cancelPendingSettle();
    cancelActiveSettle();
  }
  function onResize() { scheduleFrame(); }

  windowRef.addEventListener?.('scroll', onScroll, { passive: true });
  windowRef.addEventListener?.('wheel', onUserInput, { passive: true });
  windowRef.addEventListener?.('touchstart', onUserInput, { passive: true });
  windowRef.addEventListener?.('resize', onResize, { passive: true });
  media?.addEventListener?.('change', onResize);
  scheduleFrame();

  return {
    start: scheduleFrame,
    update: scheduleFrame,
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      cancelPendingSettle();
      activeSettle = false;
      if (pendingRaf !== null) windowRef.cancelAnimationFrame?.(pendingRaf);
      pendingRaf = null;
      windowRef.removeEventListener?.('scroll', onScroll);
      windowRef.removeEventListener?.('wheel', onUserInput);
      windowRef.removeEventListener?.('touchstart', onUserInput);
      windowRef.removeEventListener?.('resize', onResize);
      media?.removeEventListener?.('change', onResize);
    }
  };
}

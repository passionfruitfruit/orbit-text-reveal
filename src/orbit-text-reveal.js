import { normalizeConfig } from './config.js?v=20260711-4';
import { computeLineMotionFrame } from './motion.js?v=20260711-6';
import { computeTraversalTiming, computeVisibleLineLayout } from './progressive-layout.js?v=20260711-4';
import { fitTextLayoutToStage, fitTextSequenceToStage } from './stage-layout.js?v=20260711-4';

const ABORT_ERROR = () => new DOMException('Animation aborted', 'AbortError');

const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

function pointTransform(point) {
  return `translate3d(${point.x}px, ${point.y}px, 0)`;
}

function positionFrom(value, total) {
  const match = /^\s*(-?\d+(?:\.\d+)?)%\s*$/.exec(value);
  if (match) return total * Number(match[1]) / 100;
  const pixels = Number.parseFloat(value);
  return Number.isFinite(pixels) ? pixels : total / 2;
}

function cssLength(value, emSize, fallback) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*(px|em)?\s*$/.exec(value);
  if (!match) return fallback;
  const amount = Number(match[1]);
  return match[2] === 'em' ? amount * emSize : amount;
}

function cssValue(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

export class OrbitTextReveal extends HTMLElement {
  #config = normalizeConfig();
  #index = 0;
  #state = 'idle';
  #geometry = null;
  #lineViews = [];
  #ballPosition = { x: 0, y: 0 };
  #controller = null;
  #loopPromise = null;
  #activeAnimations = new Set();
  #activeDelays = new Set();
  #paused = false;
  #userPaused = false;
  #visibilityPaused = false;
  #visibilityDocument = null;
  #pendingConfig = null;
  #pendingReflow = false;
  #destroyed = false;
  #readyResolve;
  #resizeObserver = null;
  #lastObservedSize = null;
  #ignoreInitialResize = true;
  #layoutStarted = false;
  #autoFitScale = 1;
  #resolvedScale = 1;
  #resolvedFontSize = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; contain: layout paint; }
        .stage { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--orbit-background); }
        .visual { position: absolute; inset: 0; }
        .lines { position: absolute; inset: 0; z-index: 1; }
        .line { position: absolute; left: 0; overflow: hidden; white-space: nowrap; will-change: clip-path; }
        .line-content { position: absolute; left: 0; top: 0; white-space: pre; will-change: transform; }
        .glyph { display: inline-block; font-kerning: none; font-variant-ligatures: none; transform-origin: right center; will-change: transform; }
        .ball { position: absolute; left: 0; top: 0; z-index: 2; border-radius: 50%; will-change: transform; }
        .sr-text { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      </style>
      <div class="stage" role="status" aria-live="polite">
        <span class="sr-text"></span>
        <div class="visual" aria-hidden="true">
          <div class="lines"></div>
          <div class="ball"></div>
        </div>
      </div>`;
    this.#resetReady();
  }

  connectedCallback() {
    if (this.#destroyed) return;
    this.#visibilityDocument = this.ownerDocument;
    this.#visibilityDocument.addEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#visibilityPaused = this.#visibilityDocument.visibilityState === 'hidden';
    this.#syncPaused();
    this.#ignoreInitialResize = true;
    this.#layoutStarted = false;
    this.#lastObservedSize = this.#readSize();
    this.#resizeObserver = new ResizeObserver((entries) => {
      this.#handleObservedResize(entries.at(-1));
    });
    this.#resizeObserver.observe(this);
    if (this.#lastObservedSize) this.#renderAndStart();
  }

  disconnectedCallback() {
    this.#visibilityDocument?.removeEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#visibilityDocument = null;
    this.#visibilityPaused = false;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#lastObservedSize = null;
    this.#ignoreInitialResize = true;
    this.#layoutStarted = false;
    this.#cancelRun();
  }

  set config(value) {
    this.updateConfig(value);
  }

  updateConfig(value, { immediate = false } = {}) {
    const normalized = normalizeConfig(value);
    if (!immediate && this.isConnected && this.#loopPromise && this.#geometry) {
      this.#pendingConfig = normalized;
      this.#resetReady();
      return;
    }
    this.#applyConfigImmediately(normalized);
  }

  get config() {
    return clone(this.#pendingConfig ?? this.#config);
  }

  get ready() {
    return this.#readyPromise;
  }

  play() {
    if (this.#destroyed) return;
    this.#userPaused = false;
    this.#syncPaused();
    if (!this.#loopPromise && this.isConnected) this.#startLoop();
  }

  pause() {
    if (this.#destroyed) return;
    this.#userPaused = true;
    this.#syncPaused();
  }

  restart() {
    if (this.#destroyed) return;
    this.#userPaused = false;
    this.#resetReady();
    this.#cancelRun();
    if (this.isConnected && this.#readSize()) this.#renderAndStart();
  }

  next() {
    if (this.#destroyed) return;
    this.#userPaused = false;
    this.#cancelRun();
    if (this.#config.texts.length > 0) {
      this.#index = (this.#index + 1) % this.#config.texts.length;
      this.#dispatchIndex();
    }
    this.#resetReady();
    if (this.isConnected && this.#readSize()) this.#renderAndStart();
  }

  destroy() {
    this.#destroyed = true;
    this.#visibilityDocument?.removeEventListener('visibilitychange', this.#handleVisibilityChange);
    this.#visibilityDocument = null;
    this.#cancelRun();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#lastObservedSize = null;
    this.#layoutStarted = false;
    this.#lineViews = [];
    this.shadowRoot.querySelector('.lines').replaceChildren();
    this.shadowRoot.querySelector('.ball').hidden = true;
    this.shadowRoot.querySelector('.sr-text').textContent = '';
    this.#setState('destroyed');
  }

  debugSnapshot() {
    return clone({
      state: this.#state,
      index: this.#index,
      center: this.#geometry?.center ?? this.#ballPosition,
      ball: this.#ballPosition,
      geometry: this.#geometry,
      lineCount: this.#lineViews.length,
      renderedLines: this.#lineViews.map((view) => ({
        index: view.geometry.index,
        top: view.renderTop,
        centerY: view.renderCenterY
      })),
      autoFitScale: this.#autoFitScale,
      resolvedScale: this.#resolvedScale
    });
  }

  #readyPromise;

  #handleVisibilityChange = () => {
    this.#visibilityPaused = this.#visibilityDocument?.visibilityState === 'hidden';
    this.#syncPaused();
  };

  #syncPaused() {
    const shouldPause = this.#userPaused || this.#visibilityPaused;
    if (shouldPause === this.#paused) return;
    this.#paused = shouldPause;
    for (const animation of this.#activeAnimations) {
      if (shouldPause) animation.pause();
      else animation.play();
    }
    for (const delay of this.#activeDelays) {
      if (shouldPause) delay.pause();
      else delay.resume();
    }
  }

  #applyConfigImmediately(normalized) {
    const previousIndex = this.#index;
    this.#config = normalized;
    this.#pendingConfig = null;
    this.#pendingReflow = false;
    this.#index = 0;
    this.#destroyed = false;
    this.#userPaused = false;
    this.#resetReady();
    this.#cancelRun();
    if (previousIndex !== 0) this.#dispatchIndex();
    if (this.isConnected && this.#readSize()) this.#renderAndStart();
  }

  #resetReady() {
    this.#readyPromise = new Promise((resolve) => { this.#readyResolve = resolve; });
  }

  #renderAndStart() {
    this.#layoutStarted = true;
    this.#render();
    this.#readyResolve?.();
    this.#readyResolve = null;
    this.#startLoop();
  }

  #readSize(entry) {
    const borderBox = Array.isArray(entry?.borderBoxSize)
      ? entry.borderBoxSize[0]
      : entry?.borderBoxSize;
    const rect = entry?.contentRect ?? this.getBoundingClientRect();
    const width = Number(borderBox?.inlineSize ?? rect.width);
    const height = Number(borderBox?.blockSize ?? rect.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  }

  #handleObservedResize(entry) {
    if (!this.isConnected || !entry) return;
    const size = this.#readSize(entry);

    if (this.#ignoreInitialResize) {
      this.#ignoreInitialResize = false;
      if (!size) return;
      this.#lastObservedSize = size;
      if (!this.#layoutStarted) this.#renderAndStart();
      return;
    }

    if (!size) return;
    const previous = this.#lastObservedSize;
    this.#lastObservedSize = size;
    if (!previous) {
      if (!this.#layoutStarted) this.#renderAndStart();
      return;
    }

    const changed = Math.abs(size.width - previous.width) > 0.01
      || Math.abs(size.height - previous.height) > 0.01;
    if (changed) {
      if (this.#loopPromise && this.#geometry) this.#pendingReflow = true;
      else this.restart();
    }
  }

  #render() {
    const item = this.#config.texts[this.#index];
    const linesLayer = this.shadowRoot.querySelector('.lines');
    const stage = this.shadowRoot.querySelector('.stage');
    const ball = this.shadowRoot.querySelector('.ball');
    const srText = this.shadowRoot.querySelector('.sr-text');
    linesLayer.replaceChildren();
    this.#lineViews = [];
    this.#geometry = null;
    this.#autoFitScale = 1;
    this.#resolvedScale = this.#config.layout.scale;
    this.#resolvedFontSize = 0;

    srText.textContent = item?.text ?? '';

    const externalStyle = getComputedStyle(this);
    const layout = { ...this.#config.layout, ...item?.layout };
    layout.fontSize = cssLength(
      externalStyle.getPropertyValue('--orbit-font-size'),
      layout.fontSize,
      layout.fontSize
    );
    const ballSize = cssLength(
      externalStyle.getPropertyValue('--orbit-ball-size'),
      layout.fontSize,
      layout.fontSize * layout.ballSizeEm
    );
    const ballGap = cssLength(
      externalStyle.getPropertyValue('--orbit-ball-gap'),
      layout.fontSize,
      layout.fontSize * layout.ballGapEm
    );
    layout.ballSizeEm = ballSize / layout.fontSize;
    layout.ballGapEm = ballGap / layout.fontSize;
    const configuredStyle = this.#config.style;
    const externalWeight = Number(externalStyle.getPropertyValue('--orbit-font-weight'));
    const style = {
      ...configuredStyle,
      fontFamily: cssValue(externalStyle, '--orbit-font-family', configuredStyle.fontFamily),
      fontWeight: Number.isFinite(externalWeight) && externalWeight > 0
        ? Math.min(900, Math.max(100, externalWeight))
        : configuredStyle.fontWeight,
      textColor: cssValue(externalStyle, '--orbit-text-color', configuredStyle.textColor),
      ballColor: cssValue(externalStyle, '--orbit-ball-color', configuredStyle.ballColor),
      background: cssValue(externalStyle, '--orbit-background', configuredStyle.background)
    };
    stage.style.background = style.background;
    stage.style.color = style.textColor;
    const fontSize = layout.fontSize * layout.scale;
    const width = this.clientWidth || window.innerWidth || layout.maxWidth;
    const height = this.clientHeight || window.innerHeight || fontSize * 3;

    if (!item) {
      const ballSize = fontSize * layout.ballSizeEm;
      this.#resolvedFontSize = fontSize;
      ball.hidden = false;
      ball.style.width = `${ballSize}px`;
      ball.style.height = `${ballSize}px`;
      ball.style.margin = `${-ballSize / 2}px 0 0 ${-ballSize / 2}px`;
      ball.style.background = style.ballColor;
      this.#setBallPosition({
        x: positionFrom(layout.x, width),
        y: positionFrom(layout.y, height)
      });
      this.#setState('empty');
      return;
    }

    const font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;
    const measure = (text) => context.measureText(text).width;
    const fitOptions = {
      text: item.text,
      layout,
      availableWidth: width,
      centerX: positionFrom(layout.x, width),
      centerY: positionFrom(layout.y, height),
      availableHeight: height,
      safeMargin: 16,
      measure
    };
    let fittedLayout;
    if (!item.layout) {
      const globalItems = this.#config.texts.filter((candidate) => !candidate.layout);
      const globalIndex = globalItems.indexOf(item);
      fittedLayout = fitTextSequenceToStage({
        ...fitOptions,
        texts: globalItems.map((candidate) => candidate.text)
      })[globalIndex];
    } else {
      fittedLayout = fitTextLayoutToStage(fitOptions);
    }
    if (!fittedLayout.fits) throw new Error('Stage layout could not be fitted safely');
    this.#geometry = fittedLayout.geometry;
    this.#autoFitScale = fittedLayout.autoFitScale;
    this.#resolvedScale = fittedLayout.resolvedScale;
    this.#resolvedFontSize = fittedLayout.fontSize;
    const resolvedFont = `${style.fontWeight} ${fittedLayout.fontSize}px ${style.fontFamily}`;

    stage.style.font = resolvedFont;
    stage.style.lineHeight = `${fittedLayout.lineHeightPx}px`;
    for (const line of this.#geometry.lines) {
      const mask = document.createElement('div');
      mask.className = 'line';
      mask.style.cssText = `top:${line.y}px;width:${width}px;height:${fittedLayout.lineHeightPx}px`;
      const content = document.createElement('div');
      content.className = 'line-content';
      content.style.width = `${line.width}px`;
      let consumedWidth = 0;
      const glyphs = line.graphemes.map((grapheme, index) => {
        const glyph = document.createElement('span');
        glyph.className = 'glyph';
        glyph.textContent = grapheme;
        const glyphWidth = line.widths[index];
        glyph.style.width = `${glyphWidth}px`;
        const center = consumedWidth + glyphWidth / 2;
        consumedWidth += glyphWidth;
        content.append(glyph);
        return { element: glyph, center };
      });
      mask.append(content);
      linesLayer.append(mask);
      const view = {
        mask,
        content,
        glyphs,
        geometry: line,
        stageWidth: width,
        renderTop: line.y,
        renderCenterY: line.start.y
      };
      this.#lineViews.push(view);
      this.#applyLineFrame(view, 0);
    }

    this.#positionVisibleLines(1);

    ball.hidden = false;
    ball.style.width = `${fittedLayout.ballSize}px`;
    ball.style.height = `${fittedLayout.ballSize}px`;
    ball.style.margin = `${-fittedLayout.ballSize / 2}px 0 0 ${-fittedLayout.ballSize / 2}px`;
    ball.style.background = style.ballColor;
    this.#setBallPosition(this.#geometry.center);
  }

  #startLoop() {
    if (this.#loopPromise || this.#destroyed || !this.#geometry) return;
    const controller = new AbortController();
    const signal = controller.signal;
    this.#controller = controller;
    let loopPromise;
    loopPromise = this.#run(signal).catch((error) => {
      if (error?.name !== 'AbortError') queueMicrotask(() => { throw error; });
    }).finally(() => {
      if (this.#controller === controller) this.#controller = null;
      if (this.#loopPromise === loopPromise) this.#loopPromise = null;
    });
    this.#loopPromise = loopPromise;
  }

  async #run(signal) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced && !this.#config.accessibility.reducedMotionRotate) {
      this.#showFullyExpanded();
      this.#setState('expanded-hold');
      return;
    }

    while (!signal.aborted && this.#config.texts.length > 0) {
      if (reduced) {
        this.#showFullyExpanded();
        this.#setState('expanded-hold');
        await this.#delay(this.#currentItem().holdMs ?? this.#config.timing.centerHoldMs, signal);
      } else {
        await this.#runItem(signal);
      }
      signal.throwIfAborted();
      if (this.#applyPendingBoundaryUpdate()) continue;
      this.#index = (this.#index + 1) % this.#config.texts.length;
      this.#dispatchIndex();
      this.#pendingReflow = false;
      this.#render();
    }
  }

  #applyPendingBoundaryUpdate() {
    if (!this.#pendingConfig) return false;
    const previousIndex = this.#index;
    this.#config = this.#pendingConfig;
    this.#pendingConfig = null;
    this.#pendingReflow = false;
    this.#index = 0;
    if (previousIndex !== 0) this.#dispatchIndex();
    this.#render();
    this.#readyResolve?.();
    this.#readyResolve = null;
    return true;
  }

  async #runItem(signal) {
    const item = this.#currentItem();
    const timing = this.#config.timing;
    this.#setState('center-hold');
    await this.#delay(timing.centerHoldMs, signal);
    signal.throwIfAborted();
    this.#positionVisibleLines(1);
    this.#setBallPosition(this.#linePoint(this.#lineViews[0], 'start'));

    const revealBaselineDistance = this.#lineDistance(this.#lineViews[0]);
    const revealBaselineDuration = item.revealMs ?? timing.revealMs;

    for (let index = 0; index < this.#lineViews.length; index += 1) {
      const view = this.#lineViews[index];
      if (index > 0) {
        this.#positionVisibleLines(index + 1);
        this.#setState('line-jump');
        this.#setBallPosition(this.#linePoint(view, 'start'));
      }
      const traversal = this.#traversalTiming(
        view,
        revealBaselineDistance,
        revealBaselineDuration,
        index === 0
      );
      await this.#animateLine(
        view,
        0,
        1,
        traversal.duration,
        traversal.easing,
        'reveal-line',
        signal
      );
    }

    this.#setState('expanded-hold');
    await this.#delay(item.holdMs ?? timing.centerHoldMs, signal);

    const lastIndex = this.#lineViews.length - 1;
    const retractBaselineDistance = this.#lineDistance(this.#lineViews[lastIndex]);
    const retractBaselineDuration = item.retractMs ?? timing.retractMs;
    for (let index = lastIndex; index >= 0; index -= 1) {
      const view = this.#lineViews[index];
      const traversal = this.#traversalTiming(
        view,
        retractBaselineDistance,
        retractBaselineDuration,
        index === lastIndex
      );
      await this.#animateLine(
        view,
        1,
        0,
        traversal.duration,
        traversal.easing,
        'retract-line',
        signal
      );
      if (index > 0) {
        this.#positionVisibleLines(index);
        this.#setState('line-jump');
        this.#setBallPosition(this.#linePoint(this.#lineViews[index - 1], 'end'));
      }
    }

    signal.throwIfAborted();
    this.#setBallPosition(this.#geometry.center);
    this.#setState('recenter');
  }

  #currentItem() {
    return this.#config.texts[this.#index];
  }

  #showFullyExpanded() {
    this.#positionVisibleLines(this.#lineViews.length);
    for (const view of this.#lineViews) {
      this.#applyLineFrame(view, 1);
    }
    this.#setBallPosition(this.#linePoint(this.#lineViews.at(-1), 'end'));
  }

  async #animateLine(view, fromProgress, toProgress, duration, easing, state, signal) {
    this.#setState(state);
    const fromFrame = this.#lineFrame(view, fromProgress);
    const toFrame = this.#lineFrame(view, toProgress);
    if (duration === 0) {
      signal.throwIfAborted();
      this.#applyLineFrame(view, toProgress);
      return;
    }

    const options = { duration, easing, fill: 'forwards' };
    const maskAnimation = view.mask.animate(
      [{ clipPath: this.#clipPath(fromFrame) }, { clipPath: this.#clipPath(toFrame) }],
      options
    );
    const contentAnimation = view.content.animate(
      [
        { transform: `translate3d(${fromFrame.contentX}px,0,0)` },
        { transform: `translate3d(${toFrame.contentX}px,0,0)` }
      ],
      options
    );
    const ballAnimation = this.shadowRoot.querySelector('.ball').animate(
      [{ transform: pointTransform(fromFrame.ball) }, { transform: pointTransform(toFrame.ball) }],
      options
    );
    this.#trackAnimation(maskAnimation);
    this.#trackAnimation(contentAnimation);
    this.#trackAnimation(ballAnimation);
    let frame = 0;
    const updateGlyphs = () => {
      const computedProgress = maskAnimation.effect.getComputedTiming().progress;
      const fraction = typeof computedProgress === 'number'
        ? Math.min(1, Math.max(0, computedProgress))
        : 0;
      const progress = fromProgress + (toProgress - fromProgress) * fraction;
      this.#setGlyphScales(view, this.#lineFrame(view, progress).glyphScales);
      if (maskAnimation.playState !== 'finished' && maskAnimation.playState !== 'idle') {
        frame = requestAnimationFrame(updateGlyphs);
      }
    };
    frame = requestAnimationFrame(updateGlyphs);
    try {
      await this.#animationsFinished([maskAnimation, contentAnimation, ballAnimation], signal);
    } finally {
      cancelAnimationFrame(frame);
      this.#untrackAnimation(maskAnimation);
      this.#untrackAnimation(contentAnimation);
      this.#untrackAnimation(ballAnimation);
    }
    this.#applyLineFrame(view, toProgress);
    maskAnimation.cancel();
    contentAnimation.cancel();
    ballAnimation.cancel();
  }

  #lineFrame(view, progress) {
    const line = {
      ...view.geometry,
      start: { ...view.geometry.start, y: view.renderCenterY },
      end: { ...view.geometry.end, y: view.renderCenterY }
    };
    return computeLineMotionFrame({
      line,
      stageWidth: view.stageWidth,
      ballSize: this.#geometry.ballSize,
      progress,
      minScale: this.#config.motion.enableCharacterScale
        ? this.#config.motion.characterMinScale
        : 1
    });
  }

  #lineDistance(view) {
    return Math.abs(view.geometry.end.x - view.geometry.start.x);
  }

  #traversalTiming(view, baselineDistance, baselineDuration, first) {
    return computeTraversalTiming({
      distance: this.#lineDistance(view),
      baselineDistance,
      baselineDuration,
      first,
      easing: this.#config.motion.easing,
      continuationEasing: this.#config.motion.continuationEasing
    });
  }

  #linePoint(view, kind) {
    return { ...view.geometry[kind], y: view.renderCenterY };
  }

  #positionVisibleLines(visibleCount) {
    for (let index = 0; index < this.#lineViews.length; index += 1) {
      const view = this.#lineViews[index];
      view.mask.hidden = index >= visibleCount;
    }
    const positions = computeVisibleLineLayout({
      visibleCount,
      centerY: this.#geometry.center.y,
      lineHeightPx: this.#geometry.lineHeightPx
    });
    for (const position of positions) {
      const view = this.#lineViews[position.index];
      view.renderTop = position.top;
      view.renderCenterY = position.centerY;
      view.mask.style.top = `${position.top}px`;
    }
  }

  #clipPath(frame) {
    return `inset(0 ${frame.clipInsetRight}px 0 ${frame.clipLeft}px)`;
  }

  #setGlyphScales(view, scales) {
    for (let index = 0; index < view.glyphs.length; index += 1) {
      view.glyphs[index].element.style.transform = `scale(${scales[index]})`;
    }
  }

  #applyLineFrame(view, progress) {
    const frame = this.#lineFrame(view, progress);
    view.mask.style.clipPath = this.#clipPath(frame);
    view.content.style.transform = `translate3d(${frame.contentX}px,0,0)`;
    this.#setGlyphScales(view, frame.glyphScales);
    this.#setBallPosition(frame.ball);
  }

  #animationsFinished(animations, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => {
        for (const animation of animations) animation.cancel();
        reject(ABORT_ERROR());
      };
      signal.addEventListener('abort', abort, { once: true });
      Promise.all(animations.map((animation) => animation.finished)).then(
        () => {
          signal.removeEventListener('abort', abort);
          resolve();
        },
        (error) => {
          signal.removeEventListener('abort', abort);
          reject(signal.aborted ? ABORT_ERROR() : error);
        }
      );
    });
  }

  #trackAnimation(animation) {
    this.#activeAnimations.add(animation);
    if (this.#paused) animation.pause();
  }

  #untrackAnimation(animation) {
    this.#activeAnimations.delete(animation);
  }

  #delay(milliseconds, signal) {
    signal.throwIfAborted();
    if (milliseconds === 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const delay = {
        remaining: milliseconds,
        started: 0,
        timer: 0,
        pause: () => {
          if (!delay.timer) return;
          clearTimeout(delay.timer);
          delay.timer = 0;
          delay.remaining -= performance.now() - delay.started;
        },
        resume: () => {
          if (delay.timer || signal.aborted) return;
          delay.started = performance.now();
          delay.timer = setTimeout(finish, Math.max(0, delay.remaining));
        }
      };
      const cleanup = () => {
        clearTimeout(delay.timer);
        signal.removeEventListener('abort', abort);
        this.#activeDelays.delete(delay);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const abort = () => {
        cleanup();
        reject(ABORT_ERROR());
      };
      signal.addEventListener('abort', abort, { once: true });
      this.#activeDelays.add(delay);
      if (!this.#paused) delay.resume();
    });
  }

  #setBallPosition(point) {
    this.#ballPosition = { x: point.x, y: point.y };
    this.shadowRoot.querySelector('.ball').style.transform = pointTransform(point);
  }

  #setState(state) {
    this.#state = state;
    this.dispatchEvent(new CustomEvent('orbit-state-change', {
      detail: { state, index: this.#index },
      bubbles: true,
      composed: true
    }));
  }

  #dispatchIndex() {
    this.dispatchEvent(new CustomEvent('orbit-index-change', {
      detail: { index: this.#index },
      bubbles: true,
      composed: true
    }));
  }

  #cancelRun() {
    this.#controller?.abort();
    this.#controller = null;
    for (const animation of this.#activeAnimations) animation.cancel();
    this.#activeAnimations.clear();
    for (const delay of this.#activeDelays) delay.pause();
    this.#activeDelays.clear();
    this.#paused = this.#userPaused || this.#visibilityPaused;
    this.#loopPromise = null;
  }
}

if (!customElements.get('orbit-text-reveal')) {
  customElements.define('orbit-text-reveal', OrbitTextReveal);
}

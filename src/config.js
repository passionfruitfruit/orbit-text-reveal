export const DEFAULT_CONFIG = Object.freeze({
  texts: Object.freeze([{ text: '让想法自然展开', holdMs: 1800 }]),
  timing: Object.freeze({
    revealMs: 900,
    retractMs: 900,
    lineTravelMs: 260,
    centerHoldMs: 1000
  }),
  layout: Object.freeze({
    maxWidth: 680,
    fontSize: 64,
    lineHeight: 1.16,
    ballSizeEm: 0.78,
    ballGapEm: 0.08,
    x: '50%',
    y: '50%',
    scale: 1,
    autoWrap: true
  }),
  style: Object.freeze({
    textColor: '#111111',
    ballColor: '#111111',
    background: '#ecebe8',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: 700
  }),
  motion: Object.freeze({
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    lineEasing: 'cubic-bezier(0.76, 0, 0.24, 1)',
    continuationEasing: 'linear',
    characterScale: 1.12,
    characterMinScale: 0.08,
    enableCharacterScale: true
  }),
  accessibility: Object.freeze({ reducedMotionRotate: false })
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampNumber(value, fallback, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function stringOr(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

const LAYOUT_NUMBER_LIMITS = Object.freeze({
  maxWidth: [120, 2400],
  fontSize: [12, 240],
  lineHeight: [0.8, 2],
  ballSizeEm: [0.2, 2],
  ballGapEm: [0.2, 2],
  scale: [0.25, 4]
});

function normalizeLayoutOverride(input) {
  if (!isRecord(input)) return null;
  const layout = {};
  for (const [key, [minimum, maximum]] of Object.entries(LAYOUT_NUMBER_LIMITS)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) {
      layout[key] = clampNumber(input[key], input[key], minimum, maximum);
    }
  }
  for (const key of ['x', 'y']) {
    if (typeof input[key] === 'string') layout[key] = input[key];
  }
  if (typeof input.autoWrap === 'boolean') layout.autoWrap = input.autoWrap;
  return Object.keys(layout).length > 0 ? layout : null;
}

export function normalizeTextItem(input, index) {
  void index;
  if (!isRecord(input) || typeof input.text !== 'string' || input.text.trim() === '') {
    return null;
  }

  const item = { text: input.text };
  for (const key of ['holdMs', 'revealMs', 'retractMs']) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) {
      item[key] = clampNumber(input[key], 0, 0, 20_000);
    }
  }
  const layout = normalizeLayoutOverride(input.layout);
  if (layout) item.layout = layout;
  return item;
}

export function normalizeConfig(input) {
  const source = isRecord(input) ? input : {};
  const timing = isRecord(source.timing) ? source.timing : {};
  const layout = isRecord(source.layout) ? source.layout : {};
  const style = isRecord(source.style) ? source.style : {};
  const motion = isRecord(source.motion) ? source.motion : {};
  const accessibility = isRecord(source.accessibility) ? source.accessibility : {};

  const texts = Array.isArray(source.texts)
    ? source.texts
      .map((item, index) => normalizeTextItem(item, index))
      .filter((item) => item !== null)
    : DEFAULT_CONFIG.texts.map((item, index) => normalizeTextItem(item, index));

  return {
    texts,
    timing: {
      revealMs: clampNumber(timing.revealMs, DEFAULT_CONFIG.timing.revealMs, 0, 20_000),
      retractMs: clampNumber(timing.retractMs, DEFAULT_CONFIG.timing.retractMs, 0, 20_000),
      lineTravelMs: clampNumber(timing.lineTravelMs, DEFAULT_CONFIG.timing.lineTravelMs, 0, 20_000),
      centerHoldMs: clampNumber(timing.centerHoldMs, DEFAULT_CONFIG.timing.centerHoldMs, 0, 20_000)
    },
    layout: {
      maxWidth: clampNumber(layout.maxWidth, DEFAULT_CONFIG.layout.maxWidth, 120, 2400),
      fontSize: clampNumber(layout.fontSize, DEFAULT_CONFIG.layout.fontSize, 12, 240),
      lineHeight: clampNumber(layout.lineHeight, DEFAULT_CONFIG.layout.lineHeight, 0.8, 2),
      ballSizeEm: clampNumber(layout.ballSizeEm, DEFAULT_CONFIG.layout.ballSizeEm, 0.2, 2),
      ballGapEm: clampNumber(layout.ballGapEm, DEFAULT_CONFIG.layout.ballGapEm, 0.2, 2),
      x: stringOr(layout.x, DEFAULT_CONFIG.layout.x),
      y: stringOr(layout.y, DEFAULT_CONFIG.layout.y),
      scale: clampNumber(layout.scale, DEFAULT_CONFIG.layout.scale, 0.25, 4),
      autoWrap: typeof layout.autoWrap === 'boolean' ? layout.autoWrap : DEFAULT_CONFIG.layout.autoWrap
    },
    style: {
      textColor: stringOr(style.textColor, DEFAULT_CONFIG.style.textColor),
      ballColor: stringOr(style.ballColor, DEFAULT_CONFIG.style.ballColor),
      background: stringOr(style.background, DEFAULT_CONFIG.style.background),
      fontFamily: stringOr(style.fontFamily, DEFAULT_CONFIG.style.fontFamily),
      fontWeight: clampNumber(style.fontWeight, DEFAULT_CONFIG.style.fontWeight, 100, 900)
    },
    motion: {
      easing: stringOr(motion.easing, DEFAULT_CONFIG.motion.easing),
      lineEasing: stringOr(motion.lineEasing, DEFAULT_CONFIG.motion.lineEasing),
      continuationEasing: stringOr(
        motion.continuationEasing,
        DEFAULT_CONFIG.motion.continuationEasing
      ),
      characterScale: clampNumber(
        motion.characterScale,
        DEFAULT_CONFIG.motion.characterScale,
        0.7,
        1.5
      ),
      characterMinScale: clampNumber(
        motion.characterMinScale,
        DEFAULT_CONFIG.motion.characterMinScale,
        0.01,
        1
      ),
      enableCharacterScale: typeof motion.enableCharacterScale === 'boolean'
        ? motion.enableCharacterScale
        : DEFAULT_CONFIG.motion.enableCharacterScale
    },
    accessibility: {
      reducedMotionRotate: typeof accessibility.reducedMotionRotate === 'boolean'
        ? accessibility.reducedMotionRotate
        : DEFAULT_CONFIG.accessibility.reducedMotionRotate
    }
  };
}

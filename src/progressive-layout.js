export function computeVisibleLineLayout({ visibleCount, centerY, lineHeightPx }) {
  return Array.from({ length: Math.max(0, visibleCount) }, (_, index) => {
    const lineCenterY = centerY + (index - (visibleCount - 1) / 2) * lineHeightPx;
    return {
      index,
      top: lineCenterY - lineHeightPx / 2,
      centerY: lineCenterY
    };
  });
}

export function buildPathTimeline(distances) {
  const normalized = Array.isArray(distances)
    ? distances.map((distance) => (
      Number.isFinite(distance) ? Math.max(0, distance) : 0
    ))
    : [];
  const totalDistance = normalized.reduce((total, distance) => total + distance, 0);
  let cumulativeDistance = 0;
  const segments = normalized.map((distance, index) => {
    const start = totalDistance > 0 ? cumulativeDistance / totalDistance : 0;
    cumulativeDistance += distance;
    const end = totalDistance > 0 ? cumulativeDistance / totalDistance : 0;
    return { index, distance, start, end };
  });
  return { totalDistance, segments };
}

export function locatePathProgress(timeline, progress) {
  if (!timeline || !(timeline.totalDistance > 0) || !Array.isArray(timeline.segments)) {
    return null;
  }
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const traversable = timeline.segments.filter(({ distance }) => distance > 0);
  const segment = clamped >= 1
    ? traversable.at(-1)
    : traversable.find(({ end }) => clamped < end) ?? traversable.at(-1);
  if (!segment) return null;
  const span = segment.end - segment.start;
  const localProgress = span > 0
    ? Math.min(1, Math.max(0, (clamped - segment.start) / span))
    : 0;
  return { index: segment.index, localProgress };
}

export function computeCubicBezierEndpointSlope({ x2, y2 }) {
  const horizontal = 1 - x2;
  if (!Number.isFinite(horizontal) || horizontal === 0) return Number.POSITIVE_INFINITY;
  const vertical = 1 - y2;
  return Number.isFinite(vertical) ? vertical / horizontal : Number.NaN;
}

export function computeCubicBezierStartSlope({ x1, y1 }) {
  if (!Number.isFinite(x1) || x1 === 0) return Number.POSITIVE_INFINITY;
  return Number.isFinite(y1) ? y1 / x1 : Number.NaN;
}

function cubicBezierDerivative(firstControl, secondControl, t) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * firstControl
    + 6 * inverse * t * (secondControl - firstControl)
    + 3 * t * t * (1 - secondControl);
}

export function computeCubicBezierSlopeAt({ x1, y1, x2, y2, t }) {
  const resolvedT = Math.min(1, Math.max(0, t));
  const horizontal = cubicBezierDerivative(x1, x2, resolvedT);
  if (!Number.isFinite(horizontal) || horizontal === 0) return Number.POSITIVE_INFINITY;
  const vertical = cubicBezierDerivative(y1, y2, resolvedT);
  return Number.isFinite(vertical) ? vertical / horizontal : Number.NaN;
}

export const DEFAULT_SPEED_FACTORS = Object.freeze({
  entry: 1.5,
  cruise: 1,
  exit: 1.5,
  single: 1.5
});

export function traversalRole({ position, count }) {
  if (count <= 1) return 'single';
  if (position <= 0) return 'entry';
  if (position >= count - 1) return 'exit';
  return 'cruise';
}

export function computeTraversalTiming({
  distance,
  referenceDistance,
  referenceDuration,
  role,
  easing,
  continuationEasing,
  exitEasing,
  singleLineEasing,
  speedFactors = DEFAULT_SPEED_FACTORS
}) {
  const baseDuration = referenceDistance > 0
    ? referenceDuration * distance / referenceDistance
    : 0;
  const factor = speedFactors[role] ?? 1;
  const duration = Number.isFinite(baseDuration * factor)
    ? Math.max(0, baseDuration * factor)
    : 0;
  const easings = {
    entry: easing,
    cruise: continuationEasing,
    exit: exitEasing,
    single: singleLineEasing
  };
  return {
    duration,
    easing: easings[role] ?? continuationEasing,
    role
  };
}

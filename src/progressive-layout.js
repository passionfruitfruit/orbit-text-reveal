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

export function computeCubicBezierEndpointSlope({ x2, y2 }) {
  const horizontal = 1 - x2;
  if (!Number.isFinite(horizontal) || horizontal === 0) return Number.POSITIVE_INFINITY;
  const vertical = 1 - y2;
  return Number.isFinite(vertical) ? vertical / horizontal : Number.NaN;
}

export function computeTraversalTiming({
  distance,
  baselineDistance,
  baselineDuration,
  first,
  easing,
  continuationEasing
}) {
  const duration = first
    ? baselineDuration
    : baselineDistance > 0
      ? baselineDuration * distance / baselineDistance
      : 0;
  return {
    duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
    easing: first ? easing : continuationEasing
  };
}

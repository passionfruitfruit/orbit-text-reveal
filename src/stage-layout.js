import { computeGeometry } from './geometry.js?v=20260711-4';
import { buildLineModel } from './text-layout.js?v=20260711-4';

function geometryFitsBounds(geometry, availableWidth, availableHeight, safeMarginX, safeMarginY) {
  const minX = safeMarginX;
  const maxX = availableWidth - safeMarginX;
  const minY = safeMarginY;
  const maxY = availableHeight - safeMarginY;
  const tolerance = 1e-7;

  return geometry.lines.every((line) => {
    const textFits = line.x >= minX - tolerance
      && line.x + line.width <= maxX + tolerance;
    const ballFits = [line.start, line.end].every((point) => (
      point.x - geometry.ballSize / 2 >= minX - tolerance
      && point.x + geometry.ballSize / 2 <= maxX + tolerance
    ));
    const textFitsVertically = line.y >= minY - tolerance
      && line.y + geometry.lineHeightPx <= maxY + tolerance;
    const ballFitsVertically = [line.start, line.end].every((point) => (
      point.y - geometry.ballSize / 2 >= minY - tolerance
      && point.y + geometry.ballSize / 2 <= maxY + tolerance
    ));
    return textFits && ballFits && textFitsVertically && ballFitsVertically;
  });
}

function geometryFitsHorizontally(geometry, availableWidth, safeMargin) {
  const minX = safeMargin;
  const maxX = availableWidth - safeMargin;
  const tolerance = 1e-7;
  return geometry.lines.every((line) => (
    line.x >= minX - tolerance
      && line.x + line.width <= maxX + tolerance
      && [line.start, line.end].every((point) => (
        point.x - geometry.ballSize / 2 >= minX - tolerance
          && point.x + geometry.ballSize / 2 <= maxX + tolerance
      ))
  ));
}

export function fitTextLayoutToStage({
  text,
  layout,
  availableWidth,
  availableHeight,
  centerX,
  centerY,
  safeMargin = 16,
  measure,
  maximumAutoFitScale = 1
}) {
  const minimumVisibleSpan = Math.min(1, availableWidth);
  const marginLimit = Math.max(
    0,
    Math.min(centerX, availableWidth - centerX) - minimumVisibleSpan / 2
  );
  const resolvedSafeMargin = availableWidth - 2 * safeMargin <= 0
    ? 0
    : Math.min(safeMargin, marginLimit);
  const minimumVisibleHeight = Math.min(1, availableHeight);
  const verticalMarginLimit = Math.max(
    0,
    Math.min(centerY, availableHeight - centerY) - minimumVisibleHeight / 2
  );
  const resolvedVerticalSafeMargin = availableHeight - 2 * safeMargin <= 0
    ? 0
    : Math.min(safeMargin, verticalMarginLimit);

  const attemptFit = (autoFitScale) => {
    const resolvedScale = layout.scale * autoFitScale;
    const fontSize = layout.fontSize * resolvedScale;
    const lineHeightPx = fontSize * layout.lineHeight;
    const ballSize = fontSize * layout.ballSizeEm;
    const ballGap = fontSize * layout.ballGapEm;
    const configuredWidth = layout.maxWidth * resolvedScale;
    const minimumWidth = Math.min(1, configuredWidth);
    const scaledMeasure = (value) => measure(value) * autoFitScale;
    let wrapWidth = Math.max(
      minimumWidth,
      Math.min(configuredWidth, availableWidth - 2 * resolvedSafeMargin)
    );

    while (true) {
      const lines = buildLineModel(text, wrapWidth, scaledMeasure, { autoWrap: layout.autoWrap !== false });
      const geometry = computeGeometry({
        lines,
        centerX,
        centerY,
        lineHeightPx,
        ballSize,
        ballGap
      });
      const fitted = {
        lines,
        geometry,
        wrapWidth,
        fontSize,
        lineHeightPx,
        ballSize,
        ballGap,
        autoFitScale,
        resolvedScale,
        resolvedSafeMargin,
        resolvedVerticalSafeMargin,
        fits: geometryFitsBounds(
          geometry,
          availableWidth,
          availableHeight,
          resolvedSafeMargin,
          resolvedVerticalSafeMargin
        )
      };

      if (
        fitted.fits
        || wrapWidth === minimumWidth
        || geometryFitsHorizontally(geometry, availableWidth, resolvedSafeMargin)
      ) return fitted;
      wrapWidth = Math.max(minimumWidth, wrapWidth * 0.9);
    }
  };

  const requestedScale = Math.min(1, Math.max(Number.EPSILON, maximumAutoFitScale));
  let fitted = attemptFit(requestedScale);
  let lastFailedScale = requestedScale;

  for (let iteration = 0; !fitted.fits && iteration < 80; iteration += 1) {
    lastFailedScale = fitted.autoFitScale;
    fitted = attemptFit(Math.max(Number.EPSILON, fitted.autoFitScale * 0.95));
  }

  if (fitted.fits && fitted.autoFitScale < requestedScale) {
    let lower = fitted.autoFitScale;
    let upper = lastFailedScale;
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const middle = (lower + upper) / 2;
      const candidate = attemptFit(middle);
      if (candidate.fits) {
        fitted = candidate;
        lower = middle;
      } else {
        upper = middle;
      }
    }
  }

  return fitted;
}

export function fitTextSequenceToStage({ texts, ...options }) {
  const initial = texts.map((text) => fitTextLayoutToStage({ ...options, text }));
  const sharedScale = Math.min(...initial.map((result) => result.autoFitScale));
  return texts.map((text) => fitTextLayoutToStage({
    ...options,
    text,
    maximumAutoFitScale: sharedScale
  }));
}

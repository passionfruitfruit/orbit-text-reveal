const DESKTOP_STAGE_RATIO = 4 / 10;
const MOBILE_STAGE_RATIO = 7 / 9;

export function computeResponsiveStageWidth(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  if (width === 0) return 0;

  const minimum = width * DESKTOP_STAGE_RATIO;
  const maximum = width * MOBILE_STAGE_RATIO;
  const fluid = 0.269230769 * width + 0.232478632 * height;
  return Math.min(maximum, Math.max(minimum, fluid));
}

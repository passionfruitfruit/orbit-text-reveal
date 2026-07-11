const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const lerp = (from, to, progress) => from + (to - from) * progress;

export function computeLineMotionFrame({
  line,
  stageWidth,
  ballSize,
  progress,
  minScale
}) {
  const resolvedProgress = clamp(progress, 0, 1);
  const contentX = lerp(line.contentStartX, line.x, resolvedProgress);
  const ballX = lerp(line.start.x, line.end.x, resolvedProgress);
  const ballLeft = ballX - ballSize / 2;
  const ballRight = ballX + ballSize / 2;
  const clipRight = ballRight;
  let consumed = 0;
  const glyphScales = line.widths.map((width) => {
    const glyphLeft = contentX + consumed;
    const visibleFraction = clamp(
      (ballLeft - glyphLeft) / Math.max(width, Number.EPSILON),
      0,
      1
    );
    consumed += width;
    return minScale + (1 - minScale) * visibleFraction;
  });

  return {
    contentX,
    ball: { x: ballX, y: line.start.y },
    clipLeft: contentX,
    clipRight,
    clipInsetRight: Math.max(0, stageWidth - clipRight),
    glyphScales
  };
}

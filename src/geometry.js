export function computeGeometry({
  lines,
  centerX,
  centerY,
  lineHeightPx,
  ballSize,
  ballGap
}) {
  const longestWidth = Math.max(...lines.map((line) => line.width));
  const blockLeft = centerX - (longestWidth + ballGap + ballSize) / 2;
  const blockTop = centerY - (lines.length * lineHeightPx) / 2;

  const positionedLines = lines.map((line, index) => {
    const y = blockTop + (index + 0.5) * lineHeightPx;
    const lineLeft = centerX - (line.width + ballGap + ballSize) / 2;

    return {
      ...line,
      index,
      x: lineLeft,
      y: blockTop + index * lineHeightPx,
      contentStartX: centerX - (line.widths?.[0] ?? line.width) / 2,
      start: {
        x: centerX,
        y
      },
      end: {
        x: lineLeft + line.width + ballGap + ballSize / 2,
        y
      }
    };
  });

  return {
    center: { x: centerX, y: centerY },
    blockLeft,
    blockTop,
    lineHeightPx,
    ballSize,
    ballGap,
    lines: positionedLines,
    ballEnd: { ...positionedLines.at(-1).end }
  };
}

export function buildRevealRoute(geometry) {
  const route = [
    { kind: 'center', lineIndex: null, ...geometry.center }
  ];

  for (const line of geometry.lines) {
    route.push(
      { kind: 'line-start', lineIndex: line.index, ...line.start },
      { kind: 'line-end', lineIndex: line.index, ...line.end }
    );
  }

  return route;
}

export function buildRetractRoute(route) {
  return route.toReversed().map((point) => ({ ...point }));
}

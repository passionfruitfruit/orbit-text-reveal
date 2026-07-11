export function segmentGraphemes(text, Segmenter = globalThis.Intl?.Segmenter) {
  if (typeof Segmenter !== 'function') return Array.from(text);
  const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

export function measureGlyphRun(text, measure) {
  const graphemes = segmentGraphemes(text);
  const widths = graphemes.map((grapheme) => measure(grapheme));
  return {
    graphemes,
    widths,
    width: widths.reduce((total, width) => total + width, 0)
  };
}

function isWhitespace(grapheme) {
  return /^\s$/u.test(grapheme);
}

function wrapManualLine(text, maxWidth, measure) {
  const lines = [];
  let remaining = segmentGraphemes(text);

  if (remaining.length === 0) {
    return [''];
  }

  while (remaining.length > 0) {
    let fittingCount = 0;

    for (let count = 1; count <= remaining.length; count += 1) {
      if (measureGlyphRun(remaining.slice(0, count).join(''), measure).width > maxWidth) {
        break;
      }
      fittingCount = count;
    }

    if (fittingCount === 0) {
      fittingCount = 1;
    }

    if (fittingCount === remaining.length) {
      lines.push(remaining.join(''));
      break;
    }

    if (isWhitespace(remaining[fittingCount])) {
      lines.push(remaining.slice(0, fittingCount).join(''));
      remaining = remaining.slice(fittingCount + 1);
      continue;
    }

    const fitting = remaining.slice(0, fittingCount);
    let boundaryIndex = -1;
    let boundaryConsumesWhitespace = false;

    for (let index = fitting.length - 1; index >= 0; index -= 1) {
      if (isWhitespace(fitting[index])) {
        boundaryIndex = index;
        boundaryConsumesWhitespace = true;
        break;
      }
      if (fitting[index] === '-') {
        boundaryIndex = index + 1;
        break;
      }
    }

    if (boundaryIndex > 0) {
      lines.push(fitting.slice(0, boundaryIndex).join(''));
      remaining = remaining.slice(boundaryIndex + (boundaryConsumesWhitespace ? 1 : 0));
    } else {
      lines.push(fitting.join(''));
      remaining = remaining.slice(fittingCount);
    }
  }

  return lines;
}

export function wrapText(text, maxWidth, measure, { autoWrap = true } = {}) {
  const manualLines = text.split('\n');
  return autoWrap
    ? manualLines.flatMap((manualLine) => wrapManualLine(manualLine, maxWidth, measure))
    : manualLines;
}

export function buildLineModel(text, maxWidth, measure, options) {
  return wrapText(text, maxWidth, measure, options).map((line) => ({
    text: line,
    ...measureGlyphRun(line, measure)
  }));
}

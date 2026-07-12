# Global Multiline Timeline Design

## Goal

Make each reveal and retract pass behave as one continuous horizontal timeline. Acceleration occurs only at the start of the complete pass, deceleration occurs only at its end, and intermediate row boundaries never restart easing or reduce cruise speed.

## Approved Motion Contract

- Keep cross-line movement instantaneous. A line jump consumes no animation time.
- Concatenate every row's horizontal travel into one virtual path whose length is the sum of the row distances.
- `motion.revealMs` and `motion.retractMs` are the total durations of their complete multiline passes.
- Apply one whole-pass easing curve to cumulative path progress.
- Reveal travels from the first row start through every row to the final row end.
- Retract traverses the exact reverse route, from the final row end through every row to the first row start.
- A single row uses the same whole-pass behavior naturally.
- Preserve exact center recentering, holds, text sequencing, clipping, glyph scaling, wrapping, pause/resume, resize queuing, reduced motion, lifecycle methods, per-text layout overrides, and the separate production/developer pages.

## Architecture

### Pure timeline model

Add a pure cumulative-path helper in `src/progressive-layout.js`. Given row distances, it produces stable segments containing cumulative start/end distance fractions. Zero-distance rows remain finite and occupy no path fraction. A second pure helper maps a whole-pass distance progress to the active segment and its local row progress.

The component runs one invisible WAAPI clock for the complete pass. The clock uses the configured whole-pass easing and total direction duration, so `getComputedTiming().progress` is the eased cumulative distance progress. A `requestAnimationFrame` loop maps that progress into the active row and applies the existing row frame, mask, text, ball, and glyph calculations. This is exact for every browser-supported CSS easing and preserves the existing animation registry used by pause, resume, abort, and destroy.

### Component orchestration

`src/orbit-text-reveal.js` continues to expose the existing `reveal-line`, `line-jump`, and `retract-line` state sequence. Before either pass it builds one timeline from all row distances, then runs one invisible clock animation.

For reveal, clock progress maps into segments top to bottom. For retract, the same geometric segments are mapped bottom to top with reversed local progress. When a frame crosses a segment boundary, the component commits the completed row, emits the instantaneous line-jump state, updates line visibility/centering and ball placement, then emits the next line state. One clock duration is exactly the configured direction duration.

### Configuration

Use `motion.singleLineEasing` as the canonical whole-pass easing because it already represents a complete accelerate/decelerate curve. Preserve `motion.easing`, `motion.continuationEasing`, and `motion.exitEasing` as normalized compatibility fields so existing saved configurations continue to load, but mark them as legacy row-timing controls in documentation and the developer page.

The default whole-pass curve remains `cubic-bezier(0.333333, 0, 0.666667, 1)`.

## Data Flow

1. Measure and fit every rendered row.
2. Collect its horizontal ball travel distance.
3. Build cumulative segments from the distance sum and direction duration.
4. Run one invisible WAAPI clock using the global whole-pass curve.
5. Map every eased clock frame into a segment and local progress, then apply the existing ball, mask, text, and glyph frame calculations.
6. Jump instantly to the next row and continue at the next global progress boundary.
7. Hold, reverse the same path, recenter exactly, then advance the text queue.

## Edge Cases

- Empty and zero-size layouts retain their current guarded behavior.
- A zero-duration direction completes immediately without `NaN` or infinite timing.
- A zero-distance row receives zero duration and cannot slow other rows.
- A single row spans global progress `0..1`.
- Pause, resume, abort, restart, resize, and queued config changes continue to operate through the existing active-animation registry.
- Reduced-motion mode remains static and starts no travel animation.

## Testing

- Pure tests verify cumulative segment boundaries, total duration conservation, unequal row distance allocation, zero-distance safety, reverse order, and single-row behavior.
- Source invariants verify the component builds one pass timeline and no longer assigns per-row traversal roles.
- Browser tests record every row's duration and easing data for unequal multiline rows, verify the complete duration sum, verify continuous global boundary speed, and verify only the complete pass starts and ends at zero speed.
- Existing route, clipping, glyph, lifecycle, resize, pause/resume, reduced-motion, production-page, and developer-page regressions remain green.
- Final verification requires Node tests, syntax checks, fresh browser regression with zero console errors/warnings, visual inspection, clean Git state, and matching local/remote `main` SHA.

## Out of Scope

- Animated vertical or diagonal movement between rows.
- Per-row custom timing in the new global model.
- Scroll-linked placement or scaling of the outer component.
- Unrelated visual redesign or dependency changes.

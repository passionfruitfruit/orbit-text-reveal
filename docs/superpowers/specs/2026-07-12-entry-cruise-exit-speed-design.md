# Entry–Cruise–Exit Line Speed Design

## Goal

Give every multiline reveal and retract one coherent velocity profile: accelerate only on the first traversed row, cruise across intermediate rows, and decelerate only on the final traversed row. Prevent a short first retract row from making all remaining rows slow.

## Confirmed Root Cause

The current implementation uses the first traversed row as both distance and duration baseline. Retraction starts on the bottom row; when that row is short, it still consumes the full configured `retractMs`. Its low pixel speed is then inherited by every later row through distance-proportional timing.

The current implementation also has no distinct final-row deceleration role. It assigns the entry easing only to the first traversed row and linear easing to every later row.

## Cruise-Speed Reference

For each text item and direction:

```text
referenceDistance = maximum horizontal travel distance across all rows
cruiseSpeed = referenceDistance / configuredDirectionDuration
```

- Reveal uses `item.revealMs ?? timing.revealMs`.
- Retract uses `item.retractMs ?? timing.retractMs`.
- The same maximum line distance is used in either direction because the route is structurally reversible.
- `revealMs` and `retractMs` now mean the time in which the longest row would travel at cruise speed, not a fixed duration forced onto the first traversed row.
- Every row duration derives from its own distance and the shared cruise speed.

## Segment Roles

### Multiline reveal

- Row index `0`: `entry` — accelerate from rest to cruise speed.
- Rows `1..last-1`: `cruise` — constant cruise speed.
- Final row: `exit` — decelerate from cruise speed to rest.

### Multiline retract

Traversal order is reversed:

- Bottom/final row: `entry` — accelerate from rest to cruise speed.
- Intermediate traversed rows: `cruise` — constant cruise speed.
- Top/row `0`: `exit` — decelerate from cruise speed to rest.

### Single-line text

The only row has role `single`: accelerate from rest to cruise speed, then decelerate to rest within the same traversal.

Instantaneous vertical line repositioning remains unchanged and consumes no travel time.

## Default Easing Curves

Use cubic Bézier curves whose x controls approximate linear parameter time:

```js
entryEasing: 'cubic-bezier(0.333333, 0, 0.666667, 0.5)'
continuationEasing: 'linear'
exitEasing: 'cubic-bezier(0.333333, 0.5, 0.666667, 1)'
singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)'
```

Public backward compatibility keeps the existing `motion.easing` name for `entryEasing`:

```js
motion: {
  easing: 'cubic-bezier(0.333333, 0, 0.666667, 0.5)',
  continuationEasing: 'linear',
  exitEasing: 'cubic-bezier(0.333333, 0.5, 0.666667, 1)',
  singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)'
}
```

The entry endpoint slope, exit start slope, and single-line midpoint peak slope are each `1.5` in normalized progress. Their absolute boundary/peak speed matches cruise speed by multiplying the same-distance linear duration by `1.5`.

## Timing Calculation

Let:

```text
linearDuration = configuredDirectionDuration × rowDistance / referenceDistance
```

Then:

- `entry`: duration `linearDuration × entryEndpointSlope` (`1.5` by default).
- `cruise`: duration `linearDuration`.
- `exit`: duration `linearDuration × exitStartSlope` (`1.5` by default).
- `single`: duration `linearDuration × singlePeakSlope` (`1.5` by default).

This guarantees:

- entry ends at cruise speed;
- cruise rows start and end at cruise speed;
- exit starts at cruise speed and ends at zero;
- a single row reaches cruise speed at its midpoint;
- short rows take proportionally less time and cannot lower the shared cruise speed.

Zero reference distance or zero configured duration produces immediate zero-duration traversal without `NaN` or infinity.

## Component and Configuration Changes

- Replace boolean `first` traversal timing selection with explicit roles: `entry`, `cruise`, `exit`, `single`.
- Use the maximum line travel distance as reference for reveal and retract.
- Add normalized configuration fields `motion.exitEasing` and `motion.singleLineEasing`.
- Keep `motion.easing` and `motion.continuationEasing` compatible.
- Add developer-page inputs for final-row and single-line easing.
- Document the new timing semantics and customization boundary.

## Verification

- Pure tests cover reference-speed calculation and all four segment roles.
- Tests cover a short bottom row followed by longer retract rows and prove equal cruise pixel speed.
- Tests validate entry endpoint slope `1.5`, exit start slope `1.5`, and single midpoint slope `1.5`.
- Browser tests read WAAPI easing and duration for every reveal and retract row.
- Browser tests prove reveal role order `entry → cruise → exit` and retract role order `entry → cruise → exit` in reversed row order.
- Single-line browser test proves use of `singleLineEasing`.
- Run full Node, syntax, real-browser, console, and visual checks before publication.

## Preserved Behavior

- Ball/text synchronization and occlusion.
- Progressive multiline vertical centering.
- Per-line independent horizontal centering.
- Instantaneous vertical line jumps.
- Exact reverse path and final recenter.
- Pause/resume, hidden-page pause, reduced motion, safe config updates, resize reflow.
- Manual/automatic wrapping, per-item layout, external CSS placement and transforms.
- Zero runtime dependencies.

## Non-goals

- No global multiline timeline rewrite.
- No animated vertical travel between rows.
- No change to clipping, glyph scaling, geometry, or public lifecycle methods.

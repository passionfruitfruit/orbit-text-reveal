# Continuous Cross-Line Speed Design

## Goal

Remove the visible speed drop at every line switch. The first traversed row slowly accelerates from rest and reaches cruise speed at its endpoint; every later row keeps that exact endpoint speed. Apply the same rule independently to reveal and retract.

## Confirmed Motion Model

- The first reveal row starts at zero velocity and accelerates monotonically to cruise velocity.
- It must not decelerate before the row ends.
- Every later reveal row uses linear progress at the first row's endpoint velocity.
- Retraction follows the same policy in reverse row order: the first retracted row accelerates from rest to cruise velocity, and all remaining rows preserve that velocity.
- Instantaneous vertical line repositioning remains unchanged.
- A later row's duration is proportional to its horizontal distance, so short and long rows have the same pixel velocity.

## Configuration

Keep the public configuration boundary:

- `motion.easing`: easing for the first traversed row. The new default and production value will use a cubic Bézier curve whose start slope is `0` and end slope is `1`, so its endpoint speed matches linear continuation.
- `motion.continuationEasing`: easing for later rows, default `linear`.
- `timing.revealMs` and `timing.retractMs`: duration of the first traversed reveal/retract row. Later-row durations remain distance-proportional.

Recommended default first-row curve: `cubic-bezier(0.5, 0, 0.8, 0.8)`. Its endpoint slope is `(1 - 0.8) / (1 - 0.8) = 1`, matching the normalized slope of `linear`.

Custom easing remains supported. Documentation will note that a custom first-row curve must end with slope `1` to preserve a seamless transition into linear continuation.

## Implementation Boundary

- Add a small pure helper that calculates a cubic Bézier endpoint slope from its final control point, used by tests and configuration validation evidence.
- Change only the default/production first-row easing curve and related documentation.
- Preserve the existing distance-proportional continuation timing, Web Component API, editor field, pause/resume, reverse motion, wrapping, and layout behavior.

## Verification

- Unit test the chosen first-row curve: start slope `0`, endpoint slope `1`.
- Unit test later-row linear slope `1` and distance-proportional durations.
- Browser test WAAPI timing for reveal and retract: first traversal uses the new acceleration curve, subsequent traversal uses `linear`, and later duration preserves pixel speed.
- Run all Node, syntax, and real-browser regression tests.
- Visually inspect a multiline reveal and retract transition.

## Non-goals

- No global multi-line timeline rewrite.
- No animated vertical travel between rows.
- No change to line positioning, clipping, text scaling, or public lifecycle methods.

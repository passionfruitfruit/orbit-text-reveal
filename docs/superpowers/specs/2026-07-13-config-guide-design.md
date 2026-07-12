# Config Guide Design

## Goal

Create a concise standalone Chinese tutorial that explains every configurable point represented in `config.js`, with enough practical examples for a developer to customize the animation without reading component internals.

## Deliverables

- Add `CONFIG_GUIDE.md` at the repository root.
- Add a prominent link to the guide near the README configuration introduction.
- Do not change runtime behavior or configuration defaults.

## Audience and Style

The primary reader can edit JavaScript objects but should not need prior knowledge of Web Components or WAAPI. Lead with copyable examples, explain one configuration group at a time, and use plain Chinese. Keep reference tables precise while adding short practical guidance below each table.

## Tutorial Structure

1. Explain where `config.js` is loaded and how `normalizeConfig()` supplies defaults and clamps unsafe values.
2. Provide a minimal working configuration that readers can copy.
3. Explain `texts` and every per-text field: `text`, `holdMs`, `revealMs`, `retractMs`, and supported `layout` overrides.
4. Explain global `timing`: complete reveal/retract duration, compatibility-only `lineTravelMs`, and center hold.
5. Explain `layout`: wrapping, font geometry, ball geometry, internal center, scale, accepted units, and normalization ranges.
6. Explain `style`: colors, font stack, font weight, and their CSS override relationship.
7. Explain `motion`: the canonical global timeline easing, character scale behavior, and the legacy compatibility fields that no longer drive runtime motion.
8. Explain `accessibility.reducedMotionRotate` and its effect under reduced-motion preference.
9. Show complete recipes for single-line, manual multiline, automatic wrapping, per-text overrides, and slower/faster global timelines.
10. Add a troubleshooting section covering ignored legacy fields, invalid/empty text entries, clamped values, CSS overrides, and when to call `restart()`.

## Accuracy Contract

- All defaults and numeric ranges come from `src/config.js`.
- Runtime semantics come from the current global multiline timeline implementation.
- `motion.singleLineEasing` is documented as the active whole-pass easing despite its compatibility-preserved name.
- `motion.easing`, `motion.continuationEasing`, `motion.exitEasing`, `motion.lineEasing`, and `timing.lineTravelMs` are clearly marked compatibility-only.
- Per-text layout overrides list only the keys accepted by `normalizeLayoutOverride()`.
- CSS custom properties are mentioned as a separate override layer, not as `config.js` fields.

## Verification

- Add a Node source test that requires the guide, README link, every configuration group, every active field, all compatibility-only fields, and the normalization limits.
- Run the full Node test suite and `git diff --check`.
- Confirm that no runtime file or default value changes.

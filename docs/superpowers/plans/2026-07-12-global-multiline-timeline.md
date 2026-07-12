# Global Multiline Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-row easing with one exact whole-pass timeline so multiline reveal and retract accelerate once, cruise through instantaneous row jumps, and decelerate once.

**Architecture:** Build pure cumulative-distance segments in `progressive-layout.js`. Run one invisible WAAPI clock for each complete pass in the component, map its eased progress to an active segment/local row progress on every animation frame, and keep existing line rendering and lifecycle infrastructure.

**Tech Stack:** Native ES modules, Web Components, Web Animations API, `requestAnimationFrame`, `node:test`, in-browser regression runner; zero runtime dependencies.

## Global Constraints

- Cross-line jumps remain instantaneous and consume no timeline duration.
- `motion.revealMs` and `motion.retractMs` are exact complete-pass durations.
- Row path weight equals its horizontal pixel distance divided by total horizontal distance.
- The default whole-pass easing is `motion.singleLineEasing = cubic-bezier(0.333333, 0, 0.666667, 1)`.
- Reveal consumes segments top to bottom; retract consumes the exact reverse route.
- Preserve exact center recentering, holds, sequencing, clipping, glyph scaling, wrapping, pause/resume, resize queuing, reduced motion, lifecycle methods, per-text layout overrides, separate production/developer pages, and zero runtime dependencies.

---

### Task 1: Pure Cumulative Path Model

**Files:**
- Modify: `tests/progressive-layout.test.js`
- Modify: `src/progressive-layout.js`

**Interfaces:**
- Produces: `buildPathTimeline(distances: number[]): { totalDistance: number, segments: Array<{ index: number, distance: number, start: number, end: number }> }`.
- Produces: `locatePathProgress(timeline, progress): { index: number, localProgress: number } | null`.
- Removes runtime reliance on `traversalRole`, `computeTraversalTiming`, and `DEFAULT_SPEED_FACTORS` after component migration.

- [ ] **Step 1: Write failing cumulative-path tests**

Add tests for `[100, 50, 150]` expecting total distance `300` and segment bounds `0..1/3`, `1/3..1/2`, `1/2..1`. Assert progress `0.4` maps to row `1` at local progress `0.4`, exact progress `1` maps to the last row at `1`, `[0, 100]` is finite with the first segment `0..0`, all-zero input maps safely, and a single row spans `0..1`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/progressive-layout.test.js`

Expected: FAIL because `buildPathTimeline` and `locatePathProgress` are not exported.

- [ ] **Step 3: Implement the pure model**

Implement finite nonnegative distance normalization, cumulative fractions, clamped progress lookup, exact last-segment handling at progress `1`, and `null` for an empty/all-zero path. Do not parse easing strings; the browser clock owns easing.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/progressive-layout.test.js`

Expected: every progressive-layout test passes.

- [ ] **Step 5: Commit**

```bash
git add src/progressive-layout.js tests/progressive-layout.test.js
git commit -m "feat: model cumulative multiline path"
```

---

### Task 2: One Clock Per Complete Pass

**Files:**
- Modify: `tests/orbit-component-source.test.js`
- Modify: `tests/final-browser-invariants.test.js`
- Modify: `src/orbit-text-reveal.js`

**Interfaces:**
- Consumes: `buildPathTimeline()` and `locatePathProgress()`.
- Produces: private `#animatePass({ direction, duration, easing, signal })` which owns one tracked WAAPI animation and one RAF loop.
- Produces: private `#applyPassProgress(timeline, direction, progress, previousIndex)` which commits crossed rows, emits line states/jumps, positions visible rows, and applies the active row frame.

- [ ] **Step 1: Write failing component invariants**

Require imports/calls for both timeline helpers and `#animatePass`. Require one clock animation with `{ duration, easing: this.#config.motion.singleLineEasing, fill: 'forwards' }`. Reject source calls to `traversalRole` and `computeTraversalTiming`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/orbit-component-source.test.js tests/final-browser-invariants.test.js`

Expected: FAIL because the component still creates one WAAPI animation group per row.

- [ ] **Step 3: Add an invisible clock element**

Add `<span class="timeline-clock" aria-hidden="true"></span>` to shadow DOM and visually isolate it with absolute positioning, zero size, and hidden overflow. Animate its opacity from `0` to `0`; only computed timing progress is consumed.

- [ ] **Step 4: Replace per-row loops with pass calls**

In `#runItem`, preserve center hold and initial placement, then call:

```js
await this.#animatePass({
  direction: 'reveal',
  duration: item.revealMs ?? timing.revealMs,
  easing: this.#config.motion.singleLineEasing,
  signal
});
```

After expanded hold, call the same method with `direction: 'retract'` and the retract duration. Preserve exact recentering afterward.

- [ ] **Step 5: Implement one tracked clock and frame mapper**

Build the timeline once from `this.#lineViews.map(view => this.#lineDistance(view))`. Create one clock animation and track it through `#trackAnimation`. On each RAF, read the clock's eased `getComputedTiming().progress`, reverse it for retract, locate the active segment, commit every crossed boundary in traversal order, emit the existing state sequence, and call `#applyLineFrame` for completed/active rows. For `duration === 0` or a zero-distance path, synchronously apply the pass endpoint. In `finally`, cancel RAF, untrack and cancel the clock.

- [ ] **Step 6: Verify Node GREEN**

Run: `npm test`

Expected: all Node/source tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/orbit-text-reveal.js tests/orbit-component-source.test.js tests/final-browser-invariants.test.js
git commit -m "fix: drive multiline motion with one timeline"
```

---

### Task 3: Configuration Surface and Documentation

**Files:**
- Modify: `tests/dev-page.test.js`
- Modify: `tests/production-config.test.js`
- Modify: `dev.html`
- Modify: `config.js`
- Modify: `README.md`

**Interfaces:**
- Canonical runtime field: `motion.singleLineEasing` (kept under its existing public name for saved-config compatibility).
- Compatibility-only fields: `motion.easing`, `motion.continuationEasing`, `motion.exitEasing`, and `timing.lineTravelMs` remain normalized/exported but no longer drive motion.

- [ ] **Step 1: Write failing developer/documentation tests**

Assert the developer page labels `motion.singleLineEasing` as `整段时间轴缓动`, labels the other easing fields as compatibility-only or removes their editable controls, and describes reveal/retract values as complete-pass durations. Assert README states that line jumps consume zero time and the four legacy fields do not affect the global timeline.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/dev-page.test.js tests/production-config.test.js`

Expected: FAIL against the current per-row labels and timing descriptions.

- [ ] **Step 3: Update developer controls and production comments**

Expose one editable `整段时间轴缓动` control bound to `motion.singleLineEasing`. Replace the three old row easing controls with a short compatibility note rather than duplicate inactive inputs. Update timing labels to `整段展开 (ms)` and `整段收回 (ms)`.

- [ ] **Step 4: Update README semantics**

Document total-duration behavior, cumulative pixel weighting, instantaneous jumps, exact reverse traversal, the canonical easing field, and compatibility-only fields. Remove the previous longest-row cruise reference and per-row entry/cruise/exit explanation.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/dev-page.test.js tests/production-config.test.js tests/dev-app.test.js tests/config.test.js`

Expected: all selected tests pass and exported legacy configurations remain valid.

- [ ] **Step 6: Commit**

```bash
git add dev.html config.js README.md tests/dev-page.test.js tests/production-config.test.js
git commit -m "docs: expose global timeline controls"
```

---

### Task 4: Browser Runtime Regression

**Files:**
- Modify: `tests/browser-tests.js`
- Modify: `tests/browser.html` only for a cache-version bump

**Interfaces:**
- Produces browser evidence that reveal/retract each use one clock, exact total duration, one easing curve, instantaneous jumps, correct progress mapping, lifecycle behavior, and exact recentering.

- [ ] **Step 1: Replace per-row timing assertions with failing global assertions**

For unequal multiline rows, assert exactly one active clock per pass, its duration equals configured `revealMs`/`retractMs`, and easing equals `motion.singleLineEasing`. Sample early/middle/late clock progress and confirm the mapped ball/text position matches cumulative distance. Confirm state order stays `reveal-line → line-jump → ...` and reversed for retract.

- [ ] **Step 2: Add lifecycle regressions**

Assert pause freezes the clock current time and visual frame; play resumes both; restart/disconnect/destroy cancel the clock; queued config and resize still wait for recenter; zero-duration and reduced-motion paths start no stale clock.

- [ ] **Step 3: Run the focused browser regression**

Run a fresh versioned browser runner immediately after adding the assertions. Any failure must identify an exact global-clock, state-sequence, or lifecycle mismatch; fix the implementation rather than weakening the assertion.

- [ ] **Step 4: Complete integration fixes and verify browser GREEN**

Run the fresh browser runner until it reports `ALL TESTS PASSED`. Record the exact PASS count and require zero console `error`/`warning` entries.

- [ ] **Step 5: Visually inspect both directions**

Use unequal three-line text with a short final row. Confirm only the whole reveal begins slowly and ends slowly; retract begins slowly at the bottom and ends slowly at the top; middle row boundaries do not visibly reset speed.

- [ ] **Step 6: Commit**

```bash
git add tests/browser-tests.js tests/browser.html src/orbit-text-reveal.js
git commit -m "test: verify global multiline timeline"
```

---

### Task 5: Final Verification and Publication

**Files:**
- Modify: `docs/superpowers/plans/2026-07-12-global-multiline-timeline.md` (checkbox record)

- [ ] **Step 1: Run all local checks**

```bash
npm test
for file in $(rg --files -g '*.js' -g '!node_modules/**'); do node --check "$file" || exit 1; done
git diff --check
```

Expected: every test passes and all commands exit `0`.

- [ ] **Step 2: Mark completed plan steps and commit**

```bash
git add -f docs/superpowers/plans/2026-07-12-global-multiline-timeline.md
git commit -m "docs: complete global timeline plan"
```

- [ ] **Step 3: Push and verify remote parity**

```bash
git push origin main
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote origin refs/heads/main | cut -f1)
test "$LOCAL_SHA" = "$REMOTE_SHA"
git status --short --branch
```

Expected: local and remote SHA match and the worktree is clean on `main`.

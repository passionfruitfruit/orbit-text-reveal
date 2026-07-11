# Continuous Cross-Line Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every later reveal/retract row continue at the first traversed row's endpoint speed without a visible slowdown.

**Architecture:** Preserve the existing per-row WAAPI orchestration and distance-proportional duration calculation. Replace the first-row ease-in-out default with an acceleration-to-cruise cubic Bézier whose endpoint slope equals linear continuation, and add a pure slope helper so that the velocity contract is tested mathematically rather than inferred visually.

**Tech Stack:** Native ES modules, Web Components, Web Animations API, `node:test`, in-browser regression runner; zero runtime dependencies.

## Global Constraints

- First reveal/retract traversal starts at zero velocity and accelerates monotonically to cruise speed.
- First traversal endpoint normalized slope must equal `1`.
- Later traversals use `motion.continuationEasing: 'linear'` and distance-proportional durations.
- Reveal and retract apply the same rule independently in opposite row order.
- Preserve instantaneous vertical jumps, clipping, character scaling, wrapping, public API, pause/resume, and reduced motion.
- Keep custom `motion.easing` and `motion.continuationEasing` configuration fields.
- Add no runtime dependency.

---

### Task 1: Encode the Endpoint-Speed Contract

**Files:**
- Modify: `tests/progressive-layout.test.js`
- Modify: `src/progressive-layout.js`

**Interfaces:**
- Produces: `computeCubicBezierEndpointSlope({ x2, y2 }): number`.
- Preserves: `computeTraversalTiming({ distance, baselineDistance, baselineDuration, first, easing, continuationEasing })`.

- [x] **Step 1: Write the failing endpoint-slope test**

Add:

```js
import {
  computeCubicBezierEndpointSlope,
  computeTraversalTiming,
  computeVisibleLineLayout
} from '../src/progressive-layout.js';

test('entry easing ends at the same normalized speed as linear continuation', () => {
  assert.equal(computeCubicBezierEndpointSlope({ x2: 0.8, y2: 0.8 }), 1);
  assert.equal(computeCubicBezierEndpointSlope({ x2: 0.35, y2: 1 }), 0);
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/progressive-layout.test.js`

Expected: FAIL because `computeCubicBezierEndpointSlope` is not exported.

- [x] **Step 3: Implement the pure endpoint-slope helper**

Add:

```js
export function computeCubicBezierEndpointSlope({ x2, y2 }) {
  const horizontal = 1 - x2;
  if (!Number.isFinite(horizontal) || horizontal === 0) return Number.POSITIVE_INFINITY;
  const vertical = 1 - y2;
  return Number.isFinite(vertical) ? vertical / horizontal : Number.NaN;
}
```

- [x] **Step 4: Verify GREEN**

Run: `node --test tests/progressive-layout.test.js`

Expected: all progressive-layout tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/progressive-layout.js tests/progressive-layout.test.js
git commit -m "test: encode continuation endpoint speed"
```

---

### Task 2: Accelerate Into Linear Cruise Speed

**Files:**
- Modify: `tests/config.test.js`
- Modify: `src/config.js`
- Modify: `config.js`
- Modify: `tests/browser-tests.js`
- Modify: `README.md`

**Interfaces:**
- Default/production `motion.easing`: `cubic-bezier(0.5, 0, 0.8, 0.8)`.
- Default/production `motion.continuationEasing`: `linear`.

- [x] **Step 1: Write the failing configuration test**

Add to the default-config test:

```js
assert.equal(config.motion.easing, 'cubic-bezier(0.5, 0, 0.8, 0.8)');
assert.equal(config.motion.continuationEasing, 'linear');
```

Add a production-source assertion that `config.js` contains both exact values.

- [x] **Step 2: Run configuration tests and verify RED**

Run: `node --test tests/config.test.js tests/production-config.test.js`

Expected: FAIL because the current first-row curve is `cubic-bezier(0.65, 0, 0.35, 1)`.

- [x] **Step 3: Change the minimal production values**

In both `src/config.js` and `config.js`, set:

```js
easing: 'cubic-bezier(0.5, 0, 0.8, 0.8)',
continuationEasing: 'linear',
```

- [x] **Step 4: Align browser timing evidence**

Use the same first-row curve in the multiline browser fixture. Keep assertions that the first traversal reads `motion.easing`, later traversal reads `motion.continuationEasing`, and later duration is proportional to distance. Add a check that the configured curve's endpoint slope is `1`.

- [x] **Step 5: Document adjustability and the no-drop condition**

Update README configuration notes:

```markdown
`motion.easing` controls the first traversed row. The default curve accelerates from rest and ends with normalized slope 1. To enter a linear continuation without a speed jump, a custom cubic Bézier must also end with slope 1, meaning `x2 === y2` when `x2 < 1`.

`motion.continuationEasing` controls later rows. Keep it `linear` to preserve constant cross-line pixel speed.
```

- [x] **Step 6: Verify selected tests**

Run: `node --test tests/config.test.js tests/production-config.test.js tests/progressive-layout.test.js tests/final-browser-invariants.test.js`

Expected: all selected tests PASS.

- [x] **Step 7: Commit**

```bash
git add src/config.js config.js tests/config.test.js tests/production-config.test.js tests/browser-tests.js README.md
git commit -m "fix: preserve cruise speed across lines"
```

---

### Task 3: Full Runtime Verification and Publication

**Files:**
- Modify: `tests/browser.html` only if a cache-version bump is needed.

**Interfaces:**
- Produces verified local and GitHub state on `main`.

- [x] **Step 1: Run all Node and syntax checks**

Run:

```bash
npm test
for file in $(rg --files -g '*.js' -g '!node_modules/**'); do
  node --check "$file" || exit 1
done
```

Expected: all tests PASS and every syntax check exits `0`.

- [x] **Step 2: Run a fresh browser regression**

Open a fresh `tests/browser.html` query version. Verify `ALL TESTS PASSED`, the PASS count, and zero `error`/`warning` console entries.

- [x] **Step 3: Visually inspect multiline reveal and retract**

At the production/developer preview, confirm the first traversed row accelerates without endpoint deceleration and the second/third rows maintain one constant pixel speed in both directions.

- [x] **Step 4: Commit any cache-version-only change**

```bash
git add tests/browser.html
git commit -m "test: refresh continuous-speed browser verification"
```

Skip this commit when no file changed.

- [x] **Step 5: Push and verify remote parity**

Run:

```bash
git push
test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | cut -f1)"
git status --short
```

Expected: push succeeds, local and remote SHA match, and the working tree is clean.

# Entry–Cruise–Exit Line Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reveal and retract accelerate only on the first traversed row, cruise through intermediate rows, decelerate only on the final traversed row, and prevent short rows from setting a slow global speed.

**Architecture:** Keep row-by-row WAAPI animation and instantaneous vertical jumps. Move role selection and reference-distance timing into pure helpers in `progressive-layout.js`; the component supplies traversal position, maximum row distance, direction duration, and configured easing values. Add explicit exit and single-line easing fields while retaining existing public configuration names.

**Tech Stack:** Native ES modules, Web Components, Web Animations API, `node:test`, in-browser regression runner; zero runtime dependencies.

## Global Constraints

- Cruise speed is `maximum row distance / configured direction duration`.
- Reveal roles are top-to-bottom `entry → cruise… → exit`.
- Retract roles follow bottom-to-top traversal order `entry → cruise… → exit`.
- One row uses role `single` and accelerates then decelerates in that row.
- Default entry endpoint, exit start, and single midpoint normalized slopes are each `1.5`.
- Entry, exit, and single duration factors are `1.5`; cruise factor is `1`.
- Preserve zero-duration behavior, instant vertical jumps, exact reverse path, clipping, glyph scaling, wrapping, pause/resume, resize, reduced motion, public lifecycle methods, and zero runtime dependencies.

---

### Task 1: Pure Role and Shared-Speed Timing

**Files:**
- Modify: `tests/progressive-layout.test.js`
- Modify: `src/progressive-layout.js`

**Interfaces:**
- Produces: `traversalRole({ position, count }): 'entry' | 'cruise' | 'exit' | 'single'`.
- Changes: `computeTraversalTiming({ distance, referenceDistance, referenceDuration, role, easing, continuationEasing, exitEasing, singleLineEasing, speedFactors? }): { duration, easing, role }`.
- Produces: `DEFAULT_SPEED_FACTORS = { entry: 1.5, cruise: 1, exit: 1.5, single: 1.5 }`.

- [ ] **Step 1: Replace the old boolean-first tests with failing role tests**

Add assertions:

```js
assert.equal(traversalRole({ position: 0, count: 3 }), 'entry');
assert.equal(traversalRole({ position: 1, count: 3 }), 'cruise');
assert.equal(traversalRole({ position: 2, count: 3 }), 'exit');
assert.equal(traversalRole({ position: 0, count: 1 }), 'single');
```

For `referenceDistance: 200`, `referenceDuration: 1000`, assert:

```js
entry(distance: 50)  -> duration 375, easing entry, role entry
cruise(distance: 50) -> duration 250, easing linear, role cruise
exit(distance: 50)   -> duration 375, easing exit, role exit
single(distance: 50) -> duration 375, easing single, role single
```

Also assert a 20px first retract row and a later 100px row share cruise speed `0.2px/ms`: entry endpoint absolute speed is `(20 / 150) × 1.5 = 0.2`, later cruise speed is `100 / 500 = 0.2`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/progressive-layout.test.js`

Expected: FAIL because `traversalRole` and the role-based signature do not exist.

- [ ] **Step 3: Implement role selection and timing**

Add:

```js
export const DEFAULT_SPEED_FACTORS = Object.freeze({
  entry: 1.5,
  cruise: 1,
  exit: 1.5,
  single: 1.5
});

export function traversalRole({ position, count }) {
  if (count <= 1) return 'single';
  if (position <= 0) return 'entry';
  if (position >= count - 1) return 'exit';
  return 'cruise';
}

export function computeTraversalTiming({
  distance,
  referenceDistance,
  referenceDuration,
  role,
  easing,
  continuationEasing,
  exitEasing,
  singleLineEasing,
  speedFactors = DEFAULT_SPEED_FACTORS
}) {
  const baseDuration = referenceDistance > 0
    ? referenceDuration * distance / referenceDistance
    : 0;
  const factor = speedFactors[role] ?? 1;
  const duration = Number.isFinite(baseDuration * factor)
    ? Math.max(0, baseDuration * factor)
    : 0;
  const easings = {
    entry: easing,
    cruise: continuationEasing,
    exit: exitEasing,
    single: singleLineEasing
  };
  return { duration, easing: easings[role] ?? continuationEasing, role };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/progressive-layout.test.js`

Expected: all progressive-layout tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progressive-layout.js tests/progressive-layout.test.js
git commit -m "fix: derive row timing from shared cruise speed"
```

---

### Task 2: Configuration and Developer Controls

**Files:**
- Modify: `tests/config.test.js`
- Modify: `tests/production-config.test.js`
- Modify: `tests/dev-page.test.js`
- Modify: `src/config.js`
- Modify: `config.js`
- Modify: `dev.html`
- Modify: `README.md`

**Interfaces:**
- Default `motion.easing`: `cubic-bezier(0.333333, 0, 0.666667, 0.5)`.
- Default `motion.continuationEasing`: `linear`.
- Produces normalized `motion.exitEasing`: `cubic-bezier(0.333333, 0.5, 0.666667, 1)`.
- Produces normalized `motion.singleLineEasing`: `cubic-bezier(0.333333, 0, 0.666667, 1)`.

- [ ] **Step 1: Write failing config and developer-page tests**

Assert normalized defaults and production config contain all four exact easing strings. Assert `dev.html` contains:

```html
<input type="text" data-path="motion.exitEasing">
<input type="text" data-path="motion.singleLineEasing">
```

with labels `末行减速缓动` and `单行加减速缓动`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/config.test.js tests/production-config.test.js tests/dev-page.test.js`

Expected: FAIL because the new fields and controls are absent and entry easing uses the previous value.

- [ ] **Step 3: Add and normalize configuration fields**

In `DEFAULT_CONFIG.motion`, production `config.js`, and `normalizeConfig()` add the exact values from the interface. Preserve arbitrary string overrides using `stringOr`.

- [ ] **Step 4: Add developer controls**

Under the existing motion fields in `dev.html`, add:

```html
<label class="field-wide">
  末行减速缓动
  <input type="text" data-path="motion.exitEasing">
</label>
<label class="field-wide">
  单行加减速缓动
  <input type="text" data-path="motion.singleLineEasing">
</label>
```

- [ ] **Step 5: Document timing semantics**

Document that `revealMs/retractMs` define the longest row's cruise-time reference; entry/exit/single rows use a `1.5` duration factor to match cruise boundary speed. Document all four easing fields and the role order in both directions.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/config.test.js tests/production-config.test.js tests/dev-page.test.js tests/dev-app.test.js`

Expected: all selected tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/config.js config.js dev.html README.md tests/config.test.js tests/production-config.test.js tests/dev-page.test.js
git commit -m "feat: configure entry cruise exit easing"
```

---

### Task 3: Component Traversal Roles

**Files:**
- Modify: `tests/orbit-component-source.test.js`
- Modify: `tests/final-browser-invariants.test.js`
- Modify: `tests/browser-tests.js`
- Modify: `src/orbit-text-reveal.js`

**Interfaces:**
- Consumes `traversalRole()` and role-based `computeTraversalTiming()`.
- Produces WAAPI easing/duration order `entry, cruise..., exit` for either direction and `single` for one row.

- [ ] **Step 1: Write failing source and browser invariants**

Require component source to calculate maximum reference distance, call `traversalRole`, and pass `exitEasing` plus `singleLineEasing` to timing. Browser runner must record every reveal/retract row timing and assert:

```text
three-row reveal: entry easing, linear, exit easing
three-row retract: entry easing, linear, exit easing
single row: singleLineEasing
```

Use unequal distances with a short bottom row. For every boundary, calculate the absolute speed from `distance / duration × normalized boundary slope` and assert it equals `referenceDistance / directionDuration`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/orbit-component-source.test.js tests/final-browser-invariants.test.js`

Expected: FAIL because the component still passes boolean `first` and uses first-traversed distance as baseline.

- [ ] **Step 3: Import role helper and calculate shared reference distance**

Import `traversalRole`. Add:

```js
#referenceDistance() {
  return Math.max(0, ...this.#lineViews.map((view) => this.#lineDistance(view)));
}
```

Calculate it once for the current item and use it for both reveal and retract timing.

- [ ] **Step 4: Assign reveal roles by traversal position**

For reveal index `index`, compute:

```js
const role = traversalRole({ position: index, count: this.#lineViews.length });
```

Pass role, reference distance, reveal duration, and all four easing values to timing.

- [ ] **Step 5: Assign retract roles by reversed traversal position**

For retract raw row index `index`, compute:

```js
const position = lastIndex - index;
const role = traversalRole({ position, count: this.#lineViews.length });
```

Pass role, the same maximum reference distance, retract duration, and all four easing values.

- [ ] **Step 6: Verify Node GREEN**

Run: `npm test`

Expected: every Node/source test PASS.

- [ ] **Step 7: Commit**

```bash
git add src/orbit-text-reveal.js tests/orbit-component-source.test.js tests/final-browser-invariants.test.js tests/browser-tests.js
git commit -m "fix: accelerate first row and decelerate final row"
```

---

### Task 4: Full Runtime Verification and Publication

**Files:**
- Modify: `tests/browser.html` only if a cache-version bump is required.

**Interfaces:**
- Produces verified local and GitHub `main` state.

- [ ] **Step 1: Run all Node and syntax checks**

Run:

```bash
npm test
for file in $(rg --files -g '*.js' -g '!node_modules/**'); do
  node --check "$file" || exit 1
done
git diff --check
```

Expected: all tests PASS and all checks exit `0`.

- [ ] **Step 2: Run fresh browser regression**

Open a fresh versioned `tests/browser.html`. Verify `ALL TESTS PASSED`, record the PASS count, and confirm zero console `error`/`warning` entries.

- [ ] **Step 3: Visually inspect both directions**

Use a multiline item with a short bottom row. Confirm reveal accelerates only on top row and decelerates only on bottom row; retract accelerates only on bottom row, cruises at normal speed on intermediate rows, and decelerates only on top row.

- [ ] **Step 4: Record completed plan and commit cache-only changes**

Mark every completed checkbox. If `tests/browser.html` changed, commit it with the plan record:

```bash
git add docs/superpowers/plans/2026-07-12-entry-cruise-exit-speed.md tests/browser.html
git commit -m "test: verify entry cruise exit line speed"
```

Otherwise commit only the tracked plan record.

- [ ] **Step 5: Push and verify remote parity**

Run:

```bash
git push
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote origin refs/heads/main | cut -f1)
test "$LOCAL_SHA" = "$REMOTE_SHA"
git status --short
```

Expected: push succeeds, SHAs match, and the working tree is clean.

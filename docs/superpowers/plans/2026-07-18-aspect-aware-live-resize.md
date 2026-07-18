# Aspect-Aware Live Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the formal Orbit hero respond continuously to viewport aspect ratio and keep text/ball size visually continuous while the window is being dragged.

**Architecture:** CSS owns the aspect-aware target stage width and font size through continuous `vw + vh` formulas. The Web Component keeps its existing safe-boundary geometry rebuild, but applies a temporary center-preserving transform to `.visual` on every observed resize so the old geometry follows the latest center and font scale until the exact geometry can be rebuilt at recenter.

**Tech Stack:** Static CSS, ES modules, Web Components, ResizeObserver, Node `node:test`, existing browser test harness.

## Global Constraints

- Preserve the six production texts, `#f7f2ef` background, and black text/ball exactly.
- Preserve the global reveal/retract timeline, reverse path, pause/resume, reduced-motion behavior, and exact recentering.
- At `1920x1080`, the visible stage is `40vw` and the resolved font is `64px`.
- At `320x700`, the visible stage is `77.7777778vw` and the resolved font is `19px`.
- Intermediate viewport widths, heights, and aspect ratios use continuous formulas with no media-query or JavaScript breakpoints.
- Resize notifications must not restart the active animation, change its index, or accumulate transforms.
- Formal geometry still rebuilds only after the current item retracts and recenters.
- Use tests first and verify the expected RED failure before production edits.

---

### Task 1: Aspect-Aware CSS Targets

**Files:**
- Modify: `tests/production-page.test.js`
- Modify: `src/base.css`

**Interfaces:**
- Consumes: viewport units `vw` and `vh`.
- Produces: `--orbit-stage-width` and `--orbit-font-size` resolved continuously from viewport width and height.

- [ ] **Step 1: Write failing CSS contract assertions**

Replace the old width-only assertions in `tests/production-page.test.js` with exact checks for:

```js
assert.match(
  css,
  /--orbit-stage-width:\s*clamp\(\s*40vw,\s*calc\(26\.9230769vw \+ 23\.2478632vh\),\s*77\.7777778vw\s*\)/s
);
assert.match(
  css,
  /--orbit-font-size:\s*clamp\(19px,\s*calc\(2\.431891vw \+ 1\.6025641vh\),\s*64px\)/s
);
assert.doesNotMatch(css, /32\.4444444vw \+ 145\.0666667px/);
assert.doesNotMatch(css, /2\.8125vw \+ 10px/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/production-page.test.js`

Expected: FAIL because `src/base.css` still contains the width-only formulas.

- [ ] **Step 3: Apply the minimal CSS formulas**

Update only the two variables in `src/base.css`:

```css
--orbit-stage-width: clamp(
  40vw,
  calc(26.9230769vw + 23.2478632vh),
  77.7777778vw
);
--orbit-font-size: clamp(19px, calc(2.431891vw + 1.6025641vh), 64px);
```

Keep the existing centering, `svh`/`dvh` fallback, page background, overflow, and transforms unchanged.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/production-page.test.js`

Expected: all production-page tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/base.css tests/production-page.test.js
git commit -m "fix: make hero sizing aspect aware"
```

---

### Task 2: Live Resize Browser Regression

**Files:**
- Modify: `tests/browser-tests.js`
- Modify: `tests/final-browser-invariants.test.js`

**Interfaces:**
- Consumes: the existing public `debugSnapshot()`, ResizeObserver behavior, and browser test helpers.
- Produces: a failing browser regression that names and measures the approved live resize behavior.

- [ ] **Step 1: Add a failing mid-animation resize test**

Extend `runResizeObserverChecks()` with a dedicated probe whose host has `--orbit-font-size: 60px`, then wait until `reveal-line`, change its width and font variable, and assert before the item reaches recenter:

```js
const before = liveProbe.debugSnapshot();
const beforeIndex = before.index;
const centerHoldCountBefore = liveStates.filter((state) => state === 'center-hold').length;
liveProbe.style.width = '420px';
liveProbe.style.setProperty('--orbit-font-size', '42px');
await nextFrame();
await nextFrame();

const during = liveProbe.debugSnapshot();
check(during.index === beforeIndex, 'live resize preserves the active index');
check(during.state !== 'center-hold', 'live resize does not return the active animation to its initial hold');
check(during.liveResizeTransform.scale < 1, 'live resize follows the smaller resolved font continuously');
assertClose(
  before.center.x + during.liveResizeTransform.x,
  liveProbe.clientWidth / 2,
  1,
  'live resize maps the old geometry center to the latest stage center'
);
check(
  liveStates.filter((state) => state === 'center-hold').length === centerHoldCountBefore,
  'live resize does not restart the active loop'
);
```

After the normal retract/recenter boundary, assert:

```js
await waitFor(
  () => liveProbe.debugSnapshot().liveResizeTransform.scale === 1,
  'safe resize reflow did not clear the temporary transform'
);
check(liveProbe.debugSnapshot().center.x === liveProbe.clientWidth / 2, 'safe resize reflow commits the latest center');
```

Add these five evidence strings to `tests/final-browser-invariants.test.js`:

```js
'live resize preserves the active index',
'live resize does not return the active animation to its initial hold',
'live resize follows the smaller resolved font continuously',
'live resize maps the old geometry center to the latest stage center',
'live resize does not restart the active loop'
```

- [ ] **Step 2: Verify RED**

Run the browser test page before changing production code.

Expected: FAIL at the new live-resize checks because `debugSnapshot()` does not expose `liveResizeTransform` and resize does not currently apply a temporary visual transform. Record the exact failing assertion.

Also run: `npm test`

Expected: Node contract tests pass after the evidence strings are added; the authoritative RED evidence is the real browser failure.

- [ ] **Step 3: Commit the failing regression**

```bash
git add tests/browser-tests.js tests/final-browser-invariants.test.js
git commit -m "test: reproduce live resize jumps"
```

---

### Task 3: Continuous Visual Resize Bridge

**Files:**
- Modify: `src/orbit-text-reveal.js`

**Interfaces:**
- Consumes: the failing browser regression from Task 2, latest ResizeObserver `{ width, height }`, current geometry center, current resolved font size, current item layout, and computed `--orbit-font-size`.
- Produces: a temporary `{ x, y, scale }` transform exposed through `debugSnapshot().liveResizeTransform` and applied to the shadow `.visual` element until the next safe render.

- [ ] **Step 1: Track the rendered size and live transform**

In `src/orbit-text-reveal.js`, add private fields initialized to neutral values:

```js
#renderedSize = null;
#liveResizeTransform = { x: 0, y: 0, scale: 1 };
```

Expose a clone in `debugSnapshot()`:

```js
liveResizeTransform: this.#liveResizeTransform,
```

At the start of every `#render()`, clear the prior transform. After reading the current usable width and height, store:

```js
this.#renderedSize = { width, height };
```

Reset both fields when disconnected or destroyed.

- [ ] **Step 2: Add focused live-transform helpers**

Add `#clearLiveResizeTransform()`:

```js
#clearLiveResizeTransform() {
  const visual = this.shadowRoot.querySelector('.visual');
  visual.style.transform = '';
  visual.style.transformOrigin = '';
  this.#liveResizeTransform = { x: 0, y: 0, scale: 1 };
}
```

Add `#readExternalFontSize(layout)` using the same CSS-variable resolution as `#render()`; return `null` when `--orbit-font-size` is absent so ordinary embedded components retain scale `1`.

Add `#applyLiveResizeTransform(size)`:

```js
#applyLiveResizeTransform(size) {
  if (!this.#geometry || !this.#renderedSize || this.#resolvedFontSize <= 0) return;
  const item = this.#config.texts[this.#index];
  const layout = { ...this.#config.layout, ...item?.layout };
  const externalFontSize = this.#readExternalFontSize(layout);
  const targetFontSize = externalFontSize == null
    ? this.#resolvedFontSize
    : externalFontSize * layout.scale * this.#autoFitScale;
  const scale = Math.max(Number.EPSILON, targetFontSize / this.#resolvedFontSize);
  const targetCenter = {
    x: positionFrom(layout.x, size.width),
    y: positionFrom(layout.y, size.height)
  };
  const transform = {
    x: targetCenter.x - this.#geometry.center.x,
    y: targetCenter.y - this.#geometry.center.y,
    scale
  };
  const visual = this.shadowRoot.querySelector('.visual');
  visual.style.transformOrigin = `${this.#geometry.center.x}px ${this.#geometry.center.y}px`;
  visual.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`;
  this.#liveResizeTransform = transform;
}
```

Do not mutate the geometry, animation objects, current index, or timeline progress in this helper.

- [ ] **Step 3: Bridge observed resizes without restarting**

In `#handleObservedResize(entry)`, when a real size change is detected and active geometry exists:

```js
this.#applyLiveResizeTransform(size);
this.#pendingReflow = true;
```

Retain `restart()` only for the existing no-active-loop path. Multiple notifications overwrite the same `.visual` transform from the committed geometry; never multiply or append transforms.

In `#render()`, call `#clearLiveResizeTransform()` before rebuilding geometry so the safe-boundary render commits the final center and size from a neutral transform.

- [ ] **Step 4: Verify GREEN**

Run: `npm test`

Expected: the full Node suite passes.

Run the same browser test page used for Task 2 RED.

Expected: the previously recorded live-resize assertion now passes, all other browser assertions pass, and the console has no warnings/errors.

- [ ] **Step 5: Commit**

```bash
git add src/orbit-text-reveal.js
git commit -m "fix: bridge live resize between safe reflows"
```

---

### Task 4: Formal Page Continuity Verification

**Files:**
- Modify only if a verified failure requires a narrow correction to Task 1 or Task 2 files.

**Interfaces:**
- Consumes: committed aspect-aware CSS and live resize bridge.
- Produces: fresh evidence for continuous sizing, centering, animation preservation, and clean browser logs.

- [ ] **Step 1: Run automated verification**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 2: Verify aspect-aware targets**

Use the existing browser test harness at `320x700`, `390x844`, `960x1080`, `1280x800`, and `1920x1080`. Confirm host width and font size match:

```js
const expectedWidth = Math.max(
  innerWidth * 0.4,
  Math.min(innerWidth * 7 / 9, innerWidth * 0.269230769 + innerHeight * 0.232478632)
);
const expectedFont = Math.max(
  19,
  Math.min(64, innerWidth * 0.02431891 + innerHeight * 0.016025641)
);
```

Center error and horizontal overflow must remain within the existing limits.

- [ ] **Step 3: Verify continuous dragging behavior**

Inspect the formal page while resizing through a sequence of at least 20 nearby widths and heights. Confirm the text and ball scale together, remain centered, do not restart, and do not visibly jump when the safe geometry reflow commits.

- [ ] **Step 4: Check logs and diff**

Confirm browser warnings/errors are empty, then run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and no uncommitted task changes.

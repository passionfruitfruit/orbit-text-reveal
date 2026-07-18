# Personal Homepage Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Orbit production page into a centered personal-homepage hero with the approved six texts and continuously responsive width and type.

**Architecture:** Keep the existing Web Component and animation modules unchanged. Put content and colors in `config.js`, put viewport placement and fluid sizing in `src/base.css`, and extend the existing production contract tests plus browser assertions. The developer page remains separate.

**Tech Stack:** Static HTML, CSS custom properties, ES modules, Node `node:test`, existing browser test harness.

## Global Constraints

- The production first viewport contains only `<orbit-text-reveal>`; no navigation, buttons, scroll hints, second section, gradients, or decorative graphics.
- Background is exactly `#f7f2ef`; text and ball are exactly `#000000`.
- Text order and characters must exactly match the six entries in the approved spec.
- Only `粉骨碎身浑不怕\n要留清白在人间` has a manual newline.
- Stage width is `max(40vw, min(77.7777778vw, calc(32.4444444vw + 145.0666667px)))`.
- Font size is `clamp(20px, calc(2.75vw + 11.2px), 64px)`.
- The stage is horizontally and vertically centered in the real viewport with no more than 1px error.
- Existing animation path, whole-pass timing, exact recentering, accessibility, and developer-page separation remain unchanged.
- Do not modify files outside those explicitly owned by a task.

---

### Task 1: Lock the personal text queue and colors

**Files:**
- Modify: `tests/production-config.test.js`
- Modify: `config.js`

**Interfaces:**
- Consumes: `normalizeConfig()` from `src/config.js`.
- Produces: `animationConfig` with the exact six entries and approved colors for `main.js`.

- [ ] **Step 1: Write failing production-config assertions**

Replace the sample-content assertions with exact values:

```js
const expectedTexts = [
  'hello:)',
  '欢迎！',
  '粉骨碎身浑不怕\n要留清白在人间',
  '真的英雄：不是打败世界的傲慢，而是勇敢的守住内心的天真',
  '你来这里干嘛\\（≧▽≦）/',
  '（别光看屏幕啦！'
];

assert.deepEqual(animationConfig.texts.map(({ text }) => text), expectedTexts);
assert.deepEqual(
  animationConfig.texts.map(({ text }) => (text.match(/\n/g) ?? []).length),
  [0, 0, 1, 0, 0, 0]
);
assert.equal(animationConfig.style.background, '#f7f2ef');
assert.equal(animationConfig.style.textColor, '#000000');
assert.equal(animationConfig.style.ballColor, '#000000');
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/production-config.test.js`

Expected: FAIL because the current config still contains three demo texts and old colors.

- [ ] **Step 3: Make the minimal config change**

Update only `texts` and the three `style` colors in `config.js`. Keep current timing, layout, motion, and accessibility values unless a later task explicitly requires a layout value.

Use finite `holdMs` values for every item, retaining the existing readable range of roughly 1800-2600ms.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/production-config.test.js`

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add config.js tests/production-config.test.js
git commit -m "feat: add personal homepage text sequence"
```

---

### Task 2: Implement continuous viewport sizing and centering

**Files:**
- Modify: `tests/production-page.test.js`
- Modify: `tests/final-browser-invariants.test.js`
- Modify: `tests/browser-tests.js`
- Modify: `src/base.css`

**Interfaces:**
- Consumes: the single production `<orbit-text-reveal>` element and its existing `ResizeObserver` behavior.
- Produces: CSS variables `--orbit-stage-width` and `--orbit-font-size` whose resolved values follow the approved formulas.

- [ ] **Step 1: Write failing CSS contract assertions**

Read `src/base.css` in `tests/production-page.test.js` and assert it contains these exact declarations:

```js
assert.match(css, /--orbit-stage-width:\s*max\(40vw,\s*min\(77\.7777778vw,\s*calc\(32\.4444444vw \+ 145\.0666667px\)\)\)/s);
assert.match(css, /--orbit-font-size:\s*clamp\(20px,\s*calc\(2\.75vw \+ 11\.2px\),\s*64px\)/s);
assert.match(css, /--orbit-page-background:\s*#f7f2ef/);
assert.match(css, /height:\s*100dvh/);
```

Also assert the old mobile-only `calc(100vw - 2rem)` stage-width override is absent, because it would break the continuous ratio.

- [ ] **Step 2: Add failing browser invariants**

In `tests/browser-tests.js`, add a production-host check for the browser's current real viewport. The final verification task will run this page at `320`, `768`, `1280`, and `1920` widths. At each run:

```js
const hostRect = host.getBoundingClientRect();
const expectedWidth = Math.max(
  innerWidth * 0.4,
  Math.min(innerWidth * 7 / 9, innerWidth * 0.324444444 + 145.0666667)
);
assertClose(hostRect.width, expectedWidth, 1, `stage width at ${innerWidth}px`);
assertClose(hostRect.left + hostRect.width / 2, innerWidth / 2, 1, 'horizontal center');
assertClose(hostRect.top + hostRect.height / 2, innerHeight / 2, 1, 'vertical center');
assert.equal(document.documentElement.scrollWidth, innerWidth, 'no horizontal overflow');
```

When `innerWidth === 320`, resolve `--orbit-font-size` and assert `20px`. Mount a dedicated ten-character fixture `一二三四五六七八九十`, await `ready`, and verify its geometry contains exactly one line, fits the existing 16px safety bounds, and has no auto-generated second line. A small automatic fit below the CSS request is acceptable because the normalized `ballGapEm` and ball must also fit.

- [ ] **Step 3: Verify RED**

Run: `npm test`

Expected: production CSS contract assertions fail because the formulas and `100dvh` are absent.

- [ ] **Step 4: Make the minimal CSS change**

In `src/base.css`:

```css
:root {
  color-scheme: light;
  --orbit-page-background: #f7f2ef;
  --orbit-stage-width: max(
    40vw,
    min(77.7777778vw, calc(32.4444444vw + 145.0666667px))
  );
  --orbit-stage-height: 100dvh;
  --orbit-font-size: clamp(20px, calc(2.75vw + 11.2px), 64px);
  --orbit-page-x: 0px;
  --orbit-page-y: 0px;
  --orbit-page-scale: 1;
}
```

Use `height: 100dvh` with `100svh` fallback declared immediately before it. Keep the existing fixed `top: 50%`, `left: 50%`, and `translate(-50%, -50%)` centering. Remove the mobile media rule that replaces the stage width; no breakpoint should alter the formula.

Apply `--orbit-font-size` on the host so the Web Component reads it through its existing CSS-variable interface. Do not modify component JavaScript.

- [ ] **Step 5: Verify GREEN**

Run: `npm test`

Expected: the full Node suite passes.

Start the existing preview with `npm run serve`, open `tests/browser.html`, and verify every browser assertion passes with an empty console.

- [ ] **Step 6: Commit**

```bash
git add src/base.css tests/production-page.test.js tests/final-browser-invariants.test.js tests/browser-tests.js
git commit -m "feat: add fluid centered hero layout"
```

---

### Task 3: Final regression and visual verification

**Files:**
- Modify only if a verified failure requires a narrowly scoped correction to Task 1 or Task 2 files.

**Interfaces:**
- Consumes: completed production config and CSS.
- Produces: fresh evidence that the formal page matches the approved behavior.

- [ ] **Step 1: Run automated verification**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 2: Run browser verification**

Open `index.html` and `tests/browser.html` from the active local server. Inspect desktop and mobile viewports, including `320x700`, `390x844`, `1280x800`, and `1920x1080`.

Confirm exact center alignment, no clipped text or ball, no horizontal scrolling, black foreground, `#f7f2ef` background, correct six-item sequence, and an empty console.

- [ ] **Step 3: Check the diff**

Run: `git diff --check`

Expected: no output.

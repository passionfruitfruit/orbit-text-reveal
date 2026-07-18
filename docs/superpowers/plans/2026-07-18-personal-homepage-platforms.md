# Personal Homepage Platform Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reversible scroll-driven Orbit intro that settles at 65% scale above a configurable, responsive platform-card section for Bilibili, QQ, and email.

**Architecture:** Keep the Orbit Web Component unchanged and drive only its existing external page transform variables from a new intro controller. Add a separate platform data model and renderer, then integrate both into a sticky intro scene that naturally unpins into document scrolling. Extend `dev.html` through a focused platform editor module instead of expanding Orbit's configuration contract.

**Tech Stack:** Vanilla HTML, CSS, ES modules, Web Components, Node `node:test`, browser integration tests, zero runtime dependencies.

## Global Constraints

- The authoritative design is `docs/superpowers/specs/2026-07-18-personal-homepage-platforms-design.md`.
- The accurate project date is `2026-07-18`; cache-busting query strings created by this plan use `20260718-*`.
- Preserve every existing Orbit text, color, continuous sizing formula, live-resize bridge, safe-boundary reflow, pause/resume, reduced-motion, and exact recenter behavior.
- Orbit moves only through existing external `--orbit-page-y` and `--orbit-page-scale`; do not restart its internal timeline or change its active index.
- Intro progress is reversible and scroll-linked: `0` is centered at scale `1`; `1` is horizontally centered at scale `0.65` and `--intro-orbit-center-y`.
- Use native document scrolling. Do not cancel `wheel`, `touchmove`, or trackpad inertia.
- `.intro-sequence` height is `calc(100svh + var(--intro-travel))`; `--intro-travel` is `clamp(520px, 85svh, 900px)`.
- Platform appearance begins at progress `0.62`, reaches its overshoot by `0.88`, and settles by `1`; overshoot is at most `-5px` from the target.
- Platform container width is `min(calc(100vw - 32px), calc(52vw + 121.6px), 1120px)`.
- Use two columns at `900px` and wider, one column below `900px`.
- Platform cards have radius `8px`, stable horizontal geometry, correct link/button semantics, and visible copy success/failure feedback.
- Bilibili URL is exactly `https://space.bilibili.com/496633495?`; QQ URL is exactly `https://user.qzone.qq.com/2533194273`; email copy text is exactly `mail@zhang.jx.cn`.
- `config.js` retains `animationConfig` unchanged and adds a separate `platformConfig` export.
- Existing Orbit config copy/download behavior remains backward compatible; platform config gets separate copy/download actions.
- Formal page and developer tooling remain separated.
- Do not modify or add `concept-copenhagen.html`.
- Use local vendored brand assets, not runtime CDN requests. Bilibili and Tencent QQ assets come from Simple Icons v16; the email asset comes from Lucide's `mail.svg`. Keep their upstream license notices in `assets/platforms/NOTICE.md`.

---

### Task 1: Platform Configuration Model And Initial Data

**Files:**
- Create: `src/platform-config.js`
- Create: `tests/platform-config.test.js`
- Modify: `config.js`
- Modify: `tests/production-config.test.js`
- Create: `assets/platforms/bilibili.svg`
- Create: `assets/platforms/tencentqq.svg`
- Create: `assets/platforms/mail.svg`
- Create: `assets/platforms/NOTICE.md`

**Interfaces:**
- Produces: `normalizePlatformConfig(value) -> PlatformEntry[]`
- Produces: `createPlatformEntry(overrides) -> PlatformEntry`
- Produces: `duplicatePlatform(entries, index) -> PlatformEntry[]`
- Produces: `movePlatform(entries, index, direction) -> PlatformEntry[]`
- Produces: `removePlatform(entries, index) -> PlatformEntry[]`
- Produces: `serializePlatformConfig(entries) -> string`
- Produces: `platformConfig` export from `config.js`

- [ ] **Step 1: Write failing platform-model tests**

Create `tests/platform-config.test.js` with real input/output assertions:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlatformEntry,
  duplicatePlatform,
  movePlatform,
  normalizePlatformConfig,
  removePlatform,
  serializePlatformConfig
} from '../src/platform-config.js';

test('normalizes link and copy entries without sharing nested action objects', () => {
  const source = [{
    id: 'mail', title: '邮箱', description: '联系我', icon: './mail.svg',
    iconSide: 'right', action: { type: 'copy', value: 'mail@example.com' }
  }];
  const result = normalizePlatformConfig(source);
  assert.deepEqual(result[0], {
    id: 'mail', title: '邮箱', description: '联系我', icon: './mail.svg',
    iconSide: 'right', action: { type: 'copy', value: 'mail@example.com', newTab: false }
  });
  assert.notStrictEqual(result[0].action, source[0].action);
});

test('drops invalid entries and creates unique duplicated ids', () => {
  const valid = createPlatformEntry({ id: 'qq', title: 'QQ' });
  assert.equal(normalizePlatformConfig([{}, valid]).length, 1);
  const duplicated = duplicatePlatform([valid], 0);
  assert.equal(duplicated.length, 2);
  assert.notEqual(duplicated[0].id, duplicated[1].id);
});

test('move remove and serialization preserve immutable ordering', () => {
  const entries = [createPlatformEntry({ id: 'a', title: 'A' }), createPlatformEntry({ id: 'b', title: 'B' })];
  assert.deepEqual(movePlatform(entries, 0, 1).map((item) => item.id), ['b', 'a']);
  assert.deepEqual(removePlatform(entries, 0).map((item) => item.id), ['b']);
  assert.match(serializePlatformConfig(entries), /"action"/);
  assert.deepEqual(entries.map((item) => item.id), ['a', 'b']);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/platform-config.test.js`

Expected: FAIL because `src/platform-config.js` does not exist.

- [ ] **Step 3: Implement the platform model**

Create `src/platform-config.js` with these exact defaults and validation rules:

```js
const DEFAULT_ENTRY = Object.freeze({
  id: 'platform',
  title: '新平台',
  description: '平台介绍',
  icon: './assets/platforms/mail.svg',
  iconSide: 'left',
  action: Object.freeze({ type: 'link', value: 'https://example.com', newTab: true })
});

export function normalizePlatformConfig(value) {
  if (!Array.isArray(value)) return [];
  const used = new Set();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const title = String(item.title ?? '').trim();
    const description = String(item.description ?? '').trim();
    const icon = String(item.icon ?? '').trim();
    const actionValue = String(item.action?.value ?? '').trim();
    if (!title || !description || !icon || !actionValue) return [];
    const baseId = String(item.id ?? title).trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || `platform-${index + 1}`;
    let id = baseId;
    for (let suffix = 2; used.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    used.add(id);
    const type = item.action?.type === 'copy' ? 'copy' : 'link';
    return [{
      id,
      title,
      description,
      icon,
      iconSide: item.iconSide === 'right' ? 'right' : 'left',
      action: { type, value: actionValue, newTab: type === 'link' && item.action?.newTab !== false }
    }];
  });
}
```

Implement the remaining exported operations as immutable wrappers around `normalizePlatformConfig()`. `createPlatformEntry()` merges `DEFAULT_ENTRY` with overrides and always returns one valid independent object. `serializePlatformConfig()` returns two-space-indented JSON plus a trailing newline.

- [ ] **Step 4: Vendor the icon assets and notice**

Download fixed-major upstream assets, then keep local copies:

```bash
curl -L https://cdn.jsdelivr.net/npm/simple-icons@16/icons/bilibili.svg -o assets/platforms/bilibili.svg
curl -L https://cdn.jsdelivr.net/npm/simple-icons@16/icons/tencentqq.svg -o assets/platforms/tencentqq.svg
curl -L https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/mail.svg -o assets/platforms/mail.svg
```

Create `assets/platforms/NOTICE.md` identifying Bilibili and Tencent QQ as Simple Icons v16 assets under CC0-1.0 and `mail.svg` as a Lucide asset under ISC. Do not redraw or alter the SVG paths; color is applied by the surrounding card treatment or source asset.

- [ ] **Step 5: Add formal platform data**

In `config.js`, import `normalizePlatformConfig` and export:

```js
export const platformConfig = normalizePlatformConfig([
  {
    id: 'bilibili', title: 'bilibili', description: '视频、动态与我的公开投稿',
    icon: './assets/platforms/bilibili.svg', iconSide: 'left',
    action: { type: 'link', value: 'https://space.bilibili.com/496633495?', newTab: true }
  },
  {
    id: 'qq', title: 'QQ', description: '我的 QQ 空间与公开动态',
    icon: './assets/platforms/tencentqq.svg', iconSide: 'right',
    action: { type: 'link', value: 'https://user.qzone.qq.com/2533194273', newTab: true }
  },
  {
    id: 'email', title: '邮箱', description: '复制邮箱地址，与我取得联系',
    icon: './assets/platforms/mail.svg', iconSide: 'left',
    action: { type: 'copy', value: 'mail@zhang.jx.cn', newTab: false }
  }
]);
```

Extend `tests/production-config.test.js` to assert the exact ordered ids, URLs, copy text, actions, icon sides, and local asset paths.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test tests/platform-config.test.js tests/production-config.test.js`

Expected: all focused tests PASS.

Run: `npm test`

Expected: the complete Node suite PASS with no failures.

Commit:

```bash
git add src/platform-config.js tests/platform-config.test.js tests/production-config.test.js config.js assets/platforms
git commit -m "feat: add configurable platform data"
```

---

### Task 2: Accessible Platform Card Renderer And Responsive Layout

**Files:**
- Create: `src/platform-renderer.js`
- Create: `tests/platform-renderer.test.js`
- Modify: `index.html`
- Modify: `src/base.css`
- Modify: `tests/production-page.test.js`
- Modify: `tests/browser-tests.js`

**Interfaces:**
- Consumes: normalized `PlatformEntry[]` from Task 1.
- Produces: `renderPlatformCards(container, entries, options) -> { destroy() }`
- Produces: `copyPlatformValue(value, clipboard) -> Promise<'copied' | 'failed'>`
- Produces: `.platform-card`, `.platform-card__icon`, `.platform-card__copy-status` DOM contracts.

- [ ] **Step 1: Write failing renderer contracts**

Create `tests/platform-renderer.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { copyPlatformValue } from '../src/platform-renderer.js';

test('copyPlatformValue returns copied only after the clipboard resolves', async () => {
  const writes = [];
  assert.equal(await copyPlatformValue('mail@example.com', { writeText: async (value) => writes.push(value) }), 'copied');
  assert.deepEqual(writes, ['mail@example.com']);
});

test('copyPlatformValue reports failure without throwing', async () => {
  assert.equal(await copyPlatformValue('mail@example.com', { writeText: async () => { throw new Error('denied'); } }), 'failed');
});
```

Add production source assertions requiring `main`, `.intro-sequence`, `.intro-scene`, `#platform-grid`, and a semantic heading. Add browser assertions that link entries render as anchors, copy entries as buttons, icon-side classes match configuration, external link rel is safe, and copy success/failure changes visible status text.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/platform-renderer.test.js tests/production-page.test.js`

Expected: FAIL because the renderer and production structure do not exist.

- [ ] **Step 3: Add production semantic structure**

Replace the body contents of `index.html` with this shape while retaining the stylesheet and module script:

```html
<main class="homepage">
  <section class="intro-sequence" aria-labelledby="platform-heading">
    <div class="intro-scene">
      <orbit-text-reveal hidden></orbit-text-reveal>
      <section class="platforms" aria-labelledby="platform-heading">
        <h1 id="platform-heading" class="platforms__heading">找到我</h1>
        <div id="platform-grid" class="platform-grid"></div>
      </section>
    </div>
  </section>
</main>
```

The heading begins visually hidden by intro progress, not with the HTML `hidden` attribute, so accessibility state can be updated by the intro controller.

- [ ] **Step 4: Implement renderer semantics and copy feedback**

In `src/platform-renderer.js`:

```js
export async function copyPlatformValue(value, clipboard = globalThis.navigator?.clipboard) {
  try {
    if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
    await clipboard.writeText(value);
    return 'copied';
  } catch {
    return 'failed';
  }
}
```

`renderPlatformCards()` clears only the supplied container, renders each link as `<a>` and each copy action as `<button type="button">`, appends `<img alt="">`, title, description, and a fixed-size status element. Link cards use the configured `href`, `target="_blank"` only when requested, and `rel="noopener noreferrer"`. Copy cards call `copyPlatformValue`, show `已复制` or `复制失败`, and restore the description after `1600ms`. `destroy()` clears pending status timers and event listeners.

- [ ] **Step 5: Implement responsive card CSS**

Change page overflow to `overflow-x: clip; overflow-y: auto`. Add the exact intro variables, sticky structure, platform width formula, one/two-column breakpoint, and stable card geometry from the spec. Use:

```css
.intro-sequence { min-height: calc(100svh + var(--intro-travel)); }
.intro-scene { position: sticky; top: 0; min-height: 100svh; }
.intro-scene orbit-text-reveal { position: absolute; }

.platforms {
  width: min(calc(100vw - 32px), calc(52vw + 121.6px), 1120px);
  margin-inline: auto;
  padding-block: clamp(250px, 36svh, 380px) 48px;
}

.platform-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 900px) { .platform-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
```

Cards use `min-height: 132px`, `padding: 22px 24px`, `border-radius: 8px`; below `600px` use `min-height: 120px`, `padding: 18px`, `48px` icons, and `21px` titles. Add visible `:focus-visible`, restrained hover lift, no layout shift, no nested cards, and no horizontal overflow.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test tests/platform-renderer.test.js tests/production-page.test.js`

Expected: focused tests PASS.

Run: `npm test`

Expected: full Node suite PASS.

Commit:

```bash
git add src/platform-renderer.js tests/platform-renderer.test.js index.html src/base.css tests/production-page.test.js tests/browser-tests.js
git commit -m "feat: render responsive platform cards"
```

---

### Task 3: Reversible Scroll-Linked Intro Controller

**Files:**
- Create: `src/intro-scroll.js`
- Create: `tests/intro-scroll.test.js`
- Modify: `src/base.css`
- Modify: `tests/browser-tests.js`

**Interfaces:**
- Produces: `clampProgress(value) -> number`
- Produces: `computeIntroFrame(progress, viewport) -> IntroFrame`
- Produces: `createIntroScrollController(options) -> { start(), destroy(), update() }`
- `IntroFrame`: `{ progress, orbitScale, orbitOffsetY, platformOpacity, platformTranslateY, interactive }`

- [ ] **Step 1: Write failing pure motion tests**

Create `tests/intro-scroll.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { clampProgress, computeIntroFrame } from '../src/intro-scroll.js';

test('clamps intro progress and reaches exact Orbit endpoints', () => {
  assert.equal(clampProgress(-1), 0);
  assert.equal(clampProgress(2), 1);
  const start = computeIntroFrame(0, { width: 1920, height: 1080 });
  const end = computeIntroFrame(1, { width: 1920, height: 1080 });
  assert.equal(start.orbitScale, 1);
  assert.equal(start.orbitOffsetY, 0);
  assert.equal(end.orbitScale, 0.65);
  assert.equal(end.orbitOffsetY, 216 - 540);
});

test('platforms fade after 0.62 and overshoot before settling', () => {
  assert.equal(computeIntroFrame(0.61, { width: 1280, height: 800 }).platformOpacity, 0);
  assert.ok(computeIntroFrame(0.8, { width: 1280, height: 800 }).platformOpacity > 0);
  assert.ok(computeIntroFrame(0.9, { width: 1280, height: 800 }).platformTranslateY < 0);
  assert.equal(computeIntroFrame(1, { width: 1280, height: 800 }).platformTranslateY, 0);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/intro-scroll.test.js`

Expected: FAIL because `src/intro-scroll.js` does not exist.

- [ ] **Step 3: Implement pure intro frame calculation**

Use exact linear interpolation for Orbit scale and y offset. Resolve target y in pixels as `clamp(0.18 * height, 0.15 * height + 0.03 * width, 0.20 * height)`. Platform opacity is normalized progress from `0.62` to `0.88`. Platform translate uses three pieces: `24px` at `0.62`, `0px` at `0.84`, `-5px` at `0.90`, and `0px` at `1`. `interactive` becomes true only when platform opacity is at least `0.98`.

- [ ] **Step 4: Implement the controller without blocking native input**

`createIntroScrollController({ windowRef, documentRef, sequence, host, platforms, cards, reducedMotionQuery })` must:

1. Read travel distance as `sequence.scrollHeight - windowRef.innerHeight`.
2. Compute progress from `-sequence.getBoundingClientRect().top / travel` and clamp it.
3. Write `--orbit-page-y`, `--orbit-page-scale`, `--platform-opacity`, and `--platform-translate-y` through one `requestAnimationFrame` update.
4. Set `platforms.inert = !frame.interactive` and `aria-hidden` accordingly.
5. Never call `host.restart()`, `host.next()`, or replace `host.config` during scrolling.
6. Observe `scroll`, `resize`, and reduced-motion changes; remove every listener in `destroy()`.
7. After `140ms` idle at an intermediate progress, smooth-scroll to the nearest endpoint. A new user scroll cancels the active settle. Reduced-motion mode skips smooth settling and applies direct stable frames.

- [ ] **Step 5: Add browser regression assertions**

Add assertions that programmatically scroll to progress `0`, `0.5`, `0.9`, and `1`, then verify:

- Orbit stays horizontally centered within `1px`.
- Orbit scale resolves to `1`, an intermediate value, then exactly `0.65`.
- Active Orbit index and loop start count do not change because of scroll.
- Platform opacity and translate follow the piecewise frame.
- At progress `0`, platform content is hidden and not focusable; at progress `1`, it is interactive.
- Scrolling back to `0` reverses all states.
- Scrolling beyond progress `1` moves the sticky scene naturally rather than trapping scroll.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test tests/intro-scroll.test.js`

Expected: focused tests PASS.

Run: `npm test`

Expected: full Node suite PASS.

Commit:

```bash
git add src/intro-scroll.js tests/intro-scroll.test.js src/base.css tests/browser-tests.js
git commit -m "feat: add reversible scroll intro"
```

---

### Task 4: Production Bootstrap Integration And Cache Versions

**Files:**
- Modify: `main.js`
- Modify: `index.html`
- Modify: `tests/production-page.test.js`
- Modify: `tests/final-browser-invariants.test.js`
- Modify: `tests/browser-tests.js`
- Modify: `tests/browser.html`

**Interfaces:**
- Consumes: `platformConfig`, `renderPlatformCards`, and `createIntroScrollController`.
- Produces: `startProductionPage(...) -> { host, platformView, introController }` for controlled tests.

- [ ] **Step 1: Write failing bootstrap-order tests**

Extend the module-entry test so injected dependencies record this exact order:

```js
assert.deepEqual(calls, [
  'fonts-ready',
  'load-component',
  'assign-orbit-config',
  'render-platforms',
  'start-intro',
  'show-orbit'
]);
```

Assert missing required production elements throw a clear error before listeners are installed, and that a returned controller can be destroyed by tests.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/production-page.test.js tests/final-browser-invariants.test.js`

Expected: FAIL because production bootstrap does not render platforms or start the intro.

- [ ] **Step 3: Integrate modules in `main.js`**

Import `animationConfig` and `platformConfig`, inject renderer/controller dependencies for tests, locate `orbit-text-reveal`, `.intro-sequence`, `.platforms`, and `#platform-grid`, then start in the asserted order. Keep `document.fonts.ready` before dynamic component import. Return the created objects. Do not add global mutable state beyond the returned controller.

- [ ] **Step 4: Bump the complete production cache chain**

Use a new consistent `20260718-3` value for modified production entries:

- `index.html` -> `main.js`
- `main.js` -> `config.js`, `platform-renderer.js`, and `intro-scroll.js`
- `config.js` -> `platform-config.js`
- `tests/browser.html` -> `browser-tests.js`
- `tests/browser-tests.js` -> modified imported modules

Keep the unchanged Orbit component import at `orbit-text-reveal.js?v=20260718-2`. Do not alter unrelated historical query strings inside untouched Orbit internals.

- [ ] **Step 5: Run production browser suite**

Run: `npm test`

Expected: full Node suite PASS.

Open `http://127.0.0.1:4173/tests/browser.html` in a fresh browser tab and wait for `ALL TESTS PASSED`. Confirm the fresh tab has zero warning/error console entries.

At `1920×1080`, verify platform width is `1120px` and two columns. At `320×700`, verify width is `288px`, one column, no horizontal overflow, Orbit final scale is `0.65`, and all three cards remain reachable.

- [ ] **Step 6: Commit**

```bash
git add main.js index.html tests/production-page.test.js tests/final-browser-invariants.test.js tests/browser-tests.js tests/browser.html config.js
git commit -m "feat: integrate platform intro page"
```

---

### Task 5: Developer Platform Editor And Final Verification

**Files:**
- Create: `src/platform-dev-app.js`
- Create: `tests/platform-dev-app.test.js`
- Modify: `dev.html`
- Modify: `src/dev.css`
- Modify: `src/dev-app.js`
- Modify: `tests/dev-page.test.js`
- Modify: `tests/dev-app.test.js`
- Modify: `tests/browser-tests.js`
- Modify: `README.md`
- Modify: `CONFIG_GUIDE.md`

**Interfaces:**
- Consumes: platform operations from `src/platform-config.js` and renderer from `src/platform-renderer.js`.
- Produces: `startPlatformDeveloperEditor(options) -> { getDraft(), destroy() }`.
- Does not change existing Orbit editor export JSON or button behavior.

- [ ] **Step 1: Write failing editor contracts**

Create `tests/platform-dev-app.test.js` for pure editor operations and add source/browser contracts requiring:

- A `平台入口` section.
- Add, duplicate, delete, move up, and move down commands.
- Inputs for title, description, icon path, icon side, action type, action value, and new-tab behavior.
- Separate `复制平台配置` and `下载平台配置` actions.
- A live platform preview.
- Existing Orbit `复制配置` and `下载配置` output stays byte-for-byte compatible.

Use a minimal fake environment to assert the platform copy action receives `serializePlatformConfig(draft)` and the download filename is `platform-config.json`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/platform-dev-app.test.js tests/dev-page.test.js tests/dev-app.test.js`

Expected: FAIL because the platform editor does not exist.

- [ ] **Step 3: Add developer markup and styling**

Add one unframed `平台入口` section to `dev.html` with a platform-card editor list, toolbar commands, live preview, and separate platform export actions. Reuse the existing developer visual language; do not place platform controls inside Orbit cards or add cards inside cards. Ensure all action buttons remain at least `44px` tall and the editor becomes one column below `960px`.

- [ ] **Step 4: Implement `src/platform-dev-app.js`**

`startPlatformDeveloperEditor()` owns its draft, renders form rows from normalized entries, delegates immutable add/duplicate/move/remove operations to `platform-config.js`, and calls `renderPlatformCards()` for immediate preview. Inputs update on a `120ms` trailing debounce, matching the existing Orbit editor. Invalid rows remain visible with inline validation and are excluded from serialized output. Copy/download use injected clipboard, Blob, URL, and timer dependencies for deterministic tests.

- [ ] **Step 5: Coordinate from `src/dev-app.js` and bump dev cache chain**

Start the platform editor after the existing Orbit developer app is ready. Pass `platformConfig` without changing `cloneDraft`, Orbit controls, or current animation serialization. Update:

- `dev.html` -> `src/dev-app.js`
- `src/dev-app.js` -> `platform-dev-app.js`, `platform-config.js`, `platform-renderer.js`, and `orbit-text-reveal.js`

Use `20260718-3` for the modified developer entry and new platform modules. Keep the unchanged Orbit component import at `orbit-text-reveal.js?v=20260718-2`.

- [ ] **Step 6: Document platform configuration**

Add a README section linking the formal `platformConfig` structure and the developer editor. Add a focused section to `CONFIG_GUIDE.md` that documents every platform field, link/copy behavior, icon side, local/remote icon values, and separate export format. Do not mix platform fields into the Orbit `normalizeConfig()` tables.

- [ ] **Step 7: Run complete verification**

Run:

```bash
node --test tests/platform-dev-app.test.js tests/dev-page.test.js tests/dev-app.test.js
npm test
git diff --check
```

Expected: all focused and complete Node tests PASS, and diff check is clean.

Open a fresh `tests/browser.html` tab and confirm `ALL TESTS PASSED` with no warning/error console logs. Open a fresh formal `index.html` tab and manually verify desktop, narrowed desktop, and `320×700` behavior. Verify forward scroll, auto settle, natural unpin, reverse return, link attributes, email copy feedback, and no Orbit restart/index change.

- [ ] **Step 8: Commit**

```bash
git add src/platform-dev-app.js tests/platform-dev-app.test.js dev.html src/dev.css src/dev-app.js tests/dev-page.test.js tests/dev-app.test.js tests/browser-tests.js README.md CONFIG_GUIDE.md
git commit -m "feat: add platform configuration editor"
```

---

## Final Review Gate

After all five tasks:

1. Run `npm test` and record the exact pass/fail count.
2. Run the fresh browser suite and record `ALL TESTS PASSED` plus clean warning/error logs.
3. Run `git diff --check`.
4. Confirm only expected feature files and vendored icon assets changed; leave `concept-copenhagen.html` untouched.
5. Dispatch a broad read-only review covering the full range after commit `0545029`.
6. Fix every Critical or Important finding through a dedicated DeepSeek fix subagent, re-run affected tests, and re-review.
7. Keep the final formal `http://127.0.0.1:4173/index.html` tab as the user-facing deliverable.

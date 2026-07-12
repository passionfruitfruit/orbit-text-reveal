# Config Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a standalone Chinese tutorial covering every configurable point in `config.js` and link it from README.

**Architecture:** Keep runtime files unchanged. Add one root-level guide as the canonical human-facing tutorial, one README entry link, and one Node source test that locks the guide to the normalized configuration contract.

**Tech Stack:** Markdown, native `node:test`, filesystem source assertions.

## Global Constraints

- Defaults and numeric limits must match `src/config.js` exactly.
- Current global timeline semantics must match `src/orbit-text-reveal.js` and README.
- Active fields and compatibility-only fields must be visibly separated.
- Per-text layout overrides must list only fields accepted by `normalizeLayoutOverride()`.
- Runtime JavaScript and configuration defaults must not change.
- Tutorial language is concise Chinese with copyable examples.

---

### Task 1: Guide Contract Test

**Files:**
- Create: `tests/config-guide.test.js`

**Interfaces:**
- Consumes: `CONFIG_GUIDE.md`, `README.md`, and `src/config.js` as text.
- Produces: regression evidence that the tutorial exists, is linked, and contains every exact public field and important numeric limit.

- [x] **Step 1: Write the failing source test**

Create a `node:test` file that reads `CONFIG_GUIDE.md`, `README.md`, and `src/config.js`. Assert README contains `[配置完整教程](./CONFIG_GUIDE.md)`. Assert the guide contains headings for quick start, texts, timing, layout, style, motion, accessibility, complete examples, and troubleshooting. Assert it names every field below:

```js
const fields = [
  'texts', 'text', 'holdMs', 'revealMs', 'retractMs',
  'maxWidth', 'fontSize', 'lineHeight', 'ballSizeEm', 'ballGapEm',
  'x', 'y', 'scale', 'autoWrap',
  'textColor', 'ballColor', 'background', 'fontFamily', 'fontWeight',
  'easing', 'lineEasing', 'continuationEasing', 'exitEasing',
  'singleLineEasing', 'characterScale', 'characterMinScale',
  'enableCharacterScale', 'reducedMotionRotate', 'lineTravelMs', 'centerHoldMs'
];
```

Assert the guide contains normalization ranges `0–20000`, `120–2400`, `12–240`, `0.8–2`, `0.2–2`, `0.25–4`, `100–900`, `0.7–1.5`, and `0.01–1`. Assert compatibility-only fields are named in one section.

- [x] **Step 2: Verify RED**

Run: `node --test tests/config-guide.test.js`

Expected: FAIL because `CONFIG_GUIDE.md` and the README link do not exist.

- [x] **Step 3: Commit the failing contract test**

```bash
git add tests/config-guide.test.js
git commit -m "test: define config guide contract"
```

---

### Task 2: Standalone Chinese Tutorial

**Files:**
- Create: `CONFIG_GUIDE.md`
- Modify: `README.md`

**Interfaces:**
- Produces: `[配置完整教程](./CONFIG_GUIDE.md)` as the stable guide entry.
- Documents: all normalized global fields, all normalized per-text fields, active timeline semantics, compatibility fields, CSS override boundary, and copyable recipes.

- [x] **Step 1: Write the tutorial**

Create `CONFIG_GUIDE.md` with this exact section order:

1. `快速开始`
2. `理解配置层级`
3. `texts：文本队列与单条覆盖`
4. `timing：整段时间轴`
5. `layout：尺寸、换行与位置`
6. `style：颜色与字体`
7. `motion：缓动与字符形变`
8. `accessibility：减少动态效果`
9. `完整配置示例`
10. `常用配方`
11. `常见问题与排错`

Every configuration group must include a compact table with field, default, accepted value/range, and effect. Follow tables with practical examples. Include explicit warnings that `motion.singleLineEasing` is the active whole-pass easing and the five old row-motion fields are compatibility-only. Explain percentage/pixel position strings, manual newlines, auto wrapping, per-item layout keys, CSS custom-property precedence, normalization/clamping, empty-text removal, and `restart()` conditions.

- [x] **Step 2: Add the README entry**

Directly below the README sentence introducing `config.js`, add:

```markdown
想逐项了解所有字段、范围和常用组合，请阅读：[配置完整教程](./CONFIG_GUIDE.md)。
```

- [x] **Step 3: Verify focused GREEN**

Run: `node --test tests/config-guide.test.js`

Expected: all config-guide assertions pass.

- [x] **Step 4: Verify no runtime drift**

Run:

```bash
git diff --name-only -- CONFIG_GUIDE.md README.md tests/config-guide.test.js
git diff --check
npm test
```

Expected: only the tutorial, README, and its test are part of this task; every Node test passes and diff check exits `0`.

- [x] **Step 5: Commit**

```bash
git add CONFIG_GUIDE.md README.md tests/config-guide.test.js
git commit -m "docs: add complete config tutorial"
```

---

### Task 3: Final Review

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-config-guide.md` (checkbox record)

- [x] **Step 1: Cross-check guide values against source**

Compare every default and range in `CONFIG_GUIDE.md` with `DEFAULT_CONFIG`, `LAYOUT_NUMBER_LIMITS`, and `normalizeConfig()` in `src/config.js`. Confirm no guide field implies runtime behavior from a compatibility-only field.

- [x] **Step 2: Run final verification**

```bash
node --test tests/config-guide.test.js
npm test
git diff --check
git status --short --branch
```

Expected: all tests pass, no whitespace errors exist, and unrelated pre-existing browser-test changes remain clearly separated.

# Orbit Text Reveal

一个零依赖、可嵌入任意静态网页的文字循环动画：圆球逐行揭示文字，停留后沿原路径收回，并精确返回中央。正式展示页和开发者配置页完全分离。

## 快速开始

```bash
npm run serve
```

然后打开：

- 正式展示页：<http://127.0.0.1:4173/index.html>
- 开发者配置页：<http://127.0.0.1:4173/dev.html>
- 浏览器测试页：<http://127.0.0.1:4173/tests/browser.html>

运行 Node 自动化测试：

```bash
npm test
```

## 最小嵌入示例

```html
<orbit-text-reveal id="hero-copy"></orbit-text-reveal>

<script type="module">
  import './src/orbit-text-reveal.js';

  const animation = document.querySelector('#hero-copy');
  animation.config = {
    texts: [
      { text: '这是一段单行文本', holdMs: 1800 },
      { text: '这一段在这里\n手动换行', holdMs: 2200 }
    ],
    layout: {
      maxWidth: 680,
      fontSize: 64,
      x: '50%',
      y: '50%',
      scale: 1,
      autoWrap: false
    },
    motion: { singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)' }
  };
</script>
```

组件提供 `play()`、`pause()`、`restart()`、`next()` 和 `destroy()` 方法，并发送 `orbit-state-change`、`orbit-index-change` 事件。普通 `config` 替换和尺寸变化会在当前收回并回中后安全应用；开发者实时预览可调用 `updateConfig(config, { immediate: true })` 明确立即重播。

## 配置字段

正式页默认配置集中在 [`config.js`](./config.js)。未填写的字段会使用 `src/config.js` 中的默认值。

想逐项了解所有字段、范围和常用组合，请阅读：[配置完整教程](./CONFIG_GUIDE.md)。

| 字段 | 默认值 | 说明 |
|---|---:|---|
| `texts` | 示例文本数组 | 按数组顺序循环，数量不限 |
| `texts[].text` | — | 展示内容；写入真实换行符可指定换行位置 |
| `texts[].holdMs` | 使用全局/默认值 | 当前文字完全展开后的停留毫秒数 |
| `texts[].revealMs` | `timing.revealMs` | 可选的单条展开时长 |
| `texts[].retractMs` | `timing.retractMs` | 可选的单条收回时长 |
| `texts[].layout` | 使用全局 `layout` | 可选的单条布局覆盖；支持下列全部 `layout.*` 字段 |
| `timing.revealMs` | `900` | 完整多行展开的总时长，毫秒 |
| `timing.retractMs` | `900` | 完整多行收回的总时长，毫秒 |
| `timing.lineTravelMs` | `260` | 兼容旧配置；当前跨行按参考动画直接瞬移 |
| `timing.centerHoldMs` | `1000` | 圆球回到中央后的停留时间 |
| `layout.maxWidth` | `680` | 单行最大宽度；超出后自动换行 |
| `layout.fontSize` | `64` | 字号，像素 |
| `layout.lineHeight` | `1.16` | 行高倍率 |
| `layout.ballSizeEm` | `0.78` | 圆球相对字号的直径 |
| `layout.ballGapEm` | `0.08` | 文字末端与圆球的间距 |
| `layout.x` | `50%` | 动画中心在组件内的横向位置，支持百分比或像素 |
| `layout.y` | `50%` | 动画中心在组件内的纵向位置，支持百分比或像素 |
| `layout.scale` | `1` | 文字、圆球和间距的整体倍率 |
| `layout.autoWrap` | `true` | 超宽时自动换行；设为 `false` 后只服从手动换行 |
| `style.textColor` | `#111111` | 文字颜色 |
| `style.ballColor` | `#111111` | 圆球颜色 |
| `style.background` | `#ecebe8` | 舞台背景颜色 |
| `style.fontFamily` | 系统无衬线 | 字体族 |
| `style.fontWeight` | `700` | 字重 |
| `motion.easing` | `cubic-bezier(0.333333, 0, 0.666667, 0.5)` | 旧版兼容字段，不再驱动全局时间轴 |
| `motion.continuationEasing` | `linear` | 旧版兼容字段，不再驱动全局时间轴 |
| `motion.exitEasing` | `cubic-bezier(0.333333, 0.5, 0.666667, 1)` | 旧版兼容字段，不再驱动全局时间轴 |
| `motion.singleLineEasing` | `cubic-bezier(0.333333, 0, 0.666667, 1)` | 整段展开与收回使用的完整加速—减速曲线 |
| `motion.lineEasing` | 平滑贝塞尔曲线 | 兼容旧配置；当前跨行直接瞬移 |
| `motion.characterMinScale` | `0.08` | 字符刚脱出或进入圆球时的最小比例 |
| `motion.enableCharacterScale` | `true` | 是否启用局部字符形变 |
| `accessibility.reducedMotionRotate` | `false` | 减少动态效果时是否仍轮换文本 |

每段文本的所有横向行程会按像素距离连接成一条全局时间轴。展开只在整段开头加速、整段末尾减速；收回沿完全相反的累计路径执行同一套完整曲线。每行占用的进度与其横向距离成正比，换行跳转不占用时间，也不会重新触发加速或减速。

`motion.singleLineEasing` 是当前唯一驱动横向时间轴的缓动字段，名称为兼容既有配置而保留。`motion.easing`、`motion.continuationEasing`、`motion.exitEasing` 和 `timing.lineTravelMs` 都是旧版兼容字段，不再驱动全局时间轴。

## 常用修改

### 修改文本数量和顺序

编辑 `config.js` 中的 `texts` 数组。数组顺序就是播放顺序；可以自由新增、删除或移动条目。

### 保持某段单行

不要在该条 `text` 中输入换行，并确保测量宽度没有超过 `layout.maxWidth`。其他条目即使换行，也不会影响它。

### 指定换行位置

在开发者页面的文本框中直接按回车，或在 JavaScript 字符串中写 `\n`：

```js
{ text: '第一行\n第二行', holdMs: 2200 }
```

若希望完全由你指定换行位置，将 `layout.autoWrap` 设为 `false`；超宽内容会整体等比缩小，不会擅自增加换行。

### 调整自动换行

修改 `layout.maxWidth`，并用 `layout.autoWrap` 控制是否允许自动换行。窄屏下组件会取配置宽度和实际舞台可用宽度中的较小值；极端情况下会等比缩小内部文字和圆球，避免裁切。

若某一条需要独立排版，可只覆盖需要变化的字段：

```js
{
  text: '这一条使用独立布局',
  holdMs: 2200,
  layout: { maxWidth: 480, fontSize: 48, x: '42%', y: '58%', scale: 1.1 }
}
```

### 移动和缩放组件

组件内部中心使用 `layout.x`、`layout.y`、`layout.scale`。正式页面整体位置还可由 CSS 变量覆盖：

```css
:root {
  --orbit-stage-width: 900px;
  --orbit-stage-height: 420px;
  --orbit-page-x: 80px;
  --orbit-page-y: -40px;
  --orbit-page-scale: 0.85;
}
```

组件本身还支持以下 CSS 自定义属性；配置值始终作为默认值，外部 CSS 存在时覆盖它。修改影响几何的属性后调用 `restart()` 重新测量：

```css
orbit-text-reveal {
  --orbit-font-family: "Noto Sans SC", sans-serif;
  --orbit-font-size: 56px;
  --orbit-font-weight: 800;
  --orbit-text-color: #172033;
  --orbit-ball-color: #ef5b35;
  --orbit-ball-size: 0.72em;
  --orbit-ball-gap: 0.12em;
  --orbit-background: #f3f1eb;
}
```

`--orbit-ball-size` 和 `--orbit-ball-gap` 接受 `px` 或 `em`。字号、圆球尺寸和间距会参与同一套换行与舞台拟合计算，不只是视觉覆盖。

如果把组件嵌入自己的页面，可以直接用普通 CSS 自由放置、旋转、移动和缩放。此时只需要导入组件模块，不必引入正式演示页的 `base.css`：

```css
.hero orbit-text-reveal {
  position: absolute;
  left: 12vw;
  top: 18vh;
  width: 720px;
  height: 320px;
  transform: translate(24px, -12px) rotate(-2deg) scale(0.9);
  transform-origin: center center;
}
```

外部 `transform` 只改变组件在父页面中的最终呈现，不会破坏内部围绕 `layout.x`、`layout.y` 的居中计算。若仅改变宿主位置或旋转，无需重启；若改变组件宽高、字号、圆球尺寸或间距，组件会通过尺寸观察自动安全重排，主动修改字体相关 CSS 变量后也可调用 `restart()` 立即重新测量。

### 调整停留时间

中央停留使用 `timing.centerHoldMs`，默认严格为 1000ms。每段展开后的停留时间写在对应的 `holdMs`；单条还可以覆盖 `revealMs` 和 `retractMs`。

## 使用开发者配置页

1. 打开 <http://127.0.0.1:4173/dev.html>。
2. 新增、删除、复制或排序文本；文本框中可直接指定换行。
3. 调整全局或逐条排版、位置、颜色和字符形变，并使用播放、暂停、重播当前、预览完整循环控制查看结果。
4. 点击“复制配置”或“下载配置”。
5. 将导出的 JSON 对象内容放入 `config.js` 的 `normalizeConfig({ ... })` 中。

开发者页的“平台入口”编辑器独立管理 `platformConfig`：可编辑名称、简介、图标路径、图标左右位置、链接或复制动作及新标签页选项，并支持实时预览、排序、复制和下载 `platform-config.json`。平台配置不会混入 Orbit 的动画配置或 `normalizeConfig()`。

正式页不会加载 `dev-app.js`，也不会显示任何编辑控件。

页面切到后台时组件会自动暂停，返回前台时从原位置继续；若此前已由用户调用 `pause()`，切回前台不会擅自恢复。

## 文件说明

- `index.html`：正式纯展示页。
- `dev.html`：独立开发者配置页。
- `config.js`：正式页面集中配置。
- `src/orbit-text-reveal.js`：封装后的动画组件。
- `src/text-layout.js`：字符分段和换行。
- `src/geometry.js`：对称几何与可逆路径。
- `src/motion.js`：圆球遮挡、水平帧与逐字缩放。
- `src/progressive-layout.js`：逐行累积居中与全局路径进度映射。
- `src/stage-layout.js`：响应式舞台拟合。
- `tests/browser.html`：真实浏览器集成测试入口。

## 完整个人网页

项目现在同时包含 Sites 版个人网页、D1 持久化内容和独立统一后台：

- `/`：Orbit 首屏、平台入口、Bilibili/GitHub/博客混合内容流和公开留言。
- `/blog/:id`：安全 Markdown 站内文章。
- `/admin`：首屏文字、平台入口、内容来源、混合排序、博客和留言审核。
- `dev.html`：仍是独立的 Orbit 组件开发预览，不承担网站后台职责。

本地开发与部署构建：

```bash
npm install
npm run dev
npm test
npm run build
```

私密运行值从 `.env.example` 开始配置。`ADMIN_PASSWORD` 是后台口令，`RATE_LIMIT_SALT` 用于生成不可逆的限流标识，`GITHUB_TOKEN` 可选并只用于提高 GitHub API 限额。这些值不能写入前端代码或提交到 Git。

D1 使用 `.openai/hosting.json` 中的逻辑绑定 `DB`。首次 API 请求会幂等创建表并写入默认 Bilibili UID `496633495` 与 GitHub 用户 `passionfruitfruit`；迁移文件同时保存在 `drizzle/` 供 Sites 部署使用。

首屏舞台宽度按视口宽高连续计算：最宽桌面端为视口的 `40%`，对应左右留白/文本区域/左右留白 `3/4/3`；最窄移动端为 `7/9`，对应 `1/7/1`。运行时会把实际像素宽度写入组件，CSS 中的 `clamp()` 仍作为无 JavaScript 时的保底。

“找到我”平台卡与后续内容统一使用 `--home-column-width`：最大宽度为 `760px`，窄屏保留左右各 `16px`。短视口下平台区会按实际内容自然增高，首屏动画仍只使用 `--intro-travel` 的滚动距离；动画完成后再自然滚动经过剩余平台卡，因此不会与“最近在做”重叠。

Bilibili 投稿同步使用未登录的公开 WBI 签名请求，不保存账号 Cookie。由于 Bilibili 可能对数据中心出口临时返回 `412`，数据库还会幂等写入已核验的近期投稿作为保底；自动同步恢复后会按 BV 号更新这些条目，并继续保留后台设置的显隐和排序。失败同步按六小时冷却，不会在每次页面访问时重复请求。

## 贡献者

- Luke：项目所有者、动画方向与交互需求。
- Codex (OpenAI)：组件实现、测试与工程化协作。

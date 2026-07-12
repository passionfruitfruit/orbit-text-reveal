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
    motion: { continuationEasing: 'linear' }
  };
</script>
```

组件提供 `play()`、`pause()`、`restart()`、`next()` 和 `destroy()` 方法，并发送 `orbit-state-change`、`orbit-index-change` 事件。普通 `config` 替换和尺寸变化会在当前收回并回中后安全应用；开发者实时预览可调用 `updateConfig(config, { immediate: true })` 明确立即重播。

## 配置字段

正式页默认配置集中在 [`config.js`](./config.js)。未填写的字段会使用 `src/config.js` 中的默认值。

| 字段 | 默认值 | 说明 |
|---|---:|---|
| `texts` | 示例文本数组 | 按数组顺序循环，数量不限 |
| `texts[].text` | — | 展示内容；写入真实换行符可指定换行位置 |
| `texts[].holdMs` | 使用全局/默认值 | 当前文字完全展开后的停留毫秒数 |
| `texts[].revealMs` | `timing.revealMs` | 可选的单条展开时长 |
| `texts[].retractMs` | `timing.retractMs` | 可选的单条收回时长 |
| `texts[].layout` | 使用全局 `layout` | 可选的单条布局覆盖；支持下列全部 `layout.*` 字段 |
| `timing.revealMs` | `900` | 最长行按展开巡航速度走完的参考时间，毫秒 |
| `timing.retractMs` | `900` | 最长行按收回巡航速度走完的参考时间，毫秒 |
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
| `motion.easing` | `cubic-bezier(0.333333, 0, 0.666667, 0.5)` | 第一条遍历从静止加速到巡航速度 |
| `motion.continuationEasing` | `linear` | 换行后保持巡航速度，不重复慢启动 |
| `motion.exitEasing` | `cubic-bezier(0.333333, 0.5, 0.666667, 1)` | 最后一条遍历从巡航速度减速到静止 |
| `motion.singleLineEasing` | `cubic-bezier(0.333333, 0, 0.666667, 1)` | 单行文本先加速再减速 |
| `motion.lineEasing` | 平滑贝塞尔曲线 | 兼容旧配置；当前跨行直接瞬移 |
| `motion.characterMinScale` | `0.08` | 字符刚脱出或进入圆球时的最小比例 |
| `motion.enableCharacterScale` | `true` | 是否启用局部字符形变 |
| `accessibility.reducedMotionRotate` | `false` | 减少动态效果时是否仍轮换文本 |

每段文本先以最长一行计算统一巡航速度。展开时第一行加速、中间行匀速、最后一行减速；收回时按反向遍历顺序执行同样的 `加速 → 匀速 → 减速`。短的底行只会更快完成，不会降低随后各行的速度。

默认加速、减速和单行曲线的边界/峰值斜率均为 `1.5`，组件会把对应行的同距离匀速时间乘以 `1.5`，因此与中间 `linear` 行在边界处速度连续。自定义曲线时若要保持严格连续，需要同时保持相同的边界斜率。

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
- `src/progressive-layout.js`：逐行累积居中与跨行延续速度。
- `src/stage-layout.js`：响应式舞台拟合。
- `tests/browser.html`：真实浏览器集成测试入口。

## 贡献者

- Luke：项目所有者、动画方向与交互需求。
- Codex (OpenAI)：组件实现、测试与工程化协作。

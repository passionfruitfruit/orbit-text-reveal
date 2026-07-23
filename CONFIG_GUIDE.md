# `config.js` 配置完整教程

这份教程解释正式展示页中 `config.js` 的全部配置。你只需要编辑 `normalizeConfig({ ... })` 里面的对象，不必修改动画组件源码。

## 快速开始

最小配置如下：

```js
import { normalizeConfig } from './src/config.js';

export const animationConfig = normalizeConfig({
  texts: [
    { text: '第一段文字', holdMs: 1800 },
    { text: '第二段文字\n可以手动换行', holdMs: 2200 }
  ],
  timing: {
    revealMs: 1200,
    retractMs: 1000,
    centerHoldMs: 1000
  },
  layout: {
    maxWidth: 680,
    fontSize: 64,
    x: '50%',
    y: '50%',
    autoWrap: true
  },
  motion: {
    singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)'
  }
});
```

修改后刷新正式预览页即可。若你在页面运行期间用 JavaScript 替换配置，可以给组件赋值：

```js
const animation = document.querySelector('orbit-text-reveal');
animation.config = animationConfig;
```

普通配置更新会等当前动画收回并回到圆心后安全生效；开发工具需要立即重播时，可以调用 `updateConfig(config, { immediate: true })`。

## 理解配置层级

配置分为六组：

```text
animationConfig
├── texts            每段文字，以及单条时间和布局覆盖
├── timing           全局展开、收回和圆心停留时间
├── layout           全局尺寸、换行、内部位置和缩放
├── style            颜色和字体
├── motion           整段缓动和字符缩放
└── accessibility    减少动态效果时的行为
```

`normalizeConfig()` 会完成三件事：

1. 补齐你没有填写的字段。
2. 把数值限制在安全范围内。
3. 丢弃空白或格式无效的文字条目。

本教程表格中的“默认值”来自 `src/config.js`。范围使用闭区间，例如 `0–20000` 表示最小可以写 `0`、最大可以写 `20000`。

## texts：文本队列与单条覆盖

`texts` 是一个数组，播放顺序就是数组顺序。数组数量不限，播放到最后一条后会回到第一条。

| 字段 | 默认值 | 接受值 | 作用 |
|---|---:|---|---|
| `texts` | 一条示例文字 | 对象数组 | 定义文字数量和播放顺序 |
| `text` | 无 | 非空字符串 | 实际显示的内容，真实换行符决定手动换行点 |
| `holdMs` | `timing.centerHoldMs` | `0–20000` ms | 当前文字完全展开后的停留时间 |
| `revealMs` | `timing.revealMs` | `0–20000` ms | 只覆盖当前文字的整段展开时间 |
| `retractMs` | `timing.retractMs` | `0–20000` ms | 只覆盖当前文字的整段收回时间 |
| `layout` | 使用全局布局 | 布局对象 | 只覆盖当前文字需要变化的布局字段 |

手动换行直接写 `\n`：

```js
texts: [
  { text: '这条保持单行', holdMs: 1600 },
  { text: '第一行\n第二行\n第三行', holdMs: 2400 }
]
```

字符串为空、只有空格，或者条目不是对象时，该条目会被移除。如果所有条目都无效，组件只显示位于中央的圆球，不会启动文字循环。

### 单条布局覆盖

每条文字的 `layout` 只能覆盖以下字段：`maxWidth`、`fontSize`、`lineHeight`、`ballSizeEm`、`ballGapEm`、`x`、`y`、`scale`、`autoWrap`。

```js
{
  text: '这一条更小，并放在偏左下的位置',
  holdMs: 2200,
  revealMs: 1500,
  retractMs: 1300,
  layout: {
    maxWidth: 480,
    fontSize: 48,
    x: '38%',
    y: '62%',
    scale: 0.9,
    autoWrap: false
  }
}
```

没有写进单条 `layout` 的字段继续使用全局值；不会把其他文字的覆盖带到这一条。

## timing：整段时间轴

| 字段 | 默认值 | 接受值 | 作用 |
|---|---:|---|---|
| `revealMs` | `900` | `0–20000` ms | 一段文字从圆心到完全展开的总时长 |
| `retractMs` | `900` | `0–20000` ms | 一段文字从完全展开到全部收回的总时长 |
| `centerHoldMs` | `1000` | `0–20000` ms | 圆球位于中央、下一次展开开始前的停留时间 |
| `lineTravelMs` | `260` | `0–20000` ms | 兼容字段（当前不驱动动画） |

现在的多行动画是一条全局时间轴：所有行的横向距离会相加，每行按自身像素距离占比分配时间。换行是瞬时跳转，不占用时间，也不会重新触发加速或减速。

```js
timing: {
  revealMs: 1600,    // 展开更慢
  retractMs: 1200,   // 收回略快
  centerHoldMs: 1000
}
```

把 `revealMs` 或 `retractMs` 写成 `0` 会立即完成相应阶段，通常只适合静态展示或测试。

## layout：尺寸、换行与位置

| 字段 | 默认值 | 接受值/范围 | 作用 |
|---|---:|---|---|
| `maxWidth` | `680` | `120–2400` px | 单行允许的最大文字宽度 |
| `fontSize` | `64` | `12–240` px | 基础字号 |
| `lineHeight` | `1.16` | `0.8–2` | 行高相对字号的倍率 |
| `ballSizeEm` | `0.78` | `0.2–2` em | 圆球直径相对字号的倍率 |
| `ballGapEm` | `0.08` | 自定义值会限制为 `0.2–2` em | 圆球与文字边缘之间的距离 |
| `x` | `'50%'` | 百分比或像素字符串 | 动画内部圆心的水平位置 |
| `y` | `'50%'` | 百分比或像素字符串 | 动画内部圆心的垂直位置 |
| `scale` | `1` | `0.25–4` | 文字、圆球和间距的整体倍率 |
| `autoWrap` | `true` | `true` / `false` | 是否允许组件自动增加换行 |

### 换行规则

- `autoWrap: true`：先尊重手动换行，再把仍然过宽的行自动拆分。
- `autoWrap: false`：只服从 `text` 中的真实换行符；过宽时组件会尝试整体缩小以适应舞台。
- 中文通常按字素换行；英文优先在空格或连字符处换行。
- Emoji 组合不会从中间拆开。

```js
layout: {
  maxWidth: 520,
  autoWrap: true
}
```

### 内部位置

`x`、`y` 接受百分比或像素字符串：

```js
layout: {
  x: '35%',
  y: '60%'
}

// 也可以使用像素
layout: {
  x: '320px',
  y: '180px'
}
```

这里控制的是组件内部动画中心，不是组件在整个网页中的位置。若字符串无法解析，组件会回退到对应方向的中央。

### 尺寸之间的关系

`fontSize` 决定基础字号；`ballSizeEm` 和 `ballGapEm` 随字号变化；`scale` 最后整体缩放这套几何。组件还会根据实际容器宽高进行自动拟合，因此极窄或极矮的容器中，最终显示尺寸可能小于配置值。

注意：当前默认 `ballGapEm` 是 `0.08`，但显式填写的自定义值会经过 `0.2–2` 的范围限制。若你希望稳定可预测地自定义间距，建议从 `0.2` 开始调整。

## style：颜色与字体

| 字段 | 默认值 | 接受值/范围 | 作用 |
|---|---:|---|---|
| `textColor` | `#111111` | CSS 颜色字符串 | 文字颜色 |
| `ballColor` | `#111111` | CSS 颜色字符串 | 圆球颜色 |
| `background` | `#ecebe8` | CSS 颜色字符串 | 组件舞台背景 |
| `fontFamily` | 系统无衬线字体栈 | CSS 字体族字符串 | 文字字体及回退顺序 |
| `fontWeight` | `700` | `100–900` | 字重 |

```js
style: {
  textColor: '#172033',
  ballColor: '#ef5b35',
  background: '#f3f1eb',
  fontFamily: '"Noto Sans SC", sans-serif',
  fontWeight: 800
}
```

字体会影响实际测量宽度和自动换行。自定义网络字体时，应确保字体加载完成后再启动组件；正式页已经等待 `document.fonts.ready`。

### CSS 覆盖优先级

组件宿主上的 CSS 自定义属性会覆盖 `config.js` 中的对应视觉值：

```css
orbit-text-reveal {
  --orbit-font-family: "Noto Sans SC", sans-serif;
  --orbit-font-size: 56px;
  --orbit-font-weight: 800;
  --orbit-text-color: #172033;
  --orbit-ball-color: #ef5b35;
  --orbit-ball-size: 0.72em;
  --orbit-ball-gap: 0.2em;
  --orbit-background: #f3f1eb;
}
```

因此“修改了 `config.js` 但页面颜色或字号没变”时，应先检查这些 CSS 变量。

## motion：缓动与字符形变

| 字段 | 默认值 | 接受值/范围 | 作用 |
|---|---:|---|---|
| `singleLineEasing` | `cubic-bezier(0.333333, 0, 0.666667, 1)` | 浏览器支持的 CSS easing 字符串 | 当前真正生效的整段时间轴缓动 |
| `characterMinScale` | `0.08` | `0.01–1` | 字符刚接触圆球遮罩时的最小比例 |
| `enableCharacterScale` | `true` | `true` / `false` | 是否启用接触圆球时的字符缩放 |
| `characterScale` | `1.12` | `0.7–1.5` | 保留字段；当前运行时不读取 |

虽然字段名称仍叫 `singleLineEasing`，它现在同时用于单行和多行的完整展开、完整收回。名称保留是为了兼容已有配置。

```js
motion: {
  singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)',
  characterMinScale: 0.08,
  enableCharacterScale: true
}
```

常用缓动：

```js
// 默认：整段慢起、慢停
'cubic-bezier(0.333333, 0, 0.666667, 1)'

// 更常见的 ease-in-out
'cubic-bezier(0.42, 0, 0.58, 1)'

// 完全匀速
'linear'
```

### 兼容字段（当前不驱动动画）

以下字段仍会被 `normalizeConfig()` 保留，旧配置不会报错，但当前全局时间轴不会读取它们：

- `easing`（完整路径：`motion.easing`）
- `lineEasing`（完整路径：`motion.lineEasing`）
- `continuationEasing`（完整路径：`motion.continuationEasing`）
- `exitEasing`（完整路径：`motion.exitEasing`）
- `lineTravelMs`（完整路径：`timing.lineTravelMs`）
- `characterScale`（完整路径：`motion.characterScale`）

不要用这些字段调整当前动画速度。速度由 `timing.revealMs`、`timing.retractMs` 和 `motion.singleLineEasing` 控制。

## accessibility：减少动态效果

| 字段 | 默认值 | 接受值 | 作用 |
|---|---:|---|---|
| `reducedMotionRotate` | `false` | `true` / `false` | 系统要求减少动态效果时，是否继续轮换文字 |

当用户系统启用了 `prefers-reduced-motion: reduce`：

- `reducedMotionRotate: false`：立即显示当前文字的完全展开状态，并停止轮换。
- `reducedMotionRotate: true`：不播放横向旅行，但按每条文字的 `holdMs` 继续切换完全展开的文本。

```js
accessibility: {
  reducedMotionRotate: false
}
```

## 完整配置示例

```js
import { normalizeConfig } from './src/config.js?v=20260711-5';

export const animationConfig = normalizeConfig({
  texts: [
    {
      text: '让想法自然展开',
      holdMs: 1800
    },
    {
      text: '第一行较长的文字\n第二行较短',
      holdMs: 2200,
      revealMs: 1400,
      retractMs: 1200,
      layout: {
        maxWidth: 560,
        fontSize: 56,
        x: '50%',
        y: '52%',
        autoWrap: false
      }
    }
  ],
  timing: {
    revealMs: 1100,
    retractMs: 1100,
    lineTravelMs: 260,
    centerHoldMs: 1000
  },
  layout: {
    maxWidth: 680,
    fontSize: 64,
    lineHeight: 1.16,
    ballSizeEm: 0.78,
    ballGapEm: 0.2,
    x: '50%',
    y: '50%',
    scale: 1,
    autoWrap: true
  },
  style: {
    textColor: '#111111',
    ballColor: '#111111',
    background: '#ecebe8',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: 700
  },
  motion: {
    singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)',
    characterMinScale: 0.08,
    enableCharacterScale: true
  },
  accessibility: {
    reducedMotionRotate: false
  }
});
```

示例没有重复写旧版缓动字段；省略它们不会影响当前动画。

## 平台入口配置

正式页另有独立的 `platformConfig` 数组，不属于 Orbit 动画配置：

```js
export const platformConfig = normalizePlatformConfig([
  {
    id: 'email',
    title: '邮箱',
    description: '复制邮箱地址，与我取得联系',
    icon: './assets/platforms/mail.svg',
    iconSide: 'left',
    action: { type: 'copy', value: 'mail@zhang.jx.cn', newTab: false }
  }
]);
```

字段说明：`id` 是稳定唯一标识；`title` 和 `description` 为非空显示文本；`icon` 可填写本地相对路径或图片 URL；`iconSide` 只能是 `left` 或 `right`；`action.type` 只能是 `link` 或 `copy`；`action.value` 是链接地址或待复制文本；`action.newTab` 仅对 `link` 生效，设为 `true` 时使用安全的新标签页打开。

开发者页“平台入口”区域会保留无效原始行并显示行内错误；无效行不会进入实时预览、复制内容或下载文件。平台导出使用独立的 `platform-config.json`，不会改变 Orbit 的 `orbit-text-config.json` 格式。

## 常用配方

### 更慢、更有展示感

```js
timing: {
  revealMs: 1800,
  retractMs: 1500,
  centerHoldMs: 1000
},
motion: {
  singleLineEasing: 'cubic-bezier(0.42, 0, 0.58, 1)'
}
```

### 快速轮播

```js
texts: [
  { text: '第一条', holdMs: 700 },
  { text: '第二条', holdMs: 700 }
],
timing: {
  revealMs: 500,
  retractMs: 500,
  centerHoldMs: 300
}
```

### 完全手动控制换行

```js
texts: [
  { text: '这里换行\n只在这里换行' }
],
layout: {
  maxWidth: 680,
  autoWrap: false
}
```

### 禁用字符接触缩放

```js
motion: {
  singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)',
  enableCharacterScale: false
}
```

### 每段文字使用不同位置和大小

```js
texts: [
  {
    text: '中央大字',
    layout: { x: '50%', y: '50%', fontSize: 72, scale: 1 }
  },
  {
    text: '左下角小字',
    layout: { x: '30%', y: '70%', fontSize: 42, scale: 0.85 }
  }
]
```

## 常见问题与排错

### 修改缓动后看起来完全没变化

确认修改的是 `motion.singleLineEasing`。`motion.easing`、`motion.continuationEasing`、`motion.exitEasing` 和 `motion.lineEasing` 都只是兼容字段。

### 修改 `lineTravelMs` 没有效果

这是正常的。换行现在是瞬时跳转，而且不占全局时间轴时长；`timing.lineTravelMs` 只为旧配置保留。

### 数值写得更小或更大，但实际没有继续变化

数值会被归一化到安全范围。例如 `fontSize: 5` 会变成 `12`，`scale: 10` 会变成 `4`，负数时间会变成 `0`。

### 文字没有出现

检查 `texts` 是否为数组，并确认每一项都有非空字符串 `text`。空字符串和只有空格的条目会被移除。

### 手动换行之外又出现了自动换行

将全局或单条 `layout.autoWrap` 设为 `false`。若手动行仍然超出容器，组件可能整体缩小内容以避免裁切。

### 修改颜色、字号或圆球尺寸后没有变化

检查宿主元素是否设置了 `--orbit-*` CSS 自定义属性；这些属性的优先级高于 `config.js`。

### 什么时候需要调用 `restart()`

- 直接替换 `animation.config` 时，组件会在安全边界自动应用，一般不需要手动重启。
- 使用开发者预览并希望立即生效时，调用 `updateConfig(config, { immediate: true })`。
- 主动修改字体、字号、圆球尺寸或间距的 CSS 变量后，调用 `restart()` 立即重新测量。
- 仅修改宿主元素的位置、旋转或外部 `transform` 时不需要重启。

### `config.js` 控制的是内部位置还是网页位置

`layout.x` 和 `layout.y` 控制组件内部中心。要移动整个组件，请在父页面用普通 CSS 设置宿主元素的 `position`、`left`、`top`、`width`、`height` 或 `transform`。

## 统一后台中的配置

Sites 版网页的 `/admin` 统一后台可以保存首屏文字与平台入口配置。首屏文字仍使用本文档描述的 Orbit JSON 结构；平台入口使用名称、简介、图标路径、图标方向和链接/复制动作结构。服务端保存前会再次调用标准化逻辑，避免无效数值或缺失字段直接破坏正式页。

数据库暂时不可用或尚无后台配置时，正式页会回退到根目录 `config.js` 中的 `animationConfig` 与 `platformConfig`。因此 `config.js` 仍是可独立运行的静态保底配置，`dev.html` 也继续用于组件级预览。

正式个人网页的响应式舞台由 `src/responsive-layout.js` 计算，并由 `src/intro-scroll.js` 写入 `--orbit-stage-width`。它只改变宿主可用宽度：桌面端从 `40vw` 起步，移动端封顶为 `77.7777778vw`，中间随视口宽高连续过渡。组件内部仍按照本指南的 `layout.maxWidth`、安全边距和自动拟合规则重新测量，因此不会改变展开、收回和精确回中的时间轴语义。

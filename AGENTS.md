# Orbit Text Reveal 项目指南

## 项目用途

这是一个零依赖、可嵌入普通网页的圆球文字展开组件。圆球从中央出发，沿文字行逐步揭示内容；停留后沿完全相反的路径收回，并精确返回中央。正式展示页与开发者配置页必须保持分离。

开始处理这个项目前，先完整阅读：

1. `README.md`：组件接口、快速使用和嵌入方式。
2. `CONFIG_GUIDE.md`：`config.js` 的全部配置字段、有效范围、示例和兼容性说明。

不要仅凭旧对话或记忆修改动画行为；以当前代码、上述文档和测试为准。

## 关键文件

- `index.html`：正式展示页。
- `dev.html`：开发者配置和实时预览页；不要把开发控件放进正式展示页。
- `config.js`：正式展示使用的配置。调整文字、播放顺序、时间、换行、样式、内部位置和比例时优先修改这里。
- `src/config.js`：默认配置、合法值范围与标准化逻辑。
- `src/orbit-text-reveal.js`：Web Component 和动画生命周期。
- `src/progressive-layout.js`：文字测量、换行、逐字显隐及多行路径布局。
- `styles/base.css`：演示页面样式；组件嵌入其他网页时不要求引入它。
- `tests/`：Node 合同测试和浏览器行为测试。

## 配置入口

### 文本与播放顺序

- `config.js` 中 `texts` 数组的顺序就是循环播放顺序，数量不限。
- 每项至少包含 `text`，并可单独设置 `holdMs`、`revealMs`、`retractMs` 和 `layout`。
- 字符串中的真实换行或 `\n` 用于指定换行位置。
- 并非每段文本都必须换行；单行和多行条目可以混合使用。
- `layout.autoWrap: true` 允许按 `layout.maxWidth` 自动换行；设为 `false` 时只服从手动换行。

### 时间轴

- `timing.revealMs`：一整段文字（包括全部行）的展开总时长。
- `timing.retractMs`：一整段文字（包括全部行）的收回总时长。
- `texts[].revealMs` 和 `texts[].retractMs`：单条文本的可选覆盖值。
- `texts[].holdMs`：该段完全展开后的停留时间。
- `timing.centerHoldMs`：圆球回到中央后的停留时间，默认行为为 1000ms。
- 当前横向运动由一条完整的多行总时间轴驱动：展开只在整段开头加速、整段末尾减速；收回也是整段开头加速、整段末尾减速。
- 换行跳转不占用时间，不得在每一行重新触发加速或减速。
- `motion.singleLineEasing` 是当前实际驱动整段展开和收回的缓动字段。
- `motion.easing`、`motion.lineEasing`、`motion.continuationEasing`、`motion.exitEasing` 和 `timing.lineTravelMs` 是兼容字段，不得误认为它们仍驱动当前总时间轴。

### 位置与大小

- `layout.x`、`layout.y`：动画中心在组件内部的位置。
- `layout.scale`：文字、圆球和间距的内部整体倍率。
- `layout.fontSize`、`layout.maxWidth`、`layout.lineHeight`：控制文字和换行几何。
- 将组件放入最终网页时，使用宿主页面的普通 CSS 控制整个 `<orbit-text-reveal>` 的 `position`、`left`、`top`、`width`、`height` 和 `transform`。
- 只改变宿主位置、旋转或外部缩放时，不应修改内部时间轴。
- 改变组件尺寸或字体几何后，应确保重新测量；组件的尺寸观察会安全排队重排，也可调用 `restart()` 立即重新测量。

## 不可破坏的动画语义

- 初始状态只有一个与字号协调的圆形图案，位于配置中心。
- 展开时圆球向右运动，文字从圆球遮罩后向左脱出。
- 展开完成时，文本头部和右侧圆球围绕配置中心对称。
- 多行文本按逐行蛇形路径展示；圆球跟随最下面的当前行。
- 字符刚脱出或进入圆球时允许局部缩放，以保持圆球的完整遮罩效果。
- 收回必须沿展开路径精确反向执行。
- 最后一个字符收回后，圆球必须精确回到配置中心，而不是停在文字起点或产生累计偏移。
- 文本配置和尺寸变化默认在当前文字收回并回中后安全应用；只有开发者实时预览可以明确使用 `updateConfig(config, { immediate: true })` 立即重播。
- 保留暂停、继续、重新开始、下一条、销毁、减少动态效果和尺寸变化处理能力。

## 组件接口

使用前导入：

```js
import './src/orbit-text-reveal.js';
```

页面元素：

```html
<orbit-text-reveal id="hero-copy"></orbit-text-reveal>
```

主要方法：

- `play()`
- `pause()`
- `restart()`
- `next()`
- `destroy()`
- `updateConfig(config, { immediate })`

主要事件：

- `orbit-state-change`
- `orbit-index-change`

## 本地运行与验证

启动预览：

```bash
npm run serve
```

固定地址：

- 正式展示页：`http://127.0.0.1:4173/index.html`
- 开发者页面：`http://127.0.0.1:4173/dev.html`
- 浏览器测试页：`http://127.0.0.1:4173/tests/browser.html`

修改后至少执行：

```bash
npm test
```

涉及动画、布局、配置或页面行为时，还必须打开浏览器测试页并确认全部断言通过，同时检查浏览器控制台没有错误或警告。提交前运行 `git diff --check`。

## 修改原则

- 优先扩展现有封装，不要把动画逻辑散落回演示页面。
- 保持正式展示页与开发者页面分离。
- 保持配置向后兼容；废弃字段可继续标准化，但不要让它们悄悄重新控制现有运动。
- 不要静默改变已经批准的动画语义、换行规则、时间含义或精确回中行为。
- 新增或改变配置字段时，同步更新 `README.md`、`CONFIG_GUIDE.md` 和相关测试。
- 修复动画问题时先复现并添加或更新回归测试，再修改实现。
- 完成声明必须以本次运行的新鲜测试结果为依据。


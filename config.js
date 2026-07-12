import { normalizeConfig } from './src/config.js?v=20260711-5';

export const animationConfig = normalizeConfig({
  // texts：按数组顺序循环；text 中写 \n 可指定手动换行。
  texts: [
    {
      text: '让想法自然展开',
      // holdMs：这段文字完全展开后停留多久，单位为毫秒。
      holdMs: 1800
    },
    {
      text: '光从这里出发\n再轻轻回到圆心',
      // holdMs：每段文字都可以设置不同的停留时长。
      holdMs: 2200
    },
    {
      text: '当一句话足够长时，它会在设定的最大宽度内自动换行，并保持自己的阅读节奏。',
      // holdMs：自动换行不会影响其他条目的停留时间或行数。
      holdMs: 2600
    }
  ],
  timing: {
    // revealMs / retractMs：完整多行路径的总时长，换行瞬移不占时间。
    revealMs: 900,
    retractMs: 900,
    lineTravelMs: 260,
    centerHoldMs: 1000
  },
  layout: {
    // maxWidth：单行文字允许的最大像素宽度，超过后才自动换行。
    maxWidth: 680,
    fontSize: 64,
    lineHeight: 1.16,
    ballSizeEm: 0.78,
    ballGapEm: 0.08,
    // x：动画中心在舞台内的水平位置；百分比或像素均可。
    x: '50%',
    // y：动画中心在舞台内的垂直位置；百分比或像素均可。
    y: '50%',
    // scale：文字、圆球和间距的整体倍率；1 为原始大小。
    scale: 1,
    // autoWrap：false 时只在你输入的换行符处换行。
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
    // singleLineEasing：展开和收回整段时间轴共同使用的加减速曲线。
    easing: 'cubic-bezier(0.333333, 0, 0.666667, 0.5)',
    lineEasing: 'cubic-bezier(0.76, 0, 0.24, 1)',
    continuationEasing: 'linear',
    exitEasing: 'cubic-bezier(0.333333, 0.5, 0.666667, 1)',
    singleLineEasing: 'cubic-bezier(0.333333, 0, 0.666667, 1)',
    characterScale: 1.12,
    characterMinScale: 0.08,
    enableCharacterScale: true
  },
  accessibility: {
    reducedMotionRotate: false
  }
});

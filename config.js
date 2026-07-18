import { normalizeConfig } from './src/config.js?v=20260711-5';

export const animationConfig = normalizeConfig({
  // texts：按数组顺序循环；text 中写 \n 可指定手动换行。
  texts: [
    {
      text: 'hello:)',
      holdMs: 1800
    },
    {
      text: '欢迎！',
      holdMs: 1800
    },
    {
      text: '粉骨碎身浑不怕\n要留清白在人间',
      holdMs: 2200
    },
    {
      text: '真的英雄：不是打败世界的傲慢，而是勇敢的守住内心的天真',
      holdMs: 2600
    },
    {
      text: '你来这里干嘛\\（≧▽≦）/',
      holdMs: 2000
    },
    {
      text: '（别光看屏幕啦！',
      holdMs: 1800
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
    textColor: '#000000',
    ballColor: '#000000',
    background: '#f7f2ef',
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

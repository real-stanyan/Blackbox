// Design tokens — light/dark 主题色 + 类型 + VERDICT 映射。
// 1:1 对照 prototype/kit.jsx TOKENS,字段名与 spec §4.1 一致。

export type Mode = 'light' | 'dark';

export interface Token {
  mode: Mode;
  bg: string;
  bgPlain: string;
  card: string;
  elevated: string;
  fill: string;
  fillStrong: string;
  label: string;
  label2: string;
  label3: string;
  sep: string;
  blue: string;
  green: string;
  orange: string;
  red: string;
  amber: string;
  barBg: string;
  barBorder: string;
}

export const TOKENS: Record<Mode, Token> = {
  light: {
    mode: 'light',
    bg: '#F2F2F7',
    bgPlain: '#FFFFFF',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    fill: 'rgba(120,120,128,0.12)',
    fillStrong: 'rgba(120,120,128,0.20)',
    label: '#000000',
    label2: 'rgba(60,60,67,0.60)',
    label3: 'rgba(60,60,67,0.30)',
    sep: 'rgba(60,60,67,0.20)',
    blue: '#007AFF',
    green: '#34C759',
    orange: '#EA5B2A',
    red: '#FF3B30',
    amber: '#FF9500',
    barBg: 'rgba(249,249,249,0.80)',
    barBorder: 'rgba(60,60,67,0.20)',
  },
  dark: {
    mode: 'dark',
    bg: '#000000',
    bgPlain: '#000000',
    card: '#1C1C1E',
    elevated: '#2C2C2E',
    fill: 'rgba(120,120,128,0.24)',
    fillStrong: 'rgba(120,120,128,0.36)',
    label: '#FFFFFF',
    label2: 'rgba(235,235,245,0.60)',
    label3: 'rgba(235,235,245,0.30)',
    sep: 'rgba(84,84,88,0.60)',
    blue: '#0A84FF',
    green: '#30D158',
    orange: '#FF6A3D',
    red: '#FF453A',
    amber: '#FF9F0A',
    barBg: 'rgba(28,28,30,0.80)',
    barBorder: 'rgba(84,84,88,0.55)',
  },
};

// RN 自动用系统字体(iOS = SF Pro / PingFang SC),fontFamily 不传即默认。
// 这里保留常量供需要显式指定的位置(如 SVG <Text> 用)。
export const FONT = '-apple-system, "PingFang SC", system-ui';

export type Verdict = 'good' | 'watch' | 'inspect' | 'info';

// VERDICT: [中文标签, 对应 Token 上的 colorKey]
export const VERDICT: Record<Verdict, [string, 'green' | 'amber' | 'red' | 'blue']> = {
  good: ['良好', 'green'],
  watch: ['留意', 'amber'],
  inspect: ['建议检查', 'red'],
  info: ['提示', 'blue'],
};

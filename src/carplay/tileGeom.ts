// CarPlay 格子图的纯几何层 —— 不 import react/react-native,所以能在 node 里离线跑
// (scripts/test-carplay-tile.ts 用它生成 SVG 肉眼验收)。
//
// 输出是一串「图元」而不是 SVG 字符串或 RN 组件,因为同一份几何要喂两个渲染器:
//   tileSvg.ts        → SVG 字符串,离线验收用
//   TileSvgView.tsx   → react-native-svg 组件树,真机 toDataURL() 出 PNG 用
// 只要几何只有一份,两条路就不会画出不一样的图。
//
// 越界分段不重写:直接复用 tripChartGeom 的 buildTripChartLayout —— 跨阈值插值
// 补点那段是最容易错的,已经在行程图上验过。
import { buildTripChartLayout } from '../components/tripChartGeom';
import { isOutOfBand, type ChannelBand } from '../analysis/bands';
import type { SeriesPoint } from '../data/types';
import { TOKENS } from '../styles/tokens';
import { bandForChannel, headroom, type CarPlayChannel } from './channels';

const T = TOKENS.dark;

export type TilePrim =
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: string }
  | { k: 'poly'; points: string; stroke: string; sw: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string; sw?: number }
  | {
      k: 'text';
      x: number;
      y: number;
      text: string;
      fill: string;
      size: number;
      weight: '400' | '600';
      anchor: 'start' | 'middle' | 'end';
    };

export interface TileLayout {
  size: number;
  /** 3 = 阈值行 + 数值 + 图 + 峰值余量行;2 = 去掉峰值余量行;1 = 只留数值 + 图。 */
  tier: 1 | 2 | 3;
  prims: TilePrim[];
}

export interface TileInput {
  channel: CarPlayChannel;
  /** 该通道的时间序列(t 相对行程起点的 ms)。少于 2 点画不出曲线,只画数值。 */
  samples: SeriesPoint[];
  /** 当前值。undefined = 车型不提供该 PID / 还没收到样本。 */
  value: number | undefined;
  /** 本次行程该通道的峰值(口径见 channels.peakMetric)。-Infinity = 还没有。 */
  peak: number;
  /** 格子边长(px)。真机上限是运行时的 CPGridTemplate.maximumGridButtonImageSize。 */
  size: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 状态色。无阈值的通道不判色(灰),别让读者以为灰=正常。 */
export function statusColor(v: number | undefined, band: ChannelBand | undefined): string {
  if (v === undefined || !band) return T.label3;
  if (isOutOfBand(v, band)) return T.red;
  // 逼近上限(≤8% 余量)先转琥珀 —— 行车中要的是提前量,不是越界才报。
  if (band.max !== null && v > band.max * 0.92) return T.amber;
  return T.green;
}

const fmt = (v: number | undefined, dec: number) => (v === undefined ? '—' : v.toFixed(dec));

/**
 * 数字串的近似宽度(px)。SVG 几何层量不到真实文本宽度,只能按字形估。
 * 分档而不是一刀切:tabular 数字 ≈ 0.58em,负号 ≈ 0.35em,小数点 ≈ 0.28em。
 */
function estWidth(s: string, size: number): number {
  let em = 0;
  for (const ch2 of s) {
    if (ch2 === '.') em += 0.28;
    else if (ch2 === '-' || ch2 === '−') em += 0.35;
    else if (ch2 === '—') em += 1;
    else em += 0.58;
  }
  return em * size;
}

/** 阈值文案。给 tier≥2 的顶行用。 */
export function bandLabel(band: ChannelBand | undefined): string {
  if (!band) return '无阈值';
  if (band.min === null) return `≤ ${band.max}`;
  if (band.max === null) return `≥ ${band.min}`;
  return band.max === -band.min ? `± ${band.max}` : `${band.min} ~ ${band.max}`;
}

export function buildTileLayout(input: TileInput): TileLayout {
  const { channel: c, samples, value, peak, size: S } = input;
  const band = bandForChannel(c);
  const col = statusColor(value, band);
  const tier: 1 | 2 | 3 = S >= 200 ? 3 : S >= 150 ? 2 : 1;
  const prims: TilePrim[] = [];

  // 背板 + 左侧状态色竖条。整块染色在行车中会一片红晃眼,所以只染一条边。
  prims.push({ k: 'rect', x: 0, y: 0, w: S, h: S, r: r2(S * 0.09), fill: 'rgba(255,255,255,0.055)' });
  prims.push({ k: 'rect', x: 0, y: r2(S * 0.14), w: 3, h: r2(S * 0.72), r: 1.5, fill: col });

  const pad = S * 0.085;
  let y = pad;

  // 1) 阈值 + 状态点。通道名不画 —— 系统已经在格子下面渲染 title,
  //    重复一遍等于白占一行(这是本设计相对「一格一指标」的密度增量)。
  if (tier >= 2) {
    const fs = Math.round(S * 0.082);
    prims.push({
      k: 'text',
      x: r2(pad + 5),
      y: r2(y + fs),
      text: bandLabel(band),
      fill: T.label2,
      size: fs,
      weight: '400',
      anchor: 'start',
    });
    prims.push({ k: 'circle', cx: r2(S - pad), cy: r2(y + S * 0.042), r: r2(S * 0.028), fill: col });
    y += S * 0.135;
  }

  // 2) 大数值 + 单位
  const vs = Math.round(S * (tier >= 2 ? 0.235 : 0.28));
  const us = Math.round(S * 0.082);
  const baseline = r2(y + vs * 0.86);
  const txt = fmt(value, c.dec);
  prims.push({
    k: 'text',
    x: r2(pad + 5),
    y: baseline,
    text: txt,
    fill: T.label,
    size: vs,
    weight: '600',
    anchor: 'start',
  });
  // 单位贴在数值右侧。SVG 里量不到真实文本宽度,只能按字形估 —— 但不能一律按数字
  // 宽度算:「-4.0」里负号和小数点都窄得多,按 0.6em 一刀切会把单位推出去老远。
  prims.push({
    k: 'text',
    x: r2(pad + 7 + estWidth(txt, vs)),
    y: baseline,
    text: c.unit,
    fill: T.label2,
    size: us,
    weight: '400',
    anchor: 'start',
  });
  y += vs * 1.06;

  // 3) 图区
  const chartH = S * (tier >= 3 ? 0.3 : tier === 2 ? 0.34 : 0.4);
  const chartX = pad + 5;
  const chartW = S - pad * 2 - 5;
  if (c.mode === 'bar') {
    prims.push(...barPrims(value, band, chartX, y, chartW, chartH, col));
  } else {
    prims.push(...sparkPrims(samples, band, S, chartX, y, chartW, chartH));
  }
  y += chartH;

  // 4) 峰值 + 余量。只有大格子放得下 —— 读不到的信息等于没有。
  if (tier >= 3) {
    const fs = Math.round(S * 0.072);
    const fy = r2(S - pad * 0.7);
    prims.push({
      k: 'text',
      x: r2(pad + 5),
      y: fy,
      text: isFinite(peak) ? `峰 ${peak.toFixed(c.dec)}` : '峰 —',
      fill: T.label2,
      size: fs,
      weight: '400',
      anchor: 'start',
    });
    const head = value === undefined ? null : headroom(value, band);
    prims.push({
      k: 'text',
      x: r2(S - pad),
      y: fy,
      text: head === null ? '—' : `余 ${head.toFixed(c.dec)}`,
      fill: head !== null && head < 0 ? T.red : T.label2,
      size: fs,
      weight: '400',
      anchor: 'end',
    });
  }

  return { size: S, tier, prims };
}

/**
 * 走势图。坐标系直接交给 buildTripChartLayout —— 把 pad 设成格子内的绝对偏移,
 * 它返回的坐标就已经是格子绝对坐标,不用再平移(平移得重新解析 polyline 字符串)。
 */
function sparkPrims(
  samples: SeriesPoint[],
  band: ChannelBand | undefined,
  S: number,
  x: number,
  yTop: number,
  w: number,
  h: number,
): TilePrim[] {
  const out: TilePrim[] = [];
  const L = buildTripChartLayout(samples, band, {
    w: S,
    h: S,
    padL: x,
    padR: S - x - w,
    padT: yTop,
    padB: S - yTop - h,
    headroom: 0.06,
    // 格子只有 120–240px:轴按数据缩放,不把阈值拉进视野(理由见 LayoutOpts 注释)
    includeBandInAxis: false,
  });

  if (!L) {
    // 少于 2 点:只铺底,不画线。空图比一条假线好。
    out.push({ k: 'rect', x: r2(x), y: r2(yTop), w: r2(w), h: r2(h), fill: 'rgba(255,255,255,0.04)' });
    return out;
  }

  if (L.normalRect) {
    // ChartRect 用 width/height,TilePrim 用 w/h —— 不能直接 spread
    const n = L.normalRect;
    out.push({ k: 'rect', x: n.x, y: n.y, w: n.width, h: n.height, fill: 'rgba(48,209,88,0.15)' });
  } else {
    out.push({ k: 'rect', x: r2(x), y: r2(yTop), w: r2(w), h: r2(h), fill: 'rgba(255,255,255,0.04)' });
  }

  const sw = Math.max(1.4, h * 0.055);
  out.push({ k: 'poly', points: L.linePoints, stroke: 'rgba(255,255,255,0.86)', sw });
  // 越界段盖在白线之上转红
  for (const run of L.outRuns) {
    if (run.points) out.push({ k: 'poly', points: run.points, stroke: T.red, sw });
    else if (run.dot) out.push({ k: 'circle', cx: run.dot.cx, cy: run.dot.cy, r: r2(sw), fill: T.red });
  }

  const lastV = samples[samples.length - 1].v;
  out.push({
    k: 'circle',
    cx: L.lastDot.cx,
    cy: L.lastDot.cy,
    r: r2(Math.max(1.6, h * 0.075)),
    fill: band && isOutOfBand(lastV, band) ? T.red : T.label,
  });
  return out;
}

/** 聚合格子的一行:左标签右值。 */
export interface AggRow {
  label: string;
  value: string;
  /** 值的着色。省略 = 白。 */
  tone?: 'green' | 'amber' | 'red';
}

/**
 * 聚合格子(行程概要 / 告警)—— 4 行 key-value。
 *
 * 存在的理由:6 个通道占 6 格,Grid 上限 8 格,剩两格不放东西是浪费。
 * 一格 4 个字段,比再挤一个通道进去信息量高。
 */
export function buildAggTileLayout(rows: AggRow[], accent: string, S: number): TileLayout {
  const prims: TilePrim[] = [];
  prims.push({ k: 'rect', x: 0, y: 0, w: S, h: S, r: r2(S * 0.09), fill: 'rgba(255,255,255,0.055)' });
  prims.push({ k: 'rect', x: 0, y: r2(S * 0.14), w: 3, h: r2(S * 0.72), r: 1.5, fill: accent });

  const pad = S * 0.085;
  const n = Math.max(1, rows.length);
  const step = (S - pad * 2) / (n + 0.2);
  const ls = Math.round(S * 0.082);
  const vsz = Math.round(S * 0.098);
  const TONE = { green: T.green, amber: T.amber, red: T.red } as const;

  rows.slice(0, 4).forEach((row, i) => {
    const yc = pad + step * 0.7 + i * step;
    prims.push({
      k: 'text', x: r2(pad + 5), y: r2(yc + ls * 0.36), text: row.label,
      fill: T.label2, size: ls, weight: '400', anchor: 'start',
    });
    prims.push({
      k: 'text', x: r2(S - pad), y: r2(yc + vsz * 0.36), text: row.value,
      fill: row.tone ? TONE[row.tone] : T.label, size: vsz, weight: '600', anchor: 'end',
    });
  });

  return { size: S, tier: 3, prims };
}

/** 区间条:回答「离阈值边还有多远」。量程按阈值外扩 50%,保证越界也画得进去。 */
function barPrims(
  v: number | undefined,
  band: ChannelBand | undefined,
  x: number,
  yTop: number,
  w: number,
  h: number,
  col: string,
): TilePrim[] {
  const out: TilePrim[] = [];
  const lo = band?.min != null ? band.min * 1.5 : 0;
  const hi = band?.max != null ? band.max * 1.5 : 1;
  const px = (t: number) => r2(x + Math.max(0, Math.min(1, (t - lo) / (hi - lo))) * w);
  const cy = yTop + h * 0.46;
  const bh = Math.max(7, h * 0.34);

  out.push({ k: 'rect', x: r2(x), y: r2(cy - bh / 2), w: r2(w), h: r2(bh), fill: 'rgba(255,255,255,0.13)' });
  if (band) {
    const a = band.min != null ? px(band.min) : x;
    const b = band.max != null ? px(band.max) : x + w;
    out.push({ k: 'rect', x: r2(a), y: r2(cy - bh / 2), w: r2(b - a), h: r2(bh), fill: 'rgba(48,209,88,0.34)' });
  }
  // 零位刻度(±类通道)
  if (lo < 0 && hi > 0) {
    out.push({ k: 'rect', x: px(0) - 0.5, y: r2(cy - bh / 2 - 3), w: 1, h: r2(bh + 6), fill: T.label3 });
  }
  if (v !== undefined) {
    out.push({ k: 'circle', cx: px(v), cy: r2(cy), r: r2(bh * 0.52), fill: col, stroke: '#000', sw: 1.4 });
  }
  return out;
}

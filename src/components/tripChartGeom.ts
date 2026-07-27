// TripChart 的纯几何层 —— 不 import react/react-native,所以能在 node 里离线跑
// (scripts/test-trip-chart.ts 用它生成 SVG 肉眼验收)。
// 拆出来的动机:图表最容易错的是坐标与越界分段,而这部分本来是可判定的纯函数。
import { isOutOfBand, type ChannelBand } from '../analysis/bands';
import type { SeriesPoint } from '../data/types';

export interface ChartRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartEdge {
  /** 阈值数值(画在右侧的标签)。 */
  v: number;
  y: number;
}

export interface OutRun {
  /** ≥2 点时的 polyline 字符串;单点段为 null。 */
  points: string | null;
  /** 单点段的圆心。 */
  dot: { cx: number; cy: number } | null;
}

export interface TripChartLayout {
  w: number;
  h: number;
  plot: ChartRect;
  /** 正常区间(淡绿)。无 band 时为 null。 */
  normalRect: ChartRect | null;
  /** 上界之上 / 下界之下的异常区(淡红);贴边时高度为 0 则给 null。 */
  aboveRect: ChartRect | null;
  belowRect: ChartRect | null;
  edges: ChartEdge[];
  linePoints: string;
  outRuns: OutRun[];
  lastDot: { cx: number; cy: number };
  durMin: number;
}

export interface LayoutOpts {
  w?: number;
  h?: number;
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
  /** y 轴上下各留的余量比例。 */
  headroom?: number;
  /**
   * 是否把阈值强行拉进 y 轴视野。默认 true —— 行程大图上必须这样,
   * 否则「正常带」画不出来、读者判断不了离限值多远。
   *
   * CarPlay 格子图传 false:格子只有 120–240px,把 ≤115 拉进视野会让 25–90 的
   * 数据挤成底部一条线,曲线形状读不出来。而格子里阈值已经用文字(`≤ 115`)和
   * 余量(`余 42`)表达了,图的职责只是近况形状 —— 越界仍会转红(判据是数值不是轴)。
   */
  includeBandInAxis?: boolean;
}

interface AugPt extends SeriesPoint {
  out: boolean;
  edge: boolean;
}

/**
 * 把曲线切成「超出正常区间」的连续段,并在跨越边界处插值补点——不插值的话红段会
 * 从第一个越界采样点才开始,视觉上比实际越界区间短一截。
 */
export function outOfBandRuns(points: SeriesPoint[], band: ChannelBand): SeriesPoint[][] {
  const bounds = [band.min, band.max].filter((b): b is number => b !== null);
  const aug: AugPt[] = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      const crossings: SeriesPoint[] = [];
      for (const b of bounds) {
        if ((prev.v < b && cur.v > b) || (prev.v > b && cur.v < b)) {
          const r = (b - prev.v) / (cur.v - prev.v);
          crossings.push({ t: prev.t + r * (cur.t - prev.t), v: b });
        }
      }
      crossings.sort((a, z) => a.t - z.t);
      for (const c of crossings) aug.push({ ...c, out: false, edge: true });
    }
    aug.push({ t: cur.t, v: cur.v, out: isOutOfBand(cur.v, band), edge: false });
  }

  const runs: SeriesPoint[][] = [];
  let i = 0;
  while (i < aug.length) {
    if (!aug[i].out) {
      i++;
      continue;
    }
    const run: AugPt[] = [];
    if (i > 0 && aug[i - 1].edge) run.push(aug[i - 1]);
    while (i < aug.length && aug[i].out) run.push(aug[i++]);
    if (i < aug.length && aug[i].edge) run.push(aug[i]);
    runs.push(run.map((p) => ({ t: p.t, v: p.v })));
  }
  return runs;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 阈值外侧至少留这么多(占数据幅度的比例),保证异常区有可见厚度。 */
const EDGE_HEADROOM = 0.18;

/** points.length < 2 时返回 null(一个点画不出曲线)。 */
export function buildTripChartLayout(
  points: SeriesPoint[],
  band: ChannelBand | undefined,
  opts: LayoutOpts = {},
): TripChartLayout | null {
  if (points.length < 2) return null;
  const {
    w = 320, h = 118, padL = 4, padR = 40, padT = 8, padB = 15, headroom = 0.08,
    includeBandInAxis = true,
  } = opts;
  /** 只在 includeBandInAxis 时参与轴计算的阈值。 */
  const axisBand = includeBandInAxis ? band : undefined;

  const plot: ChartRect = { x: padL, y: padT, width: w - padL - padR, height: h - padT - padB };

  const values = points.map((p) => p.v);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  // 阈值必须进视野,否则「正常带」画不出来,读者也判断不了离限值多远。
  if (axisBand?.min != null) lo = Math.min(lo, axisBand.min);
  if (axisBand?.max != null) hi = Math.max(hi, axisBand.max);
  const raw = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
  lo -= raw * headroom;
  hi += raw * headroom;
  // 阈值那一侧额外留白:否则数据没越界时(如水温峰值 108 < 上限 115)红色异常区
  // 只剩一两像素,「哪里算异常」根本看不出来。
  if (axisBand?.max != null) hi = Math.max(hi, axisBand.max + raw * EDGE_HEADROOM);
  if (axisBand?.min != null) lo = Math.min(lo, axisBand.min - raw * EDGE_HEADROOM);
  const span = hi - lo;

  const t0 = points[0].t;
  const tSpan = points[points.length - 1].t - t0 || 1;
  const x = (ms: number) => r2(plot.x + ((ms - t0) / tSpan) * plot.width);
  const y = (v: number) => r2(plot.y + (1 - (v - lo) / span) * plot.height);
  const clampY = (v: number) => Math.max(plot.y, Math.min(plot.y + plot.height, y(v)));

  const topEdgeY = band?.max != null ? clampY(band.max) : plot.y;
  const botEdgeY = band?.min != null ? clampY(band.min) : plot.y + plot.height;

  const rect = (y0: number, y1: number): ChartRect | null =>
    y1 - y0 > 0.5 ? { x: plot.x, y: r2(y0), width: plot.width, height: r2(y1 - y0) } : null;

  const edges: ChartEdge[] = [];
  if (band?.max != null) edges.push({ v: band.max, y: clampY(band.max) });
  if (band?.min != null) edges.push({ v: band.min, y: clampY(band.min) });

  const runs = band ? outOfBandRuns(points, band) : [];
  const last = points[points.length - 1];

  return {
    w,
    h,
    plot,
    normalRect: band ? rect(topEdgeY, botEdgeY) : null,
    aboveRect: band?.max != null ? rect(plot.y, topEdgeY) : null,
    belowRect: band?.min != null ? rect(botEdgeY, plot.y + plot.height) : null,
    edges,
    linePoints: points.map((p) => `${x(p.t)},${y(p.v)}`).join(' '),
    outRuns: runs.map((run) =>
      run.length >= 2
        ? { points: run.map((p) => `${x(p.t)},${y(p.v)}`).join(' '), dot: null }
        : { points: null, dot: { cx: x(run[0].t), cy: y(run[0].v) } },
    ),
    lastDot: { cx: x(last.t), cy: y(last.v) },
    durMin: Math.round(tSpan / 60000),
  };
}

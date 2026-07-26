// 8 个格子的模型层 —— 从实时状态算出每格画什么。纯函数、不 import react/react-native。
//
// 格子分配(吃满 CPGridTemplateMaximumItems = 8):
//   0..5  6 个通道(CARPLAY_CHANNELS 的顺序)
//   6     本次行程概要 —— 4 个字段
//   7     告警 —— 4 个字段
import { TOKENS, VERDICT, type Verdict } from '../styles/tokens';
import { isOutOfBand } from '../analysis/bands';
import type { SeriesPoint } from '../data/types';
import { CARPLAY_CHANNELS, bandForChannel, peakMetric } from './channels';
import { buildAggTileLayout, buildTileLayout, type AggRow, type TileLayout } from './tileGeom';

const T = TOKENS.dark;

/** 滚动窗口:CarPlay 只看近况,不需要全程。72 点 @1Hz ≈ 近 72 秒。 */
export const WINDOW_POINTS = 72;

export interface RollingStore {
  /** UI key → 近 WINDOW_POINTS 个点 */
  series: Record<string, SeriesPoint[]>;
  /** UI key → 本次行程峰值(口径见 channels.peakMetric) */
  peaks: Record<string, number>;
}

export const emptyStore = (): RollingStore => ({ series: {}, peaks: {} });

/**
 * 推一批新读数进滚动窗口。就地改 store —— 每秒调一次,复制整个窗口没必要。
 * 返回 store 本身,方便链式调用。
 */
export function pushSamples(
  store: RollingStore,
  values: Record<string, number>,
  tMs: number,
): RollingStore {
  for (const c of CARPLAY_CHANNELS) {
    const v = values[c.key];
    if (v === undefined || !isFinite(v)) continue;
    const arr = (store.series[c.key] ??= []);
    arr.push({ t: tMs, v });
    if (arr.length > WINDOW_POINTS) arr.shift();
    const m = peakMetric(v, bandForChannel(c));
    const prev = store.peaks[c.key];
    if (prev === undefined || m > prev) store.peaks[c.key] = m;
  }
  return store;
}

export interface TripSummary {
  elapsedSec: number;
  distanceKm: number;
  /** 冷启动 —— 与 TripMetrics.cold 同义。 */
  cold: boolean;
  samples: number;
  verdict: Verdict;
}

export interface DashboardTile {
  /** 系统渲染在格子下方的 title。通道名放这里,所以格子图里不再画一遍。 */
  title: string;
  layout: TileLayout;
}

export interface DashboardInput {
  values: Record<string, number>;
  store: RollingStore;
  trip: TripSummary;
  size: number;
}

/** 越界通道数 —— 告警格子用。只数有可辩护阈值的通道。 */
export function outOfBandChannels(values: Record<string, number>): string[] {
  return CARPLAY_CHANNELS.filter((c) => {
    const v = values[c.key];
    const band = bandForChannel(c);
    return v !== undefined && band !== undefined && isOutOfBand(v, band);
  }).map((c) => c.label);
}

const mmss = (sec: number) => `${Math.floor(sec / 60)} min`;

export function buildDashboard(input: DashboardInput): DashboardTile[] {
  const { values, store, trip, size } = input;

  const tiles: DashboardTile[] = CARPLAY_CHANNELS.map((c) => ({
    title: c.label,
    layout: buildTileLayout({
      channel: c,
      samples: store.series[c.key] ?? [],
      value: values[c.key],
      peak: store.peaks[c.key] ?? -Infinity,
      size,
    }),
  }));

  const [verdictLabel, verdictColorKey] = VERDICT[trip.verdict];
  const tripRows: AggRow[] = [
    { label: '时长', value: mmss(trip.elapsedSec) },
    { label: '里程', value: `${trip.distanceKm.toFixed(1)} km` },
    { label: '冷启动', value: trip.cold ? '是' : '否' },
    { label: '采样', value: String(trip.samples) },
  ];
  tiles.push({
    title: '本次行程',
    layout: buildAggTileLayout(tripRows, T[verdictColorKey], size),
  });

  const out = outOfBandChannels(values);
  const alertRows: AggRow[] = [
    {
      label: '越界通道',
      value: String(out.length),
      tone: out.length > 0 ? 'red' : 'green',
    },
    { label: '最近', value: out[0] ?? '—' },
    { label: '结论', value: verdictLabel, tone: verdictColorKey === 'blue' ? undefined : verdictColorKey },
    { label: '窗口', value: `${WINDOW_POINTS} s` },
  ];
  tiles.push({
    title: '告警',
    layout: buildAggTileLayout(alertRows, out.length > 0 ? T.red : T.green, size),
  });

  return tiles;
}

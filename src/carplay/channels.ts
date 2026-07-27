// CarPlay 仪表盘的通道清单 —— 决定 8 个格子分别画什么。
//
// 为什么是 8 个:CPGridTemplateMaximumItems = 8(iOS 26),第 9 个之后的按钮被系统
// 直接忽略。本项目 6 个通道 + 行程概要 + 告警 = 正好吃满,不用分页。
//
// 为什么不用 InformationTemplate:它只支持 1–4 行(库 README 明确写的),
// 6 个通道放不下,而且不接受图片 —— 一张图都画不了(ADR-0006)。
//
// 纯数据、不 import react/react-native —— scripts/test-carplay-tile.ts 离线跑它。
import { bandFor, type ChannelBand } from '../analysis/bands';
import { UI_TO_PID } from '../data/channelKeys';

/** 格子里那张图怎么画。 */
export type TileMode =
  /** 走势图 + 正常区间绿带。给「趋势本身就是信息」的通道。 */
  | 'spark'
  /** 区间条 + 游标。给漂移以分钟计的通道 —— 画趋势线是浪费像素,
   *  真正要读的是「离阈值边还有多远」。 */
  | 'bar';

export interface CarPlayChannel {
  /** UI key(LiveSession.values 的键)。 */
  key: string;
  /** OBD PID key,查 bands.ts 用。 */
  pid: string;
  label: string;
  unit: string;
  /** 小数位。 */
  dec: number;
  mode: TileMode;
  /** 为什么选这个 mode —— 决策留在代码里,免得下一棒当成随手写的。 */
  why: string;
}

const ch = (
  key: string,
  label: string,
  unit: string,
  dec: number,
  mode: TileMode,
  why: string,
): CarPlayChannel => ({ key, pid: UI_TO_PID[key] ?? key, label, unit, dec, mode, why });

/** 顺序 = 格子顺序。有阈值的排前面 —— 行车中先看得到能判故障的。 */
export const CARPLAY_CHANNELS: CarPlayChannel[] = [
  ch('coolant', '水温', '°C', 0, 'spark', '暖机爬升曲线 + 峰值是否破 115'),
  ch('oil', '机油温度', '°C', 0, 'spark', '同水温,看爬升与峰值(车型不提供时格子留空)'),
  ch('stft', '短期燃油修正', '%', 1, 'spark', '尖峰有没有冲出 ±12 —— 尖峰就是全部信息'),
  ch('ltft', '长期燃油修正', '%', 1, 'bar', '漂移以分钟计,要读的是落在 ±8 的哪个位置'),
  ch('rpm', '转速', 'rpm', 0, 'spark', '无可辩护阈值,但趋势能看出换挡与拉高转'),
  ch('speed', '车速', 'km/h', 0, 'spark', '仪表盘本来就有,趋势用于对齐其他通道的时间轴'),
];

export const bandForChannel = (c: CarPlayChannel): ChannelBand | undefined => bandFor(c.pid);

/**
 * 余量 = 离最近一条阈值边还差多少。负值 = 已越界,越界多少。
 *
 * 双侧阈值不能只算上界:短期修正在 −3.1 时离 −12 只剩 8.9、离 +12 还有 15.1,
 * 报大的那个是误导。
 */
export function headroom(v: number, band: ChannelBand | undefined): number | null {
  if (!band) return null;
  const d: number[] = [];
  if (band.max !== null) d.push(band.max - v);
  if (band.min !== null) d.push(v - band.min);
  return d.length ? Math.min(...d) : null;
}

/**
 * 峰值口径:双侧阈值(±类)取最大绝对偏移,与 bands.ts 里 stftAbsP95 /
 * ltftAbsMean 用绝对值的口径一致;单侧阈值取最大值。
 */
export function peakMetric(v: number, band: ChannelBand | undefined): number {
  return band && band.min !== null ? Math.abs(v) : v;
}

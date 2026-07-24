// 数据类型单一来源。UI 展示型(原 mock.ts)+ 存储型(TripRecord)都在这。
import type { TripFeatures } from '../analysis/features';
import type { TripReport } from '../analysis/minimax';

export type Tone = 'good' | 'watch' | 'inspect' | 'info';

export interface Finding {
  tone: Tone;
  title: string;
  detail: string;
  action?: string;
}

export interface Vehicle {
  name: string;
  model: string;
  engine: string;
  plate: string;
  /** 里程基线(用户填)。展示 odo = odo + 累计行程里程。 */
  odo: number;
  adapter: string;
}

export interface LivePid {
  key: string;
  label: string;
  unit: string;
  idle: number | null;
  drive: number | null;
  jitter: number;
  note?: string;
}

/** UI 展示型行程 — 由 TripRecord 经 display.ts 派生,字段对齐原 mock。 */
export interface Trip {
  id: string;
  group: string;
  time: string;
  title: string;
  dur: number;
  dist: number;
  verdict: Tone;
  cold: boolean;
  maxCoolant: number;
  avgRpm: number;
  ltft: number;
  stft: number;
  samples: number;
  route?: string;
  summary: string;
  findings: Finding[];
  featured?: boolean;
  /** false = LLM 未分析(无 key/失败),TripDetail 显示重试。 */
  analyzed: boolean;
}

export interface Trend {
  label: string;
  unit: string;
  now: number;
  dir: 'up' | 'down' | 'flat';
  tone: Tone;
  note: string;
  series: number[];
  /** 横轴标签 — 真数据下是行程日期(M/D)或周序,不再限定"月"。 */
  months: string[];
}

export interface Outlook {
  score: number;
  verdictLabel: string;
  verdictTone: Tone;
  headline: string;
  current: Finding[];
  future: Finding[];
  normal: string[];
}

export interface SeriesPoint {
  t: number; // ms since trip start
  v: number;
}

export interface TripMetrics {
  /** ltft_b1 全程均值;车不给该 PID 时 null。 */
  ltftMean: number | null;
  /** 冷启动到 80°C 用时(分钟);非冷启动/没到 80 则 null。 */
  warmupMin: number | null;
  /** 怠速段(speed==0 且 rpm>300)rpm 均值;无怠速段 null。 */
  idleRpm: number | null;
  cold: boolean;
}

/** 存储型行程 — trips/<id>.json 的文件内容。 */
export interface TripRecord {
  id: string; // String(startedAt)
  startedAt: number; // epoch ms
  endedAt: number;
  durationMin: number;
  distanceKm: number;
  samples: number;
  metrics: TripMetrics;
  features: TripFeatures;
  /** 降采样曲线,每通道 ≤120 点,画图用。key = PID key(rpm/coolant_temp/…)。 */
  series: Record<string, SeriesPoint[]>;
  /** null = 未分析(无 key / 调用失败)。 */
  report: TripReport | null;
  verdict: Tone;
}

export interface TripIndexEntry {
  id: string;
  startedAt: number;
  durationMin: number;
  distanceKm: number;
  verdict: Tone;
  analyzed: boolean;
}

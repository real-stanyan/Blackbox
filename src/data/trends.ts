// 趋势 = 已存行程的本地聚合,纯函数。行程少时如实显示,不硬凑月份。
import { Trend, TripRecord } from './types';

export type TrendKey = 'ltft' | 'warmup' | 'idle' | 'cold';

const MAX_POINTS = 12;
const MAX_WEEKS = 8;

const label = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function emptyTrend(labelText: string, unit: string): Trend {
  return { label: labelText, unit, now: 0, dir: 'flat', tone: 'info', note: '数据积累中', series: [], months: [] };
}

function dirOf(series: number[], eps: number): 'up' | 'down' | 'flat' {
  if (series.length < 2) return 'flat';
  const d = series[series.length - 1] - series[series.length - 2];
  if (d > eps) return 'up';
  if (d < -eps) return 'down';
  return 'flat';
}

function perTrip(
  records: TripRecord[],
  labelText: string,
  unit: string,
  pick: (r: TripRecord) => number | null,
  tone: (now: number) => Trend['tone'],
  note: (now: number) => string,
  eps: number,
): Trend {
  const pts = records
    .map((r) => ({ t: r.startedAt, v: pick(r) }))
    .filter((p): p is { t: number; v: number } => p.v !== null)
    .sort((a, b) => a.t - b.t)
    .slice(-MAX_POINTS);
  if (pts.length < 2) return emptyTrend(labelText, unit);
  const series = pts.map((p) => round1(p.v));
  const now = series[series.length - 1];
  return {
    label: labelText, unit, now,
    dir: dirOf(series, eps),
    tone: tone(now), note: note(now),
    series, months: pts.map((p) => label(p.t)),
  };
}

export function buildTrends(records: TripRecord[], now: number = Date.now()): Record<TrendKey, Trend> {
  const ltft = perTrip(
    records, '长期燃油修正', '%',
    (r) => r.metrics.ltftMean,
    (v) => (Math.abs(v) >= 8 ? 'inspect' : Math.abs(v) >= 5 ? 'watch' : 'good'),
    (v) => (Math.abs(v) >= 5 ? '偏高,需留意变化' : '在正常范围内'),
    0.3,
  );
  const warmup = perTrip(
    records, '水温达工作温度用时', 'min',
    (r) => r.metrics.warmupMin,
    (v) => (v > 12 ? 'watch' : 'good'),
    (v) => (v > 12 ? '升温偏慢,留意节温器' : '升温正常,冷却系统健康'),
    0.5,
  );
  const idle = perTrip(
    records, '怠速转速', 'rpm',
    (r) => r.metrics.idleRpm,
    (v) => (v >= 600 && v <= 1000 ? 'good' : 'watch'),
    (v) => (v >= 600 && v <= 1000 ? '怠速平稳' : '怠速偏离常见区间'),
    30,
  );

  // 冷启动:按周计数,最近 MAX_WEEKS 周。周锚点 = now 所在周的周一 0 点。
  const nowD = new Date(now);
  const dayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
  const dow = (nowD.getDay() + 6) % 7; // 周一=0
  const thisMonday = dayStart - dow * 86_400_000;
  const counts: number[] = Array(MAX_WEEKS).fill(0);
  let seen = 0;
  for (const r of records) {
    const weeksAgo = Math.floor((thisMonday + 7 * 86_400_000 - 1 - r.startedAt) / (7 * 86_400_000));
    if (weeksAgo < 0 || weeksAgo >= MAX_WEEKS) continue;
    if (r.metrics.cold) counts[MAX_WEEKS - 1 - weeksAgo]++;
    seen++;
  }
  // 找到最早有行程的那周,只显示从那周起的区间
  const oldestWeek = records.length
    ? Math.min(MAX_WEEKS - 1, Math.floor((thisMonday + 7 * 86_400_000 - 1 - Math.min(...records.map((r) => r.startedAt))) / (7 * 86_400_000)))
    : -1;
  const cold: Trend =
    seen === 0 || oldestWeek < 1
      ? emptyTrend('每周冷启动次数', '次')
      : {
          label: '每周冷启动次数', unit: '次',
          now: counts[MAX_WEEKS - 1],
          dir: dirOf(counts.slice(MAX_WEEKS - 1 - oldestWeek), 0.5),
          tone: 'good', note: '冷启动频率,仅作参考',
          series: counts.slice(MAX_WEEKS - 1 - oldestWeek),
          months: counts.slice(MAX_WEEKS - 1 - oldestWeek).map((_, i, arr) =>
            i === arr.length - 1 ? '本周' : `${arr.length - 1 - i} 周前`,
          ),
        };

  return { ltft, warmup, idle, cold };
}

export function hasEnough(tr: Trend): boolean {
  return tr.series.length >= 2;
}

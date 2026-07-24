import { Trip, TripRecord } from './types';
import { reportToFindings } from '../analysis/verdict';

const pad = (n: number) => String(n).padStart(2, '0');

function titleForHour(h: number): string {
  if (h < 6) return '夜间行程';
  if (h < 9) return '清晨行程';
  if (h < 12) return '上午行程';
  if (h < 18) return '下午行程';
  if (h < 23) return '晚间行程';
  return '夜间行程';
}

function groupFor(startedAt: number, now: number): string {
  const d = new Date(startedAt);
  const n = new Date(now);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(n) - dayStart(d)) / 86_400_000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 存储型 → UI 展示型。无 GPS,route 不给;标题按时段生成,中性词。 */
export function tripToDisplay(r: TripRecord, now: number = Date.now()): Trip {
  const d = new Date(r.startedAt);
  const ch = (key: string) => r.features.channels.find((c) => c.key === key);
  return {
    id: r.id,
    group: groupFor(r.startedAt, now),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    title: titleForHour(d.getHours()),
    dur: Math.round(r.durationMin),
    dist: Math.round(r.distanceKm * 10) / 10,
    verdict: r.verdict,
    cold: r.metrics.cold,
    maxCoolant: ch('coolant_temp')?.max ?? 0,
    avgRpm: Math.round(ch('rpm')?.mean ?? 0),
    ltft: r.metrics.ltftMean ?? 0,
    stft: ch('stft_b1')?.mean ?? 0,
    samples: r.samples,
    summary: r.report?.summary ?? '本次行程尚未生成 AI 报告。',
    findings: r.report ? reportToFindings(r.report) : [],
    analyzed: r.report !== null,
  };
}

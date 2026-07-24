import { Sample } from '../obd/ElmSession';
import { SeriesPoint } from '../data/types';

/** 均匀抽点降采样,保首尾。画趋势小图够用,不需要 LTTB。 */
export function buildSeries(samples: Sample[], maxPointsPerChannel = 120): Record<string, SeriesPoint[]> {
  const byKey = new Map<string, SeriesPoint[]>();
  for (const s of samples) {
    const arr = byKey.get(s.key) ?? [];
    arr.push({ t: s.t, v: s.value });
    byKey.set(s.key, arr);
  }
  const out: Record<string, SeriesPoint[]> = {};
  for (const [key, pts] of byKey) {
    if (pts.length <= maxPointsPerChannel) {
      out[key] = pts;
      continue;
    }
    const step = (pts.length - 1) / (maxPointsPerChannel - 1);
    const picked: SeriesPoint[] = [];
    for (let i = 0; i < maxPointsPerChannel; i++) {
      picked.push(pts[Math.round(i * step)]);
    }
    out[key] = picked;
  }
  return out;
}

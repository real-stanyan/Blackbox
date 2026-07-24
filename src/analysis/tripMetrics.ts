import { Sample } from '../obd/ElmSession';
import { TripMetrics } from '../data/types';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** 行程级指标,存盘时算一次,趋势聚合直接读。纯函数。 */
export function computeMetrics(samples: Sample[]): TripMetrics {
  const coolant = samples.filter((s) => s.key === 'coolant_temp');
  const ltft = samples.filter((s) => s.key === 'ltft_b1');

  const cold = coolant.length > 0 && coolant[0].value < 60;

  let warmupMin: number | null = null;
  if (cold) {
    const hit = coolant.find((s) => s.value >= 80);
    if (hit) warmupMin = round1((hit.t - coolant[0].t) / 60000);
  }

  // 怠速段:同一时刻 speed==0 且 rpm>300(发动机在转)。样本不同 PID 不同时刻,
  // 用最近车速判定:按 t 归并,车速为 0 的窗口内的 rpm 算怠速。
  const speeds = samples.filter((s) => s.key === 'speed').sort((a, b) => a.t - b.t);
  const rpms = samples.filter((s) => s.key === 'rpm');
  const idleRpms: number[] = [];
  for (const r of rpms) {
    if (r.value <= 300) continue;
    // 找 r.t 之前最近的车速读数
    let last: Sample | null = null;
    for (const sp of speeds) {
      if (sp.t > r.t) break;
      last = sp;
    }
    if (last && last.value === 0) idleRpms.push(r.value);
  }

  return {
    ltftMean: ltft.length > 0 ? round1(mean(ltft.map((s) => s.value))) : null,
    warmupMin,
    idleRpm: idleRpms.length > 0 ? Math.round(mean(idleRpms)) : null,
    cold,
  };
}

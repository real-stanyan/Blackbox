import { Sample } from '../obd/ElmSession';
import { PIDS } from '../obd/pids';

export interface ChannelStats {
  key: string;
  name: string;
  unit: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  p95: number;
  first: number;
  last: number;
}

export interface RuleAlert {
  level: 'red' | 'yellow';
  text: string;
}

export interface TripFeatures {
  durationMin: number;
  totalSamples: number;
  channels: ChannelStats[];
  /** Deterministic local alerts — the LLM reads these but cannot change their level. */
  ruleAlerts: RuleAlert[];
  /** Seconds from trip start until coolant first reached 80°C, if it started below 60. */
  warmupToleranceSec: number | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure, deterministic feature extraction — no LLM involvement. */
export function extractFeatures(samples: Sample[]): TripFeatures {
  const byKey = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = byKey.get(s.key) ?? [];
    arr.push(s);
    byKey.set(s.key, arr);
  }

  const channels: ChannelStats[] = [];
  for (const pid of PIDS) {
    const arr = byKey.get(pid.key);
    if (!arr || arr.length === 0) continue;
    const values = arr.map((s) => s.value);
    const sorted = [...values].sort((a, b) => a - b);
    channels.push({
      key: pid.key,
      name: pid.name,
      unit: pid.unit,
      count: values.length,
      min: round2(sorted[0]),
      max: round2(sorted[sorted.length - 1]),
      mean: round2(values.reduce((a, b) => a + b, 0) / values.length),
      p95: round2(percentile(sorted, 95)),
      first: round2(values[0]),
      last: round2(values[values.length - 1]),
    });
  }

  const durationMin = samples.length > 0 ? round2((samples[samples.length - 1].t - samples[0].t) / 60000) : 0;

  const ruleAlerts: RuleAlert[] = [];
  const get = (key: string) => channels.find((c) => c.key === key);
  const coolant = get('coolant_temp');
  const oil = get('oil_temp');
  const ltft = get('ltft_b1');
  const stft = get('stft_b1');
  if (coolant && coolant.max > 115) ruleAlerts.push({ level: 'red', text: `Coolant peaked at ${coolant.max}°C (>115)` });
  if (oil && oil.max > 125) ruleAlerts.push({ level: 'red', text: `Oil temp peaked at ${oil.max}°C (>125)` });
  if (ltft && Math.abs(ltft.mean) > 8) ruleAlerts.push({ level: 'yellow', text: `LTFT mean ${ltft.mean}% (|x|>8)` });
  if (stft && Math.abs(stft.p95) > 12) ruleAlerts.push({ level: 'yellow', text: `STFT p95 ${stft.p95}% (|x|>12)` });

  let warmupToleranceSec: number | null = null;
  const coolantSamples = byKey.get('coolant_temp') ?? [];
  if (coolantSamples.length > 0 && coolantSamples[0].value < 60) {
    const hit = coolantSamples.find((s) => s.value >= 80);
    if (hit) warmupToleranceSec = round2((hit.t - coolantSamples[0].t) / 1000);
  }

  return { durationMin, totalSamples: samples.length, channels, ruleAlerts, warmupToleranceSec };
}

// 5 分钟滚动评分:窗口压缩统计(纯函数)+ MiniMax 调用 + 输出校验。
// 调用约定复制 minimax.ts;失败由调用方兜底(保留上次结果标 stale)。
import { Sample } from '../obd/ElmSession';

export interface LiveScore {
  /** 0-100 integer */
  score: number;
  /** 5-20 English words */
  problem: string;
}

export interface WindowChannelStats {
  key: string;
  min: number;
  mean: number;
  max: number;
  last: number;
}

export interface WindowStats {
  windowSec: number;
  sampleCount: number;
  channels: WindowChannelStats[];
  /** 本地规则事件 — LLM 只读,必须压分。 */
  events: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildWindowStats(samples: Sample[], windowMs: number): WindowStats {
  const windowSec = Math.round(windowMs / 1000);
  if (samples.length === 0) return { windowSec, sampleCount: 0, channels: [], events: [] };
  const endT = samples[samples.length - 1].t;
  const win = samples.filter((s) => s.t >= endT - windowMs);
  const byKey = new Map<string, number[]>();
  for (const s of win) {
    const arr = byKey.get(s.key);
    if (arr) arr.push(s.value);
    else byKey.set(s.key, [s.value]);
  }
  const channels: WindowChannelStats[] = [...byKey.entries()].map(([key, vs]) => ({
    key,
    min: round2(Math.min(...vs)),
    mean: round2(vs.reduce((a, b) => a + b, 0) / vs.length),
    max: round2(Math.max(...vs)),
    last: round2(vs[vs.length - 1]),
  }));
  const events: string[] = [];
  const get = (k: string) => channels.find((c) => c.key === k);
  const coolant = get('coolant_temp');
  if (coolant && coolant.max >= 105) events.push(`coolant peaked at ${coolant.max} C (overheat threshold 105)`);
  const ltft = get('ltft_b1');
  if (ltft && Math.abs(ltft.mean) >= 10) events.push(`long-term fuel trim mean ${ltft.mean}% exceeds 10% threshold`);
  const stft = get('stft_b1');
  if (stft && Math.abs(stft.mean) >= 10) events.push(`short-term fuel trim mean ${stft.mean}% exceeds 10% threshold`);
  const rpm = get('rpm');
  if (rpm && rpm.max >= 5500) events.push(`rpm peaked at ${rpm.max}`);
  return { windowSec, sampleCount: win.length, channels, events };
}

export function parseLiveScore(text: string): LiveScore | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const obj = parsed as { score?: unknown; problem?: unknown };
  if (typeof obj.score !== 'number' || typeof obj.problem !== 'string') return null;
  const score = Math.min(100, Math.max(0, Math.round(obj.score)));
  const words = obj.problem.trim().split(/\s+/).filter(Boolean);
  if (words.length < 5) return null;
  return { score, problem: words.slice(0, 20).join(' ') };
}

const BASE_URL = 'https://api.MiniMax.chat/anthropic/v1/messages';
const MODEL = 'MiniMax-M3';

const SYSTEM_PROMPT = [
  'You are an automotive engine-health monitor for a BMW petrol engine.',
  'Input: aggregated OBD-II statistics for the last few minutes of driving — per-channel min/mean/max/last plus locally detected rule events.',
  'Channels: rpm, speed (km/h), coolant_temp (C), oil_temp (C), stft_b1 (%), ltft_b1 (%).',
  'Reply with ONLY a JSON object, no markdown fences:',
  '{"score": <integer 0-100, 100 = perfectly healthy right now>, "problem": "<the single most relevant current issue in 5 to 20 English words; if everything looks normal, say so in 5 to 20 words>"}',
  'Base the score only on the numbers provided. Rule events must lower the score.',
].join('\n');

export async function analyzeLiveScore(stats: WindowStats, apiKey: string): Promise<LiveScore> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(stats) }],
    }),
  });
  if (!response.ok) {
    throw new Error(`MiniMax API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const parsed = parseLiveScore(text);
  if (!parsed) throw new Error(`Invalid live-score response: ${text.slice(0, 200)}`);
  return parsed;
}

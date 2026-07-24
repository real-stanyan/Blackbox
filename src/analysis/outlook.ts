// Outlook = 多行程聚合的 LLM 展望。输入是趋势序列 + 近期 findings 摘要,
// 不喂原始样本;解析层白名单过滤,坏输出宁可空不可炸。
import { Finding, Outlook, Tone, TripRecord } from '../data/types';
import { buildTrends, TrendKey } from '../data/trends';

const BASE_URL = 'https://api.MiniMax.chat/anthropic/v1/messages';
const MODEL = 'MiniMax-M3';

export interface OutlookInput {
  trends: Record<TrendKey, { label: string; unit: string; series: number[] }>;
  recentFindings: string[];
  tripCount: number;
}

const SYSTEM_PROMPT = `你是一位 BMW 发动机数据分析师。输入是多次行程聚合出的趋势序列与近期发现,不是单次行程。

规则(必须遵守):
1. 只输出 JSON,不要 markdown 代码块,不要任何其他文字。
2. 措辞只允许「建议检查 X」「留意 X」,禁止「确诊」「一定是」。
3. severity 只能是 info / watch / inspect。
4. 数据点少时保守:行程数 < 5 时 score 不得低于 60,除非有明确异常趋势。
5. 所有文字用中文。

输出 JSON schema:
{"score": 0到100整数, "headline": "一两句总体判断", "current": [{"title":"当前需关注","detail":"依据","severity":"info|watch|inspect","action":"可选建议"}], "future": [{"title":"未来可能","detail":"依据","severity":"info|watch|inspect","action":"可选建议"}], "normal": ["目前正常的方面,短句"]}`;

export function buildOutlookInput(records: TripRecord[]): OutlookInput {
  const trends = buildTrends(records);
  const pick = (k: TrendKey) => ({ label: trends[k].label, unit: trends[k].unit, series: trends[k].series });
  const recentFindings = records
    .filter((r) => r.report)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 5)
    .flatMap((r) => r.report!.findings.map((f) => `[${f.severity}] ${f.finding}`));
  return {
    trends: { ltft: pick('ltft'), warmup: pick('warmup'), idle: pick('idle'), cold: pick('cold') },
    recentFindings,
    tripCount: records.length,
  };
}

const TONE_MAP: Record<string, Tone> = { info: 'info', watch: 'watch', inspect: 'inspect' };

function toFindings(v: unknown): Finding[] {
  if (!Array.isArray(v)) return [];
  const out: Finding[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const tone = TONE_MAP[String(o.severity)];
    if (!tone || typeof o.title !== 'string' || typeof o.detail !== 'string') continue;
    out.push({
      tone, title: o.title, detail: o.detail,
      action: typeof o.action === 'string' && o.action ? o.action : undefined,
    });
  }
  return out;
}

/** 纯解析 + 白名单校验。exported for offline test. */
export function parseOutlook(text: string): Outlook {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`No JSON in outlook response: ${text.slice(0, 200)}`);
  const p = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const rawScore = typeof p.score === 'number' && Number.isFinite(p.score) ? p.score : 50;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const verdictLabel = score >= 80 ? '总体良好' : score >= 60 ? '需要留意' : '建议检查';
  const verdictTone: Tone = score >= 80 ? 'good' : score >= 60 ? 'watch' : 'inspect';
  return {
    score, verdictLabel, verdictTone,
    headline: typeof p.headline === 'string' ? p.headline : '暂无总体判断。',
    current: toFindings(p.current),
    future: toFindings(p.future),
    normal: Array.isArray(p.normal) ? p.normal.filter((x): x is string => typeof x === 'string') : [],
  };
}

export async function analyzeOutlook(input: OutlookInput, apiKey: string): Promise<Outlook> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `聚合数据:\n${JSON.stringify(input)}` }],
    }),
  });
  if (!response.ok) {
    throw new Error(`MiniMax API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error(`Empty outlook response: ${JSON.stringify(data).slice(0, 200)}`);
  return parseOutlook(text);
}

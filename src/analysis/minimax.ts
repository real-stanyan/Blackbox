import { TripFeatures } from './features';

export interface Finding {
  finding: string;
  evidence: string[];
  severity: 'info' | 'watch' | 'inspect';
  confidence: 'low' | 'med' | 'high';
  suggested_action: string;
}

export interface TripReport {
  summary: string;
  findings: Finding[];
  /** Findings the local validator rejected (evidence cited numbers not present in input). */
  rejectedCount: number;
}

const BASE_URL = 'https://api.MiniMax.chat/anthropic/v1/messages';
const MODEL = 'MiniMax-M3';

const SYSTEM_PROMPT = `你是一位 BMW 发动机数据分析师。输入是一次驾驶行程的聚合统计（不是原始数据）。

规则（必须遵守）：
1. 只输出 JSON，不要 markdown 代码块，不要任何其他文字。
2. 措辞只允许「建议检查 X」，禁止「确诊」「一定是」。
3. severity 只能是 info / watch / inspect；标 inspect 必须有至少 2 个独立指标佐证。
4. evidence 数组里的每一条都必须引用输入 JSON 中真实存在的数值（原样引用数字）。
5. ruleAlerts 是本地规则层已判定的告警，你只做解读，不得升级或降级其级别。
6. 数据不足以下结论时，直说数据不足，不要编造。
7. summary 和所有文字用中文。

输出 JSON schema：
{"summary": "两三句话的总体健康评价", "findings": [{"finding": "发现", "evidence": ["引用具体数值的证据"], "severity": "info|watch|inspect", "confidence": "low|med|high", "suggested_action": "建议动作"}]}`;

function extractNumbers(s: string): number[] {
  return (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** Every number cited in evidence must exist somewhere in the features input. */
function validateFinding(f: Finding, inputNumbers: Set<number>): boolean {
  if (!['info', 'watch', 'inspect'].includes(f.severity)) return false;
  if (!['low', 'med', 'high'].includes(f.confidence)) return false;
  if (!Array.isArray(f.evidence) || f.evidence.length === 0) return false;
  for (const ev of f.evidence) {
    const nums = extractNumbers(ev);
    if (nums.length === 0) return false;
    const anyMatch = nums.some((n) =>
      inputNumbers.has(n) || inputNumbers.has(Math.round(n * 100) / 100)
    );
    if (!anyMatch) return false;
  }
  return true;
}

function collectNumbers(obj: unknown, out: Set<number>): void {
  if (typeof obj === 'number') {
    out.add(Math.round(obj * 100) / 100);
  } else if (typeof obj === 'string') {
    extractNumbers(obj).forEach((n) => out.add(Math.round(n * 100) / 100));
  } else if (Array.isArray(obj)) {
    obj.forEach((v) => collectNumbers(v, out));
  } else if (obj && typeof obj === 'object') {
    Object.values(obj).forEach((v) => collectNumbers(v, out));
  }
}

export async function analyzeTrip(features: TripFeatures, apiKey: string): Promise<TripReport> {
  const inputJson = JSON.stringify(features);
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `行程数据：\n${inputJson}` }],
    }),
  });
  if (!response.ok) {
    throw new Error(`MiniMax API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error(`Empty response: ${JSON.stringify(data).slice(0, 200)}`);

  // M3 sometimes wraps JSON in fences despite instructions — take outermost braces.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(text.slice(start, end + 1));

  const inputNumbers = new Set<number>();
  collectNumbers(features, inputNumbers);

  const rawFindings: Finding[] = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings = rawFindings.filter((f) => validateFinding(f, inputNumbers));

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '(no summary)',
    findings,
    rejectedCount: rawFindings.length - findings.length,
  };
}

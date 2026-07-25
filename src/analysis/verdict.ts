import { TripFeatures } from './features';
import { Finding as ReportFinding, TripReport } from './minimax';
import { Finding, Tone } from '../data/types';

/** 本地规则层不可被 LLM 降级(minimax.ts 约束 5):red 告警恒 inspect。 */
export function verdictFromTrip(features: TripFeatures, report: TripReport | null): Tone {
  if (features.ruleAlerts.some((a) => a.level === 'red')) return 'inspect';
  const sevs = report?.findings.map((f) => f.severity) ?? [];
  if (sevs.includes('inspect')) return 'inspect';
  if (sevs.includes('watch') || features.ruleAlerts.length > 0) return 'watch';
  return 'good';
}

const TONE: Record<ReportFinding['severity'], Tone> = { info: 'info', watch: 'watch', inspect: 'inspect' };

// LLM 不输出结构化通道字段(prompt 里没要求,加了还得防编造),所以从它自己写的
// 文本里认通道:evidence 按约定会原样引用 features.channels 的 key(如
// `stft_b1 p95=4.69`),中文别名兜底。认不出来就是空数组,图表照常画,只是不挂徽标。
const CHANNEL_ALIASES: Record<string, string[]> = {
  rpm: ['rpm', '转速'],
  speed: ['speed', '车速'],
  coolant_temp: ['coolant_temp', 'coolant', '水温', '冷却液'],
  oil_temp: ['oil_temp', '油温', '机油温度'],
  stft_b1: ['stft_b1', 'stft', '短期燃油修正'],
  ltft_b1: ['ltft_b1', 'ltft', '长期燃油修正'],
};

export function findingChannels(f: Pick<ReportFinding, 'finding' | 'evidence'>): string[] {
  const hay = [f.finding, ...f.evidence].join(' ').toLowerCase();
  return Object.entries(CHANNEL_ALIASES)
    .filter(([, aliases]) => aliases.some((a) => hay.includes(a.toLowerCase())))
    .map(([key]) => key);
}

export function reportToFindings(report: TripReport): Finding[] {
  return report.findings.map((f) => ({
    tone: TONE[f.severity],
    title: f.finding,
    detail: f.evidence.join('；'),
    action: f.suggested_action ? f.suggested_action : undefined,
    channels: findingChannels(f),
  }));
}

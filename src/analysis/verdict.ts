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

export function reportToFindings(report: TripReport): Finding[] {
  return report.findings.map((f) => ({
    tone: TONE[f.severity],
    title: f.finding,
    detail: f.evidence.join('；'),
    action: f.suggested_action ? f.suggested_action : undefined,
  }));
}

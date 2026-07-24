// Run: npx tsx scripts/test-display.ts
import { verdictFromTrip, reportToFindings } from '../src/analysis/verdict';
import { tripToDisplay } from '../src/data/display';
import { TripRecord } from '../src/data/types';
import { TripFeatures } from '../src/analysis/features';
import { TripReport } from '../src/analysis/minimax';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const baseFeatures: TripFeatures = {
  durationMin: 20, totalSamples: 500, channels: [], ruleAlerts: [], warmupToleranceSec: null,
};

// 规则层 red 兜底 inspect,LLM 不可降级(对齐 minimax.ts 约束 5)
assert(
  verdictFromTrip({ ...baseFeatures, ruleAlerts: [{ level: 'red', text: 'x 120' }] }, null) === 'inspect',
  'red alert → inspect',
);
// 无报告无告警 → good
assert(verdictFromTrip(baseFeatures, null) === 'good', '干净未分析 → good');
// findings 最高 severity 驱动
const report: TripReport = {
  summary: 's',
  findings: [
    { finding: 'a', evidence: ['1'], severity: 'info', confidence: 'high', suggested_action: '' },
    { finding: 'b', evidence: ['2'], severity: 'watch', confidence: 'med', suggested_action: '查' },
  ],
  rejectedCount: 0,
};
assert(verdictFromTrip(baseFeatures, report) === 'watch', 'watch finding → watch');

const fs2 = reportToFindings(report);
assert(fs2.length === 2 && fs2[1].tone === 'watch' && fs2[1].action === '查', 'findings 映射');
assert(fs2[0].action === undefined, '空 suggested_action → 无建议框');

// display:同天 → 今天;标题按时段
const now = new Date('2026-07-24T20:00:00').getTime();
const rec = (startedAt: number): TripRecord => ({
  id: String(startedAt), startedAt, endedAt: startedAt + 1200000,
  durationMin: 20, distanceKm: 8.6, samples: 500,
  metrics: { ltftMean: 5, warmupMin: 8, idleRpm: 750, cold: true },
  features: baseFeatures, series: {}, report: null, verdict: 'good',
});
const today = tripToDisplay(rec(new Date('2026-07-24T07:42:00').getTime()), now);
assert(today.group === '今天', `group=今天,实际 ${today.group}`);
assert(today.time === '07:42', `time=07:42,实际 ${today.time}`);
assert(today.title === '清晨行程', `title=清晨行程,实际 ${today.title}`);
assert(today.analyzed === false && today.findings.length === 0, '未分析 → findings 空');
const older = tripToDisplay(rec(new Date('2026-07-20T13:00:00').getTime()), now);
assert(older.group === '7月20日', `group=7月20日,实际 ${older.group}`);
assert(older.title === '下午行程', `title=下午行程,实际 ${older.title}`);

console.log('PASS test-display');

// Run: npx tsx scripts/test-trends.ts
import { buildTrends, hasEnough } from '../src/data/trends';
import { TripRecord } from '../src/data/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const now = new Date('2026-07-24T12:00:00').getTime();
const mk = (daysAgo: number, ltft: number | null, cold: boolean): TripRecord => {
  const startedAt = now - daysAgo * 86_400_000;
  return {
    id: String(startedAt), startedAt, endedAt: startedAt + 1_200_000,
    durationMin: 20, distanceKm: 8, samples: 500,
    metrics: { ltftMean: ltft, warmupMin: cold ? 8 : null, idleRpm: 750, cold },
    features: { durationMin: 20, totalSamples: 500, channels: [], ruleAlerts: [], warmupToleranceSec: null },
    series: {}, report: null, verdict: 'good',
  };
};

// 空 → 全部数据积累中
const empty = buildTrends([], now);
assert(!hasEnough(empty.ltft) && empty.ltft.note === '数据积累中', '空数据 → 积累中');

// 15 个行程 → ltft series 截到 12,时间升序
const recs = Array.from({ length: 15 }, (_, i) => mk(15 - i, 3 + i * 0.2, i % 2 === 0));
const trends = buildTrends(recs, now);
assert(trends.ltft.series.length === 12, `ltft 截 12,实际 ${trends.ltft.series.length}`);
assert(hasEnough(trends.ltft), 'ltft 数据够');
const s = trends.ltft.series;
assert(s[s.length - 1] > s[0], '时间升序(最新在右)');
assert(Math.abs(trends.ltft.now - s[s.length - 1]) < 0.001, 'now = 最新值');
assert(trends.ltft.months.length === 12, 'label 数与 series 一致');
// ltft null 的行程被跳过
const withNull = buildTrends([mk(3, null, true), mk(2, 4, false), mk(1, 5, false)], now);
assert(withNull.ltft.series.length === 2, 'null 指标跳过');
// cold 按周计数
assert(trends.cold.series.length >= 2, 'cold 按周聚合有 series');
assert(trends.cold.unit === '次', 'cold 单位');

console.log('PASS test-trends');

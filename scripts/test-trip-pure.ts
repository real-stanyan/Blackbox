// 离线测试:降采样 + 行程指标。Run: npx tsx scripts/test-trip-pure.ts
import { buildSeries } from '../src/analysis/series';
import { computeMetrics } from '../src/analysis/tripMetrics';
import { Sample } from '../src/obd/ElmSession';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

// 600 个 rpm 样本 → 降到 ≤120 且保头尾
const rpm: Sample[] = Array.from({ length: 600 }, (_, i) => ({
  t: i * 1000, key: 'rpm', value: 800 + i, raw: '',
}));
const series = buildSeries(rpm);
assert(Object.keys(series).length === 1, 'series 只有 rpm 一个通道');
assert(series.rpm.length <= 120, `rpm 降到 ≤120,实际 ${series.rpm.length}`);
assert(series.rpm[0].v === 800, '保留首点');
assert(series.rpm[series.rpm.length - 1].v === 800 + 599, '保留尾点');

// 少于上限不动
const few = buildSeries(rpm.slice(0, 50));
assert(few.rpm.length === 50, '≤上限时原样保留');

// metrics:冷启动 + 怠速段 + ltft 均值
const samples: Sample[] = [];
for (let i = 0; i < 100; i++) {
  const t = i * 2000;
  samples.push({ t, key: 'coolant_temp', value: Math.min(95, 20 + i), raw: '' }); // 20→95,i=60 到 80°C
  samples.push({ t, key: 'speed', value: i < 30 ? 0 : 50, raw: '' }); // 前 30 怠速
  samples.push({ t, key: 'rpm', value: i < 30 ? 750 : 2000, raw: '' });
  samples.push({ t, key: 'ltft_b1', value: 5.0, raw: '' });
}
const m = computeMetrics(samples);
assert(m.cold === true, '首个水温 20 < 60 → 冷启动');
assert(m.ltftMean !== null && Math.abs(m.ltftMean - 5.0) < 0.01, `ltftMean≈5.0,实际 ${m.ltftMean}`);
assert(m.idleRpm !== null && Math.abs(m.idleRpm - 750) < 1, `idleRpm≈750,实际 ${m.idleRpm}`);
assert(m.warmupMin !== null && m.warmupMin > 0, 'warmupMin 有值');

// 无怠速段 / 无 ltft → null,不 NaN
const m2 = computeMetrics([{ t: 0, key: 'rpm', value: 2000, raw: '' }]);
assert(m2.idleRpm === null && m2.ltftMean === null && m2.warmupMin === null, '缺数据 → null');
assert(m2.cold === false, '无水温 → cold false');

console.log('PASS test-trip-pure');

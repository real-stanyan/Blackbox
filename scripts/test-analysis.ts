// Node smoke test for the analysis pipeline: synthetic trip -> features -> MiniMax -> validated report.
// Run: MINIMAX_KEY=sk-cp-... npx tsx scripts/test-analysis.ts
import { extractFeatures } from '../src/analysis/features';
import { analyzeTrip } from '../src/analysis/minimax';
import { Sample } from '../src/obd/ElmSession';

const samples: Sample[] = [];
// Simulate 15 min trip @ ~0.5Hz per channel: warmup then cruise, healthy trims.
for (let i = 0; i < 450; i++) {
  const t = i * 2000;
  const warm = Math.min(1, i / 150);
  samples.push({ t, key: 'rpm', value: 800 + Math.sin(i / 10) * 600 + warm * 800, raw: '' });
  samples.push({ t, key: 'speed', value: Math.max(0, Math.sin(i / 25) * 60), raw: '' });
  samples.push({ t, key: 'coolant_temp', value: Math.round(20 + warm * 85), raw: '' });
  samples.push({ t, key: 'oil_temp', value: Math.round(18 + warm * 88), raw: '' });
  samples.push({ t, key: 'stft_b1', value: Math.round(Math.sin(i / 3) * 400) / 100, raw: '' });
  samples.push({ t, key: 'ltft_b1', value: 1.56, raw: '' });
}

async function main() {
  const features = extractFeatures(samples);
  console.log('FEATURES:', JSON.stringify(features, null, 1));
  const key = process.env.MINIMAX_KEY;
  if (!key) throw new Error('set MINIMAX_KEY');
  const report = await analyzeTrip(features, key);
  console.log('\nREPORT:', JSON.stringify(report, null, 1));
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});

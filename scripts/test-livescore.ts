// Offline assertions for live-score pure functions; optional live MiniMax call.
// Run: npx tsx scripts/test-livescore.ts          (offline checks only)
//      MINIMAX_KEY=sk-cp-... npx tsx scripts/test-livescore.ts   (adds live call)
import { analyzeLiveScore, buildWindowStats, parseLiveScore } from '../src/analysis/liveScore';
import { Sample } from '../src/obd/ElmSession';

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`ok: ${name}`);
  else {
    failed++;
    console.error(`FAIL: ${name}`);
  }
}

const samples: Sample[] = [];
for (let i = 0; i < 400; i++) {
  const t = i * 2000; // 0..798s, 2s cadence
  samples.push({ t, key: 'rpm', value: 2000 + (i % 10) * 50, raw: '' });
  samples.push({ t, key: 'coolant_temp', value: 90, raw: '' });
  samples.push({ t, key: 'ltft_b1', value: 12, raw: '' });
}

const stats = buildWindowStats(samples, 300_000);
check('windowSec is 300', stats.windowSec === 300);
// endT = 798000 → window keeps t >= 498000 → i in [249..399] = 151 ticks × 3 channels
check('window keeps only last 5 min of samples', stats.sampleCount === 151 * 3);
check('ltft rule event fires at mean 12%', stats.events.some((e) => e.includes('long-term fuel trim')));
check('rpm stays under event threshold', !stats.events.some((e) => e.startsWith('rpm')));
check('empty input yields empty stats', buildWindowStats([], 300_000).sampleCount === 0);

check('valid JSON parses', parseLiveScore('{"score": 87, "problem": "coolant temperature slightly above normal range"}')?.score === 87);
check('score clamps high', parseLiveScore('{"score": 150, "problem": "one two three four five six"}')?.score === 100);
check('score clamps low', parseLiveScore('{"score": -5, "problem": "one two three four five six"}')?.score === 0);
check('under 5 words rejected', parseLiveScore('{"score": 90, "problem": "all good"}') === null);
check(
  'over 20 words truncated to 20',
  parseLiveScore(`{"score": 50, "problem": "${Array.from({ length: 25 }, (_, i) => `w${i}`).join(' ')}"}`)?.problem.split(' ').length === 20,
);
check('non-JSON rejected', parseLiveScore('engine looks fine to me') === null);
check('fenced JSON extracted', parseLiveScore('```json\n{"score": 70, "problem": "long term fuel trim trending rich"}\n```')?.score === 70);

async function main() {
  const key = process.env.MINIMAX_KEY;
  if (key) {
    const result = await analyzeLiveScore(stats, key);
    console.log('LIVE RESULT:', JSON.stringify(result));
    check('live score in range', result.score >= 0 && result.score <= 100);
    const n = result.problem.split(/\s+/).length;
    check('live problem 5-20 words', n >= 5 && n <= 20);
  } else {
    console.log('(no MINIMAX_KEY — skipped live call)');
  }
  if (failed) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('ALL OK');
}

void main();

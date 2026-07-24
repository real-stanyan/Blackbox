# Sub-project D — CarPlay Dashboard + 5-min Rolling LLM Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CarPlay single-screen dashboard (4 text rows, 10 s refresh) + an in-trip engine that every 5 minutes sends a compressed 5-minute OBD window to MiniMax M3 and gets back `{score: 0-100, problem: "5-20 English words"}`, shown on CarPlay, the phone Home screen, and persisted into the trip record.

**Architecture:** A pure analysis module (`liveScore.ts`) + two module-level stores (`liveScoreStore`, `liveDataStore` — the latter mirrors LiveSession React state for headless CarPlay JS) + a 5-min interval inside `LiveSessionProvider` + a CarPlay layer (`src/carplay/`) built on `@iternio/react-native-auto-play` that mounts an `InformationTemplate` inside `didConnect` and refreshes every 10 s. CarPlay native setup is injected by a local Expo config plugin.

**Tech Stack:** Expo ~57 / RN 0.86 / TS ~6.0; `@iternio/react-native-auto-play` + `react-native-nitro-modules`; `patch-package`; expo-file-system stores as in sub-project C.

## Global Constraints

- Expo API usage MUST follow https://docs.expo.dev/versions/v57.0.0/ (AGENTS.md hard rule).
- Gate: `npx tsc --noEmit` green before every commit. No test framework exists; `scripts/test-livescore.ts` is a manual offline check.
- MiniMax calling convention (copy exactly from `src/analysis/minimax.ts`): endpoint `https://api.MiniMax.chat/anthropic/v1/messages`, model `MiniMax-M3`, header `Authorization: Bearer <apiKey>`, body `{model, max_tokens, system, messages:[{role:'user', content}]}`, response text at `data?.content?.[0]?.text`, JSON extracted via `indexOf('{')`/`lastIndexOf('}')`.
- CarPlay rows refresh at exactly 10_000 ms — Apple driving-task rule: "Do not periodically refresh data items in the CarPlay UI more than once every 10 seconds". Never faster.
- `InformationTemplate` iOS: max 4 `TextRow` items, no images, no per-row onPress.
- CarPlay layer is BLIND-WRITTEN: cannot be run before the Apple entitlement is granted (even Simulator requires it). Acceptance for CarPlay code = tsc green + phone build boots. All CarPlay work is labeled 「未经验证——等 entitlement」 in the PR.
- `problem` validation: score clamped to integer 0-100; problem split on whitespace, > 20 words → truncate to 20, < 5 words → whole result invalid (null).
- Score analysis failure (no key / network / invalid JSON) must never interrupt a trip: keep last result, mark stale.
- Chinese UI copy on phone; English text on CarPlay rows (CarPlay templates get English per user requirement "问题文字描述…英文单词").
- Commit trailers (every commit):
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_015sNExaLvLqkZead4DntCtS`

**Branch:** all work on `feat/carplay-live-score` (controller creates it before Task 1, from up-to-date main).

---

### Task 1: Types + pure live-score analysis + offline test script

**Files:**
- Modify: `src/data/types.ts` (add `ScorePoint`, extend `TripRecord`)
- Create: `src/analysis/liveScore.ts`
- Create: `scripts/test-livescore.ts`

**Interfaces:**
- Consumes: `Sample` from `src/obd/ElmSession` (`{ t: number; key: string; value: number; raw: string }`).
- Produces: `ScorePoint {t, score, problem}`; `TripRecord.scoreTimeline?: ScorePoint[]`; `WindowStats`; `buildWindowStats(samples: Sample[], windowMs: number): WindowStats`; `parseLiveScore(text: string): LiveScore | null`; `analyzeLiveScore(stats: WindowStats, apiKey: string): Promise<LiveScore>`; `LiveScore {score: number; problem: string}`.

- [ ] **Step 1: Add types**

In `src/data/types.ts`, after the `SeriesPoint` interface, add:

```ts
export interface ScorePoint {
  /** ms since trip start */
  t: number;
  /** 0-100 */
  score: number;
  /** 5-20 English words */
  problem: string;
}
```

In the `TripRecord` interface, after the `verdict: Tone;` field, add:

```ts
  /** 5 分钟滚动评分时间线;旧记录无此字段。 */
  scoreTimeline?: ScorePoint[];
```

- [ ] **Step 2: Create `src/analysis/liveScore.ts`**

```ts
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
```

- [ ] **Step 3: Create `scripts/test-livescore.ts`**

```ts
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
```

- [ ] **Step 4: Run checks**

Run: `npx tsx scripts/test-livescore.ts`
Expected: every line `ok: …`, final `ALL OK`, exit 0.

Run: `npx tsc --noEmit`
Expected: no output (green).

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/analysis/liveScore.ts scripts/test-livescore.ts
git commit -m "feat: live-score window stats, MiniMax call and validation (pure core)

Why: 5-min rolling engine score needs a compressed statistical window
(raw samples would waste tokens) and strict output validation (clamp
0-100, 5-20 English words) before anything reaches CarPlay or UI."
```

---

### Task 2: liveScoreStore + liveDataStore + useLiveScore hook

**Files:**
- Create: `src/data/liveScoreStore.ts`
- Create: `src/data/liveDataStore.ts`
- Create: `src/hooks/useLiveScore.ts`

**Interfaces:**
- Consumes: `ScorePoint` from `src/data/types.ts` (Task 1).
- Produces:
  - `subscribeLiveScore(fn): () => void`, `getLiveScore(): LiveScoreState | null`, `startScoreTrip()`, `recordScore(point: ScorePoint)`, `markScoreStale()`, `takeScoreTimeline(): ScorePoint[]`; `LiveScoreState {score, problem, at, stale}`.
  - `subscribeLiveData(fn): () => void`, `getLiveData(): LiveData`, `publishLiveData(patch: Partial<LiveData>)`; `LiveData {streaming, values, startedAt, distanceKm}`.
  - `useLiveScore(): LiveScoreState | null`.

- [ ] **Step 1: Create `src/data/liveScoreStore.ts`**

```ts
// 5 分钟滚动评分状态:latest 供 Home 卡/CarPlay,timeline 行程结束附进 TripRecord。
// 模式同 outlookStore(module-level state + listeners Set)。
import { ScorePoint } from './types';

export interface LiveScoreState {
  score: number;
  problem: string;
  /** epoch ms of last successful analysis */
  at: number;
  /** true = 上次刷新失败,显示的是旧结果 */
  stale: boolean;
}

let latest: LiveScoreState | null = null;
let timeline: ScorePoint[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function subscribeLiveScore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getLiveScore = () => latest;

/** 新行程开始:清空上一程状态。 */
export function startScoreTrip(): void {
  latest = null;
  timeline = [];
  notify();
}

export function recordScore(point: ScorePoint): void {
  latest = { score: point.score, problem: point.problem, at: Date.now(), stale: false };
  timeline = [...timeline, point];
  notify();
}

export function markScoreStale(): void {
  if (latest && !latest.stale) {
    latest = { ...latest, stale: true };
    notify();
  }
}

/** 行程终结:取走时间线并清空(短行程丢弃时调用方直接扔掉返回值)。 */
export function takeScoreTimeline(): ScorePoint[] {
  const tl = timeline;
  latest = null;
  timeline = [];
  notify();
  return tl;
}
```

- [ ] **Step 2: Create `src/data/liveDataStore.ts`**

```ts
// LiveSession React state 的模块级镜像。CarPlay 的 JS 跑在 React 树外(headless
// registerAutoPlay),读不到 context — 这里是它唯一的数据入口。
export interface LiveData {
  streaming: boolean;
  /** UI key → 最新读数(rpm/speed/coolant/oil/stft/ltft) */
  values: Record<string, number>;
  /** 行程开始 epoch ms;无行程 null */
  startedAt: number | null;
  distanceKm: number;
}

let data: LiveData = { streaming: false, values: {}, startedAt: null, distanceKm: 0 };
const listeners = new Set<() => void>();

export function subscribeLiveData(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getLiveData = () => data;

export function publishLiveData(patch: Partial<LiveData>): void {
  data = {
    ...data,
    ...patch,
    values: patch.values ? { ...data.values, ...patch.values } : data.values,
  };
  listeners.forEach((fn) => fn());
}
```

- [ ] **Step 3: Create `src/hooks/useLiveScore.ts`**

```ts
import { useSyncExternalStore } from 'react';
import { getLiveScore, subscribeLiveScore } from '../data/liveScoreStore';

export function useLiveScore() {
  return useSyncExternalStore(subscribeLiveScore, getLiveScore);
}
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/data/liveScoreStore.ts src/data/liveDataStore.ts src/hooks/useLiveScore.ts
git commit -m "feat: live-score store and live-data mirror store

Why: CarPlay JS runs headless outside the React tree, so live values and
the rolling score need module-level stores; timeline is taken atomically
at trip finalize so late LLM results can't leak across trips."
```

---

### Task 3: LiveSession integration (5-min timer, mirror publish, timeline attach)

**Files:**
- Modify: `src/ble/LiveSession.tsx`

**Interfaces:**
- Consumes: Task 1 `buildWindowStats`/`analyzeLiveScore`; Task 2 store functions; `getApiKey` from `src/data/settingsStore`.
- Produces: `TripRecord.scoreTimeline` populated on finalize; `liveDataStore` kept current for CarPlay.

Read the whole file first. Then apply the following edits (anchors quote current code exactly).

- [ ] **Step 1: Add imports** (after existing import block, line ~15)

```ts
import { analyzeLiveScore, buildWindowStats } from '../analysis/liveScore';
import { markScoreStale, recordScore, startScoreTrip, takeScoreTimeline } from '../data/liveScoreStore';
import { publishLiveData } from '../data/liveDataStore';
import { getApiKey } from '../data/settingsStore';
```

(`setVehicle` is already imported from `../data/settingsStore` — merge into one import statement: `import { getApiKey, setVehicle } from '../data/settingsStore';` and delete the old one.)

- [ ] **Step 2: Add constants** (after `const MIN_TRIP_SAMPLES = 20;`)

```ts
// 5 分钟滚动评分:间隔与窗口都是 5 分钟;窗口样本太少(刚起步/长时间断连)跳过本轮。
const SCORE_INTERVAL_MS = 300_000;
const SCORE_WINDOW_MS = 300_000;
const SCORE_MIN_SAMPLES = 10;
```

- [ ] **Step 3: Add timer ref** (next to `graceTimerRef`, line ~74)

```ts
const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

- [ ] **Step 4: Add helpers** (after the `clearGrace` function)

```ts
const clearScoreTimer = () => {
  if (scoreTimerRef.current) {
    clearInterval(scoreTimerRef.current);
    scoreTimerRef.current = null;
  }
};

// 每 5 分钟评一次分。失败只标 stale,绝不打断行程。
const runLiveScore = useCallback(async () => {
  const trip = tripRef.current;
  if (!trip) return;
  const stats = buildWindowStats(trip.samples, SCORE_WINDOW_MS);
  if (stats.sampleCount < SCORE_MIN_SAMPLES) return;
  try {
    const key = await getApiKey();
    if (!key) {
      markScoreStale();
      return;
    }
    const result = await analyzeLiveScore(stats, key);
    if (tripRef.current !== trip) return; // 行程已终结 — 丢弃迟到结果
    recordScore({ t: Date.now() - trip.startedAt, score: result.score, problem: result.problem });
  } catch (e) {
    console.log(`[score] 分析失败: ${e}`);
    markScoreStale();
  }
}, []);
```

- [ ] **Step 5: Wire `finalizeTrip`**

Current code (anchor):

```ts
  const finalizeTrip = useCallback((notify: boolean) => {
    clearGrace();
    const trip = tripRef.current;
    tripRef.current = null;
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
    if (!trip) return;
```

Replace with:

```ts
  const finalizeTrip = useCallback((notify: boolean) => {
    clearGrace();
    clearScoreTimer();
    const trip = tripRef.current;
    tripRef.current = null;
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
    publishLiveData({ streaming: false, values: {}, startedAt: null, distanceKm: 0 });
    if (!trip) return;
    const scoreTimeline = takeScoreTimeline();
```

Then in the `record: TripRecord = { … }` literal, after `verdict: verdictFromTrip(features, null),` add:

```ts
      ...(scoreTimeline.length > 0 ? { scoreTimeline } : {}),
```

- [ ] **Step 6: Wire `fail`** — inside `fail`, directly after `setPhase('error');` add:

```ts
      publishLiveData({ streaming: false });
```

- [ ] **Step 7: Wire `startPolling`**

Current code (anchor):

```ts
      const isNewTrip = !tripRef.current;
      if (isNewTrip) {
        tripRef.current = { startedAt: Date.now(), samples: [], distanceKm: 0 };
        setValues({});
        setDistanceKm(0);
        void notifyConnected(deviceName);
        void setVehicle({ adapter: deviceName });
      }
      const trip = tripRef.current!;
```

Replace with:

```ts
      const isNewTrip = !tripRef.current;
      if (isNewTrip) {
        tripRef.current = { startedAt: Date.now(), samples: [], distanceKm: 0 };
        setValues({});
        setDistanceKm(0);
        void notifyConnected(deviceName);
        void setVehicle({ adapter: deviceName });
        startScoreTrip();
        publishLiveData({ streaming: true, values: {}, startedAt: tripRef.current.startedAt, distanceKm: 0 });
        clearScoreTimer();
        scoreTimerRef.current = setInterval(() => void runLiveScore(), SCORE_INTERVAL_MS);
      } else {
        publishLiveData({ streaming: true }); // 宽限内重连 — 同一行程,只翻转连接位
      }
      const trip = tripRef.current!;
```

In the poll loop, after the line
`setValues((prev) => ({ ...prev, [OBD_TO_UI[sample.key] ?? sample.key]: sample.value }));`
add:

```ts
              publishLiveData({ values: { [OBD_TO_UI[sample.key] ?? sample.key]: sample.value } });
```

And after `setDistanceKm(trip.distanceKm);` add:

```ts
                  publishLiveData({ distanceKm: trip.distanceKm });
```

Update `startPolling`'s dependency array from `[fail]` to `[fail, runLiveScore]`.

- [ ] **Step 8: Unmount cleanup** — in the unmount `useEffect`, after `clearGrace();` add:

```ts
      clearScoreTimer();
```

- [ ] **Step 9: Gate + commit**

Run: `npx tsc --noEmit` → green.

```bash
git add src/ble/LiveSession.tsx
git commit -m "feat: 5-min rolling score timer wired into trip lifecycle

Why: score interval starts only on a NEW trip (grace-reconnect keeps the
same timer running), late LLM results are dropped via tripRef identity,
and the timeline is taken atomically in finalizeTrip so it lands in the
same TripRecord write as everything else."
```

---

### Task 4: Home screen live-score card

**Files:**
- Create: `src/screens/components/LiveScoreCard.tsx`
- Modify: `src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `useLiveScore` (Task 2), `Card` (`src/components/Card.tsx`), `useTheme` (`src/context/Theme.tsx`).
- Produces: `<LiveScoreCard />` — renders nothing when no score yet.

- [ ] **Step 1: Create `src/screens/components/LiveScoreCard.tsx`**

Follow the app's existing style conventions (plain style objects in `useMemo` keyed on theme, `tabular-nums` for figures — see `StatTile.tsx`). No entry animation: the card appears with fresh data many times per drive; restraint over decoration.

```tsx
import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { useTheme } from '../../context/Theme';
import { useLiveScore } from '../../hooks/useLiveScore';

// 5 分钟滚动 AI 评分卡。没有结果时整卡不渲染(首次结果要等行程 5 分钟)。
export function LiveScoreCard() {
  const t = useTheme();
  const score = useLiveScore();
  const color =
    score == null ? t.label3 : score.score >= 80 ? t.green : score.score >= 60 ? t.orange : t.red;
  const s = useMemo(
    () => ({
      row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16 },
      score: {
        color,
        fontSize: 44,
        fontWeight: '700' as const,
        letterSpacing: -1,
        fontVariant: ['tabular-nums' as const],
        minWidth: 64,
        textAlign: 'center' as const,
      },
      right: { flex: 1, minWidth: 0 },
      label: { color: t.label2, fontSize: 13, marginBottom: 3 },
      problem: { color: t.label, fontSize: 15, lineHeight: 20 },
      time: { color: t.label3, fontSize: 11, marginTop: 4 },
    }),
    [t, color],
  );
  if (!score) return null;
  const mins = Math.max(0, Math.round((Date.now() - score.at) / 60000));
  return (
    <Card>
      <View style={s.row}>
        <Text style={s.score}>{score.score}</Text>
        <View style={s.right}>
          <Text style={s.label}>实时评分{score.stale ? ' · 已过期' : ''}</Text>
          <Text style={s.problem}>{score.problem}</Text>
          <Text style={s.time}>{mins === 0 ? '刚刚更新' : `${mins} 分钟前更新`}</Text>
        </View>
      </View>
    </Card>
  );
}
```

- [ ] **Step 2: Mount in `src/screens/HomeScreen.tsx`**

Add import `import { LiveScoreCard } from './components/LiveScoreCard';`. Render `<LiveScoreCard />` immediately after the connection hero `Card` closes (before the live-PID section label). Read the file to locate the hero card's closing tag; do not restructure anything else.

- [ ] **Step 3: Gate + commit**

Run: `npx tsc --noEmit` → green.

```bash
git add src/screens/components/LiveScoreCard.tsx src/screens/HomeScreen.tsx
git commit -m "feat: Home live-score card

Why: rolling score must be visible without CarPlay; card self-hides
until the first result so an idle Home screen stays unchanged."
```

---

### Task 5: TripDetail score-timeline chart

**Files:**
- Modify: `src/screens/TripDetailScreen.tsx`

**Interfaces:**
- Consumes: `TripRecord.scoreTimeline` (Task 1), existing `LineChart` (`src/components/LineChart.tsx`, props `{series: number[]; months: string[]; color: string; h?: number}`), existing `rec` (`useTripRecord`) already in the screen.
- Produces: a chart section, only for records with ≥ 2 score points.

- [ ] **Step 1: Add chart section**

Read `TripDetailScreen.tsx` first. Add import `import { LineChart } from '../components/LineChart';` (skip if already imported). Insert after the 「本次行程概要」 stats `Card` and before the 「AI 分析」 section, reusing the screen's existing section-label `<Text>` style for the header:

```tsx
      {rec.scoreTimeline && rec.scoreTimeline.length >= 2 ? (
        <>
          {/* 复用本文件已有的 section 标题样式渲染文案「实时评分」 */}
          <Card>
            <LineChart
              series={rec.scoreTimeline.map((p) => p.score)}
              months={rec.scoreTimeline.map((p) => `${Math.round(p.t / 60000)}'`)}
              color={rec.scoreTimeline[rec.scoreTimeline.length - 1].score >= 80 ? t.green : rec.scoreTimeline[rec.scoreTimeline.length - 1].score >= 60 ? t.orange : t.red}
            />
          </Card>
        </>
      ) : null}
```

The comment line above is an instruction, not shippable code: render the header with the same component/style this screen already uses for its other section titles (e.g. the 「AI 分析」 heading), with text 「实时评分」. `t` is the screen's existing `useTheme()` value — reuse it; extract the last-point color into a local `const last = rec.scoreTimeline[rec.scoreTimeline.length - 1]` if the inline ternary reads badly.

- [ ] **Step 2: Gate + commit**

Run: `npx tsc --noEmit` → green.

```bash
git add src/screens/TripDetailScreen.tsx
git commit -m "feat: score timeline chart in trip detail

Why: per-trip score history is the review surface for the 5-min rolling
analysis; hidden for trips predating the feature (optional field)."
```

---

### Task 6: Dependencies, patches, config plugin, app.json

**Files:**
- Modify: `package.json` (deps + postinstall)
- Create: `patches/expo-splash-screen+57.0.2.patch` (downloaded, not authored)
- Create: `plugins/withCarPlay.js`
- Modify: `app.json`

**Interfaces:**
- Produces: installed `@iternio/react-native-auto-play` + `react-native-nitro-modules`; config plugin wired so `expo prebuild`/`expo run:ios` injects CarPlay scenes + entitlement + AppDelegate patch.

Background (why each piece exists — from research, 2026-07-24):
- Library ships its own Swift scene delegates (`HeadUnitSceneDelegate`, `WindowApplicationSceneDelegate`, `DashboardSceneDelegate`, `ClusterSceneDelegate`) — Info.plist references them by bare class name; we write NO Swift scene code.
- Library has NO Expo config plugin — we write a local one or every prebuild wipes the native setup.
- `expo-splash-screen` breaks under UIScene apps; library repo ships a patch pinned to 57.0.2 (matches SDK 57).
- Library repo also ships a `react-native+0.83.5.patch` (keeps timers alive when screen locks). It CANNOT apply to RN 0.86 — we deliberately skip it and skip `buildReactNativeFromSource` (only needed by that patch). Consequence documented in ADR (Task 8): the 5-min score timer may pause while the phone is locked without CarPlay; BLE traffic keeps the app scheduled in practice.

- [ ] **Step 1: Install dependencies**

```bash
npm install @iternio/react-native-auto-play react-native-nitro-modules
npm install --save-dev patch-package
```

- [ ] **Step 2: Add postinstall + download patch**

In `package.json` `scripts`, add:

```json
    "postinstall": "patch-package"
```

Then:

```bash
mkdir -p patches
curl -fsSL "https://raw.githubusercontent.com/Iternio-Planning-AB/react-native-auto-play/master/patches/expo-splash-screen%2B57.0.2.patch" -o "patches/expo-splash-screen+57.0.2.patch"
npm install
```

Expected: `patch-package` output reports `expo-splash-screen@57.0.x` patched (a version-mismatch WARNING is acceptable; an ERROR is not — if it errors, report BLOCKED with the output).

- [ ] **Step 3: Create `plugins/withCarPlay.js`**

```js
// CarPlay native setup for @iternio/react-native-auto-play (which ships no config
// plugin). Injects: scene manifest (library's own delegate classes), the
// driving-task entitlement, and the getRootViewForAutoplay AppDelegate hook the
// library's scene delegates call. Blind-written — cannot run before Apple grants
// the CarPlay entitlement (Simulator included); see ADR-0029.
const { withAppDelegate, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

const SCENE_MANIFEST = {
  CPSupportsDashboardNavigationScene: true,
  CPSupportsInstrumentClusterNavigationScene: true,
  UIApplicationSupportsMultipleScenes: true,
  UISceneConfigurations: {
    CPTemplateApplicationDashboardSceneSessionRoleApplication: [
      {
        UISceneClassName: 'CPTemplateApplicationDashboardScene',
        UISceneConfigurationName: 'CarPlayDashboard',
        UISceneDelegateClassName: 'DashboardSceneDelegate',
      },
    ],
    CPTemplateApplicationInstrumentClusterSceneSessionRoleApplication: [
      {
        UISceneClassName: 'CPTemplateApplicationInstrumentClusterScene',
        UISceneConfigurationName: 'CarPlayCluster',
        UISceneDelegateClassName: 'ClusterSceneDelegate',
      },
    ],
    CPTemplateApplicationSceneSessionRoleApplication: [
      {
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneConfigurationName: 'CarPlayHeadUnit',
        UISceneDelegateClassName: 'HeadUnitSceneDelegate',
      },
    ],
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneClassName: 'UIWindowScene',
        UISceneConfigurationName: 'WindowApplication',
        UISceneDelegateClassName: 'WindowApplicationSceneDelegate',
      },
    ],
  },
};

const GET_ROOT_VIEW = `
  @objc func getRootViewForAutoplay(
    moduleName: String,
    initialProperties: [String: Any]?
  ) -> UIView? {
    if RCTIsNewArchEnabled() {
      if let factory = reactNativeFactory?.rootViewFactory as? ExpoReactRootViewFactory {
        return factory.superView(
          withModuleName: moduleName,
          initialProperties: initialProperties,
          launchOptions: nil
        )
      }

      return reactNativeFactory?.rootViewFactory.view(
        withModuleName: moduleName,
        initialProperties: initialProperties
      )
    }

    if let rootView = window?.rootViewController?.view as? RCTRootView {
      return RCTRootView(
        bridge: rootView.bridge,
        moduleName: moduleName,
        initialProperties: initialProperties
      )
    }

    return nil
  }
`;

function withCarPlay(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return c;
  });
  config = withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.carplay-driving-task'] = true;
    return c;
  });
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withCarPlay: expected a Swift AppDelegate (Expo SDK 57 default)');
    }
    if (!c.modResults.contents.includes('getRootViewForAutoplay')) {
      const anchor = /class AppDelegate[^{]*\{/;
      if (!anchor.test(c.modResults.contents)) {
        throw new Error('withCarPlay: AppDelegate class declaration not found');
      }
      c.modResults.contents = c.modResults.contents.replace(anchor, (m) => `${m}\n${GET_ROOT_VIEW}`);
    }
    return c;
  });
  return config;
}

module.exports = withCarPlay;
```

- [ ] **Step 4: Wire into `app.json`**

In the `plugins` array, after `"expo-notifications"`, add:

```json
      "./plugins/withCarPlay"
```

- [ ] **Step 5: Verify plugin executes**

Run: `npx expo config --type introspect > /dev/null && echo PLUGIN_OK`
Expected: `PLUGIN_OK` (introspection runs Info.plist/entitlements mods; a failure inside the plugin throws here). Note: `withAppDelegate` is a dangerous mod and only runs during real `prebuild` — introspection passing does NOT validate the Swift patch; that stays blind.

Run: `npx tsc --noEmit` → green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json patches plugins/withCarPlay.js app.json
git commit -m "feat: carplay native scaffolding — deps, splash patch, config plugin

Why: library ships no Expo plugin, so scene manifest + driving-task
entitlement + AppDelegate hook must be injected locally or prebuild
wipes them. RN timer patch (0.83.5) deliberately skipped: does not apply
to RN 0.86 — consequence documented in ADR-0029."
```

---

### Task 7: CarPlay module + index wiring

**Files:**
- Create: `src/carplay/carPlayItems.ts`
- Create: `src/carplay/registerCarPlay.ts`
- Create: `src/carplay/index.ts`
- Modify: `index.ts`

**Interfaces:**
- Consumes: `getLiveData` / `getLiveScore` (Task 2); `HybridAutoPlay`, `InformationTemplate`, type `InformationItems` from `@iternio/react-native-auto-play` (Task 6).
- Produces: `tryRegisterCarPlay(): void` called once from `index.ts`.

- [ ] **Step 1: Create `src/carplay/carPlayItems.ts`**

```ts
// CarPlay 4 行内容(iOS InformationTemplate 上限 4 行,无图)。纯函数于 store 之上,
// 不 import 任何原生模块 — type-only import 编译期擦除。
import type { InformationItems } from '@iternio/react-native-auto-play';
import { getLiveData } from '../data/liveDataStore';
import { getLiveScore } from '../data/liveScoreStore';

const fmt = (v: number | undefined, unit: string) =>
  v == null ? '—' : `${Math.round(v * 10) / 10} ${unit}`;

export function buildCarPlayItems(): InformationItems {
  const live = getLiveData();
  const score = getLiveScore();
  if (!live.streaming) {
    return [
      {
        type: 'text',
        title: { text: 'Not connected' },
        detailedText: { text: 'Start driving to begin a trip' },
      },
    ];
  }
  const durMin = live.startedAt ? Math.floor((Date.now() - live.startedAt) / 60000) : 0;
  return [
    score
      ? {
          type: 'text',
          title: { text: `Score: ${score.score}${score.stale ? ' (stale)' : ''}` },
          detailedText: { text: score.problem },
        }
      : {
          type: 'text',
          title: { text: 'Score: —' },
          detailedText: { text: 'First analysis after 5 minutes' },
        },
    { type: 'text', title: { text: 'Coolant' }, detailedText: { text: fmt(live.values.coolant, '°C') } },
    { type: 'text', title: { text: 'Fuel trim (LTFT)' }, detailedText: { text: fmt(live.values.ltft, '%') } },
    { type: 'text', title: { text: 'Trip' }, detailedText: { text: `${durMin} min · ${fmt(live.distanceKm, 'km')}` } },
  ];
}
```

- [ ] **Step 2: Create `src/carplay/registerCarPlay.ts`**

```ts
// CarPlay 单屏仪表。10 秒节流是 Apple driving-task 硬规则(CarPlay Developer
// Guide 2026-06:「Do not periodically refresh data items … more than once every
// 10 seconds」)— 不许调快。模板只能在 didConnect 内构造/挂载(库无排队机制)。
import { HybridAutoPlay, InformationTemplate } from '@iternio/react-native-auto-play';
import { buildCarPlayItems } from './carPlayItems';

const REFRESH_MS = 10_000;

export function registerCarPlay(): void {
  let template: InformationTemplate | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  HybridAutoPlay.addListener('didConnect', () => {
    template = new InformationTemplate({ title: { text: 'Blackbox' }, items: buildCarPlayItems() });
    template.setRootTemplate();
    timer = setInterval(() => {
      void template?.updateItems(buildCarPlayItems());
    }, REFRESH_MS);
  });

  HybridAutoPlay.addListener('didDisconnect', () => {
    if (timer) clearInterval(timer);
    timer = null;
    template = null;
  });
}
```

If tsc reports mismatches against the library's real types (e.g. `updateItems` name, listener signature, config fields), adapt THIS file to the library's `.d.ts` — the library's types win; do not silence with `any`. Report the deviation in your report file.

- [ ] **Step 3: Create `src/carplay/index.ts`**

```ts
// 库 + RN 0.86 组合未经验证(ADR-0029)。动态 import:原生模块缺失/初始化炸掉时
// 降级为无 CarPlay,不拖垮手机 app。
export function tryRegisterCarPlay(): void {
  import('./registerCarPlay')
    .then((m) => m.registerCarPlay())
    .catch((e) => console.log(`[carplay] 初始化失败,降级无 CarPlay: ${e}`));
}
```

- [ ] **Step 4: Wire `index.ts`** — add import and call so the file becomes:

```ts
import { registerRootComponent } from 'expo';

import App from './App';
import { initTripStore } from './src/data/tripStore';
import { initSettingsStore } from './src/data/settingsStore';
import { initNotifications } from './src/notifications/notify';
import { initOutlookStore } from './src/data/outlookStore';
import { tryRegisterCarPlay } from './src/carplay';

void initSettingsStore().then(() => Promise.all([initTripStore(), initNotifications(), initOutlookStore()]));
tryRegisterCarPlay();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
```

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit` → green.

```bash
git add src/carplay index.ts
git commit -m "feat: carplay dashboard module (blind-written, awaiting entitlement)

Why: template must be constructed inside didConnect (library has no
queueing — earlier setRootTemplate is a silent no-op); dynamic import
keeps a broken native module from crashing the phone app."
```

---

### Task 8: AGENTS.md (L1) + ADR-0029 + README entitlement guide

**Files:**
- Modify: `AGENTS.md` (Tech stack — L1, stanyan consented in session 2026-07-24; Where to find things — L2)
- Create: `docs/adr/0029-carplay-dashboard-and-live-score.md`
- Modify: `README.md`

- [ ] **Step 1: AGENTS.md Tech stack** — after the line ending `…@react-native-async-storage/async-storage(小型 KV)`, add:

```markdown
- CarPlay:@iternio/react-native-auto-play + react-native-nitro-modules(新架构 Nitro);patch-package(expo-splash-screen 场景补丁);本地 config plugin `plugins/withCarPlay.js`。CarPlay 层未经验证——等 entitlement(ADR-0029);CarPlay 行刷新 ≥10 秒(Apple driving-task 规则)
```

In 「Where to find things」, after the `src/analysis/` line, add:

```markdown
- `src/carplay/` — CarPlay 仪表盘(InformationTemplate 4 行,10 秒刷新)
```

- [ ] **Step 2: Create `docs/adr/0029-carplay-dashboard-and-live-score.md`**

```markdown
# 0029 — CarPlay 仪表盘 + 5 分钟滚动 LLM 评分

日期:2026-07-24 · 状态:已接受(L1,stanyan 会话内同意)

## 背景

Sub-project D(spec:docs/superpowers/specs/2026-07-24-sub-project-D-carplay-live-score-design.md):
CarPlay 显示发动机评分与慢变量;行程期间每 5 分钟调 MiniMax M3 产出
{score 0-100, problem 5-20 英文词}。

## 决策

1. **库:@iternio/react-native-auto-play**。birkir 上游与 g4rb4g3 fork 均已归档
   (2026-02),本库是同一批维护者的官方后继(新架构 only,Nitro Modules,自带
   scene delegate)。备选「手写 Swift native module」在后继库死掉时启用。
2. **盲写**。Apple CarPlay Developer Guide(2026-06):模拟器也要 entitlement
   provisioning——批前无法运行任何 CarPlay 界面。验收降级为 tsc + 手机 build
   可启动;渲染验证挂起等 entitlement。前提失效(申请被拒)→ 转手机横屏仪表盘。
3. **10 秒刷新节流**。driving-task 类硬规则:「Do not periodically refresh data
   items in the CarPlay UI more than once every 10 seconds (for example, no
   real-time engine data)」。因此 CarPlay 不显示转速/车速(10 秒粒度无意义),
   显示分数/水温/LTFT/行程。
4. **跳过上游 react-native+0.83.5.patch 与 buildReactNativeFromSource**。补丁钉
   0.83.5,对 RN 0.86 不可应用。后果:锁屏且无 CarPlay 时 JS 定时器可能暂停,
   5 分钟评分会顺延——BLE 事件实际维持调度,影响有限。RN 版本更近时重评。
5. **评分引擎独立于行程终局分析**(analyzeTrip 不动):独立 prompt、独立校验
   (clamp + 词数)、结果进 liveScoreStore,行程终结整线并入 TripRecord.scoreTimeline。

## 后果

- 新依赖 4 个(auto-play/nitro/patch-package/本地 plugin),Tech stack L1 更新。
- app 变 UIScene 应用:expo-splash-screen 需补丁;手机侧启动路径经库的
  WindowApplicationSceneDelegate——手机 build 启动验证是本轮必做项。
- RN 0.86 × 库组合无人验证:任何 CarPlay 崩溃先查 nitro/scene 兼容性再查业务码。
```

- [ ] **Step 3: README** — add a section (before 「已知风险」 if present, else at the end):

```markdown
## CarPlay entitlement 申请(stanyan 手动)

1. https://developer.apple.com/carplay → 申请 **CarPlay driving task app**
   (`com.apple.developer.carplay-driving-task`,iOS 16+)。
2. 说明用途:行车中查看发动机健康评分与冷却液温度等慢变量(10 秒以上刷新,
   合规 driving-task 模板 UI,无自定义界面)。审批数周,可能被拒。
3. 批准后:Apple Developer 后台给 App ID 勾选 CarPlay capability,重新生成
   provisioning profile,Xcode 导入,然后 `npx expo run:ios --device` 重建。
4. 验证清单(批前无法执行,连 CarPlay Simulator 都要 entitlement):模板挂载、
   10 秒行刷新、未连接空态、断开 CarPlay 后手机 app 正常。
```

- [ ] **Step 4: Gate + commit**

Run: `npx tsc --noEmit` → green.

```bash
git add AGENTS.md docs/adr/0029-carplay-dashboard-and-live-score.md README.md
git commit -m "docs: ADR-0029 carplay + live score; AGENTS.md tech stack (L1, consented); README entitlement guide

Why: L1 tech-stack change requires ADR + explicit consent (given in
session 2026-07-24); entitlement application is a stanyan-only manual
step and must survive session boundaries."
```

---

## Verification after all tasks (controller)

1. `npx tsc --noEmit` green; `npx tsx scripts/test-livescore.ts` ALL OK.
2. PR checklist (phone side, device): dev client rebuild `npx expo run:ios --device` (new native modules + scene manifest — old client will crash / splash may stick without rebuild); phone app boots through the new scene path; trip ≥ 5 min with API key → Home card shows score; trip end → TripDetail shows 实时评分 chart; no-key path → no card until key set, stale marking works.
3. CarPlay items in the PR marked 「未经验证——等 entitlement」.
4. PR references the Task issue; merge closes it (merge commit, never squash).

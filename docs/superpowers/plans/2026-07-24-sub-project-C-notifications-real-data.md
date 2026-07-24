# Sub-project C — 连接通知 + 全量真数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BLE 连接/断开本地通知(20s 宽限)+ 行程录制持久化 + 趋势本地聚合 + minimax LLM 行程报告/Outlook,清空 `mock.ts` 假数据。

**Architecture:** `LiveSessionProvider` 内挂 TripRecorder(行程跨重连存活,断开 20s 宽限超时才结束);行程结束提特征存 `Paths.document/trips/*.json`(expo-file-system 新 File/Directory API),UI hooks 经各 store 的 subscribe/useSyncExternalStore 读真数据;分析管线复用 `src/analysis/{features,minimax}.ts`,新增 Outlook 聚合调用。

**Tech Stack:** Expo ~57 dev client / RN 0.86 / TS ~6.0 / expo-notifications(新增)/ expo-file-system ~57.0.0(已装)/ expo-secure-store ~57.0.0(已装)/ @react-native-async-storage/async-storage(新增)/ MiniMax-M3。

## Global Constraints

- Expo API 用法一律以 https://docs.expo.dev/versions/v57.0.0/ 为准(AGENTS.md 硬规则)。本计划中的 expo-notifications / expo-file-system / expo-secure-store 代码已对照 v57 docs;实现时若发现 API 对不上,以 docs 为准并在 PR 里注明
- expo-file-system 用**新 API**(`import { File, Directory, Paths } from 'expo-file-system'`),不用 `/legacy`
- 门禁:`npx tsc --noEmit` 全绿才能 commit 收尾
- BLE/通知行为不能只靠 tsc 宣布完成:真机验证,或 PR 标注「未经真机验证」+ 清单(硬规则)
- 纯函数(metrics/trends/display/series/verdict)离线测试走 `scripts/test-*.ts`,`npx tsx` 跑,断言失败 `process.exit(1)`
- 通知文案/UI 文案简体中文;代码注释风格跟随现有文件(中文,讲 why)
- 协议:本任务对应 Task issue,分支 + PR,merge commit(ADR-0007);AGENTS.md Tech stack 变更 = L1,stanyan 已在 2026-07-24 会话中同意,ADR + PR 里注明

**常量(全计划统一):**
- 断开宽限:`GRACE_MS = 20_000`
- 行程丢弃门槛:时长 < 60_000 ms 或样本 < 20 条
- 降采样:每通道 ≤ 120 点
- SecureStore key 名:`minimax_key`;AsyncStorage:`settings.v1` / `vehicle.v1`;Outlook 文件:`Paths.document/outlook.json`;行程目录:`Paths.document/trips/`

---

### Task 1: 协议开工 — Task issue、分支、依赖、ADR、AGENTS.md(L1)

**Files:**
- Create: `docs/adr/0028-local-persistence-and-notifications.md`
- Modify: `AGENTS.md`(Tech stack 节)
- Modify: `app.json`(plugins 加 `expo-notifications`)
- Modify: `package.json`(经 `npx expo install`)

**Interfaces:**
- Consumes: 无
- Produces: 依赖就位(expo-notifications、@react-native-async-storage/async-storage);后续任务在分支 `feat/sub-project-c` 上工作

- [ ] **Step 1: 开 Task issue + 分支**

```bash
gh issue create --title "Task:sub-project C — 连接通知 + 全量真数据(行程持久化/趋势/LLM 分析)" \
  --body "Spec: docs/superpowers/specs/2026-07-24-sub-project-C-notifications-real-data-design.md
Plan: docs/superpowers/plans/2026-07-24-sub-project-C-notifications-real-data.md
L1 新依赖已获 stanyan 会话内同意(2026-07-24)。PR merge 时关闭本 issue。"
git checkout -b feat/sub-project-c
```

- [ ] **Step 2: 安装依赖**

```bash
npx expo install expo-notifications @react-native-async-storage/async-storage
```

预期:package.json 出现 `expo-notifications` 与 `@react-native-async-storage/async-storage`,版本由 expo 选定。

- [ ] **Step 3: app.json plugins 加 expo-notifications**

`app.json` 的 `expo.plugins` 数组末尾追加(v57 docs 要求 config plugin):

```json
    "plugins": [
      [
        "react-native-ble-plx",
        {
          "isBackgroundEnabled": true,
          "modes": ["central"],
          "bluetoothAlwaysPermission": "Connects to your OBDLink CX adapter to read engine data."
        }
      ],
      "expo-sharing",
      "expo-secure-store",
      "expo-notifications"
    ],
```

- [ ] **Step 4: 写 ADR-0028**

`docs/adr/0028-local-persistence-and-notifications.md`(格式对照 `docs/adr/0027-background-ble-and-autoconnect.md`):

```markdown
# 0028 — 本地持久化选文件不选数据库;通知走纯本地

日期:2026-07-24
状态:已接受(stanyan 会话内同意,L1)

## 背景

Sub-project C 要把 mock 数据换真:行程要落盘,连接/断开要通知。存储三选一
(expo-file-system JSON / expo-sqlite / AsyncStorage),通知二选一(本地 / 远程 push)。

## 决策

1. 行程持久化用 expo-file-system 新 API,每行程一个 JSON 文件 + index.json;
   不引数据库。
2. 通知用 expo-notifications 纯本地通知,不做 APNs/FCM。
3. 新增依赖:expo-notifications、@react-native-async-storage/async-storage
   (小型设置/车辆信息);连同已装的 expo-file-system / expo-secure-store 一起
   写进 AGENTS.md Tech stack(L1 变更,stanyan 2026-07-24 会话内同意)。

## 理由

- 个人工具,几百行程量级,文件足够;SQLite 是没有查询需求前的过度设计,
  且技术栈仍守「无后端、无数据库」
- 通知触发源(BLE 状态机)在本机,本地通知零基建;远程 push 需要后端,违背范围
- AsyncStorage 只放小 KV(设置/车辆),行程数据不进(Android ~6MB 上限)

## 什么前提失效时该推翻

- 行程量或查询需求(按条件筛选/聚合)超出文件线性扫描承受 → 迁 expo-sqlite
- 需要"车在楼下被撬"类离车告警 → 那要远程 push + 常驻硬件,另立项目
```

- [ ] **Step 5: AGENTS.md Tech stack 更新(L1,已获同意)**

Tech stack 节中:

```markdown
- 无后端、无数据库;session 数据走 share sheet 导出 JSON
```

改为:

```markdown
- 无后端、无数据库;行程数据本地持久化(expo-file-system JSON,ADR-0028),导出走 share sheet
- expo-notifications(本地通知)/ expo-secure-store(API key)/ @react-native-async-storage/async-storage(小型 KV)
```

- [ ] **Step 6: 门禁 + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "chore(c): deps + ADR-0028 + AGENTS.md tech stack (L1, stanyan 会话内同意)

expo-notifications(本地通知,config plugin 进 app.json)+ async-storage(小 KV)。
持久化选文件不选 DB,理由见 ADR-0028。"
```

---

### Task 2: 类型层 — `src/data/types.ts` 取代 mock 类型 + TripRecord

**Files:**
- Create: `src/data/types.ts`
- Modify: `src/data/mock.ts`(类型改为 re-export,MOCK 暂留,Task 10 删)

**Interfaces:**
- Consumes: `TripFeatures`(`src/analysis/features.ts`)、`TripReport`(`src/analysis/minimax.ts`)
- Produces: 全部 UI/存储类型。后续任务 import 自 `../data/types`:
  - `Tone`, `Finding`, `Vehicle`, `LivePid`, `Trip`, `Trend`, `Outlook`(与 mock.ts 现有同名接口字段一致,`Trip.route`/`featured` 改可选)
  - `TripRecord`(存储型):见下
  - `TripMetrics`:`{ ltftMean: number | null; warmupMin: number | null; idleRpm: number | null; cold: boolean }`
  - `SeriesPoint`:`{ t: number; v: number }`
  - `TripIndexEntry`:`{ id: string; startedAt: number; durationMin: number; distanceKm: number; verdict: Tone; analyzed: boolean }`

- [ ] **Step 1: 写 `src/data/types.ts`**

```ts
// 数据类型单一来源。UI 展示型(原 mock.ts)+ 存储型(TripRecord)都在这。
import type { TripFeatures } from '../analysis/features';
import type { TripReport } from '../analysis/minimax';

export type Tone = 'good' | 'watch' | 'inspect' | 'info';

export interface Finding {
  tone: Tone;
  title: string;
  detail: string;
  action?: string;
}

export interface Vehicle {
  name: string;
  model: string;
  engine: string;
  plate: string;
  /** 里程基线(用户填)。展示 odo = odo + 累计行程里程。 */
  odo: number;
  adapter: string;
}

export interface LivePid {
  key: string;
  label: string;
  unit: string;
  idle: number | null;
  drive: number | null;
  jitter: number;
  note?: string;
}

/** UI 展示型行程 — 由 TripRecord 经 display.ts 派生,字段对齐原 mock。 */
export interface Trip {
  id: string;
  group: string;
  time: string;
  title: string;
  dur: number;
  dist: number;
  verdict: Tone;
  cold: boolean;
  maxCoolant: number;
  avgRpm: number;
  ltft: number;
  stft: number;
  samples: number;
  route?: string;
  summary: string;
  findings: Finding[];
  featured?: boolean;
  /** false = LLM 未分析(无 key/失败),TripDetail 显示重试。 */
  analyzed: boolean;
}

export interface Trend {
  label: string;
  unit: string;
  now: number;
  dir: 'up' | 'down' | 'flat';
  tone: Tone;
  note: string;
  series: number[];
  /** 横轴标签 — 真数据下是行程日期(M/D)或周序,不再限定"月"。 */
  months: string[];
}

export interface Outlook {
  score: number;
  verdictLabel: string;
  verdictTone: Tone;
  headline: string;
  current: Finding[];
  future: Finding[];
  normal: string[];
}

export interface SeriesPoint {
  t: number; // ms since trip start
  v: number;
}

export interface TripMetrics {
  /** ltft_b1 全程均值;车不给该 PID 时 null。 */
  ltftMean: number | null;
  /** 冷启动到 80°C 用时(分钟);非冷启动/没到 80 则 null。 */
  warmupMin: number | null;
  /** 怠速段(speed==0 且 rpm>300)rpm 均值;无怠速段 null。 */
  idleRpm: number | null;
  cold: boolean;
}

/** 存储型行程 — trips/<id>.json 的文件内容。 */
export interface TripRecord {
  id: string; // String(startedAt)
  startedAt: number; // epoch ms
  endedAt: number;
  durationMin: number;
  distanceKm: number;
  samples: number;
  metrics: TripMetrics;
  features: TripFeatures;
  /** 降采样曲线,每通道 ≤120 点,画图用。key = PID key(rpm/coolant_temp/…)。 */
  series: Record<string, SeriesPoint[]>;
  /** null = 未分析(无 key / 调用失败)。 */
  report: TripReport | null;
  verdict: Tone;
}

export interface TripIndexEntry {
  id: string;
  startedAt: number;
  durationMin: number;
  distanceKm: number;
  verdict: Tone;
  analyzed: boolean;
}
```

- [ ] **Step 2: mock.ts 类型段改 re-export**

`src/data/mock.ts` 顶部的 `Vehicle/LivePid/Tone/Finding/Trip/Trend/Outlook` 接口定义整段删除,换成:

```ts
// 类型已迁 src/data/types.ts;MOCK 数据将在 sub-project C 收尾时删除。
export type { Vehicle, LivePid, Tone, Finding, Trip, Trend, Outlook } from './types';
import type { Vehicle, LivePid, Trip, Trend, Outlook } from './types';
```

MOCK 常量原样保留(`satisfies` 引用不变)。注意:`Trip.route` 现在可选、多了 `analyzed`——MOCK.trips 每条加 `analyzed: true`(satisfies 才过)。

- [ ] **Step 3: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/data/types.ts src/data/mock.ts
git commit -m "refactor(c): 类型迁 src/data/types.ts,新增 TripRecord/TripMetrics 存储型

mock.ts 只剩数据,类型 re-export 保持旧 import 路径暂时可用;MOCK 收尾时删。"
```

---

### Task 3: 纯函数 — series 降采样 + tripMetrics

**Files:**
- Create: `src/analysis/series.ts`
- Create: `src/analysis/tripMetrics.ts`
- Test: `scripts/test-trip-pure.ts`

**Interfaces:**
- Consumes: `Sample`(`src/obd/ElmSession.ts`)、`SeriesPoint`/`TripMetrics`(`src/data/types.ts`)
- Produces:
  - `buildSeries(samples: Sample[], maxPointsPerChannel?: number): Record<string, SeriesPoint[]>`(默认 120)
  - `computeMetrics(samples: Sample[]): TripMetrics`

- [ ] **Step 1: 写失败测试 `scripts/test-trip-pure.ts`**

```ts
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
```

- [ ] **Step 2: 跑,确认 fail**

Run: `npx tsx scripts/test-trip-pure.ts`
Expected: 模块不存在报错(Cannot find module '../src/analysis/series')。

- [ ] **Step 3: 实现 `src/analysis/series.ts`**

```ts
import { Sample } from '../obd/ElmSession';
import { SeriesPoint } from '../data/types';

/** 均匀抽点降采样,保首尾。画趋势小图够用,不需要 LTTB。 */
export function buildSeries(samples: Sample[], maxPointsPerChannel = 120): Record<string, SeriesPoint[]> {
  const byKey = new Map<string, SeriesPoint[]>();
  for (const s of samples) {
    const arr = byKey.get(s.key) ?? [];
    arr.push({ t: s.t, v: s.value });
    byKey.set(s.key, arr);
  }
  const out: Record<string, SeriesPoint[]> = {};
  for (const [key, pts] of byKey) {
    if (pts.length <= maxPointsPerChannel) {
      out[key] = pts;
      continue;
    }
    const step = (pts.length - 1) / (maxPointsPerChannel - 1);
    const picked: SeriesPoint[] = [];
    for (let i = 0; i < maxPointsPerChannel; i++) {
      picked.push(pts[Math.round(i * step)]);
    }
    out[key] = picked;
  }
  return out;
}
```

- [ ] **Step 4: 实现 `src/analysis/tripMetrics.ts`**

```ts
import { Sample } from '../obd/ElmSession';
import { TripMetrics } from '../data/types';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** 行程级指标,存盘时算一次,趋势聚合直接读。纯函数。 */
export function computeMetrics(samples: Sample[]): TripMetrics {
  const coolant = samples.filter((s) => s.key === 'coolant_temp');
  const ltft = samples.filter((s) => s.key === 'ltft_b1');

  const cold = coolant.length > 0 && coolant[0].value < 60;

  let warmupMin: number | null = null;
  if (cold) {
    const hit = coolant.find((s) => s.value >= 80);
    if (hit) warmupMin = round1((hit.t - coolant[0].t) / 60000);
  }

  // 怠速段:同一时刻 speed==0 且 rpm>300(发动机在转)。样本不同 PID 不同时刻,
  // 用最近车速判定:按 t 归并,车速为 0 的窗口内的 rpm 算怠速。
  const speeds = samples.filter((s) => s.key === 'speed').sort((a, b) => a.t - b.t);
  const rpms = samples.filter((s) => s.key === 'rpm');
  const idleRpms: number[] = [];
  for (const r of rpms) {
    if (r.value <= 300) continue;
    // 找 r.t 之前最近的车速读数
    let last: Sample | null = null;
    for (const sp of speeds) {
      if (sp.t > r.t) break;
      last = sp;
    }
    if (last && last.value === 0) idleRpms.push(r.value);
  }

  return {
    ltftMean: ltft.length > 0 ? round1(mean(ltft.map((s) => s.value))) : null,
    warmupMin,
    idleRpm: idleRpms.length > 0 ? Math.round(mean(idleRpms)) : null,
    cold,
  };
}
```

- [ ] **Step 5: 跑测试确认 PASS**

Run: `npx tsx scripts/test-trip-pure.ts`
Expected: `PASS test-trip-pure`

- [ ] **Step 6: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/analysis/series.ts src/analysis/tripMetrics.ts scripts/test-trip-pure.ts
git commit -m "feat(c): 行程降采样 + 行程指标纯函数,离线测试可跑

metrics 存盘时算一次,趋势层不再碰原始样本。"
```

---

### Task 4: 纯函数 — verdict 映射 + 展示派生(display)

**Files:**
- Create: `src/analysis/verdict.ts`
- Create: `src/data/display.ts`
- Test: `scripts/test-display.ts`

**Interfaces:**
- Consumes: `TripFeatures`、`TripReport`、`TripRecord`、`Trip`、`Finding`、`Tone`(types.ts)
- Produces:
  - `verdictFromTrip(features: TripFeatures, report: TripReport | null): Tone`
  - `reportToFindings(report: TripReport): Finding[]`(severity→tone,finding→title,evidence.join('；')→detail,suggested_action→action)
  - `tripToDisplay(r: TripRecord, now?: number): Trip`(group:今天/昨天/M月D日;time:HH:MM;title:清晨行程/上午行程/下午行程/晚间行程/夜间行程;未分析时 summary='本次行程尚未生成 AI 报告。',findings=[])

- [ ] **Step 1: 写失败测试 `scripts/test-display.ts`**

```ts
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
```

- [ ] **Step 2: 跑,确认 fail**

Run: `npx tsx scripts/test-display.ts`
Expected: Cannot find module '../src/analysis/verdict'

- [ ] **Step 3: 实现 `src/analysis/verdict.ts`**

```ts
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
```

- [ ] **Step 4: 实现 `src/data/display.ts`**

```ts
import { Trip, TripRecord } from './types';
import { reportToFindings } from '../analysis/verdict';

const pad = (n: number) => String(n).padStart(2, '0');

function titleForHour(h: number): string {
  if (h < 6) return '夜间行程';
  if (h < 9) return '清晨行程';
  if (h < 12) return '上午行程';
  if (h < 18) return '下午行程';
  if (h < 23) return '晚间行程';
  return '夜间行程';
}

function groupFor(startedAt: number, now: number): string {
  const d = new Date(startedAt);
  const n = new Date(now);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(n) - dayStart(d)) / 86_400_000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 存储型 → UI 展示型。无 GPS,route 不给;标题按时段生成,中性词。 */
export function tripToDisplay(r: TripRecord, now: number = Date.now()): Trip {
  const d = new Date(r.startedAt);
  const ch = (key: string) => r.features.channels.find((c) => c.key === key);
  return {
    id: r.id,
    group: groupFor(r.startedAt, now),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    title: titleForHour(d.getHours()),
    dur: Math.round(r.durationMin),
    dist: Math.round(r.distanceKm * 10) / 10,
    verdict: r.verdict,
    cold: r.metrics.cold,
    maxCoolant: ch('coolant_temp')?.max ?? 0,
    avgRpm: Math.round(ch('rpm')?.mean ?? 0),
    ltft: r.metrics.ltftMean ?? 0,
    stft: ch('stft_b1')?.mean ?? 0,
    samples: r.samples,
    summary: r.report?.summary ?? '本次行程尚未生成 AI 报告。',
    findings: r.report ? reportToFindings(r.report) : [],
    analyzed: r.report !== null,
  };
}
```

- [ ] **Step 5: 跑测试确认 PASS**

Run: `npx tsx scripts/test-display.ts`
Expected: `PASS test-display`

- [ ] **Step 6: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/analysis/verdict.ts src/data/display.ts scripts/test-display.ts
git commit -m "feat(c): verdict 映射 + TripRecord→UI 派生

red 规则告警恒 inspect,LLM 不可降级;标题按时段生成,无 GPS 不再编 route。"
```

---

### Task 5: 纯函数 — 趋势聚合 `src/data/trends.ts`

**Files:**
- Create: `src/data/trends.ts`
- Test: `scripts/test-trends.ts`

**Interfaces:**
- Consumes: `TripRecord`、`Trend`(types.ts)
- Produces:
  - `export type TrendKey = 'ltft' | 'warmup' | 'idle' | 'cold'`
  - `buildTrends(records: TripRecord[], now?: number): Record<TrendKey, Trend>`——ltft/warmup/idle 取最近 ≤12 个有值行程(按 startedAt 升序),label 用 `M/D`;cold 按周聚合最近 ≤8 周,label `W-n`(n 周前,当周 `本周`)。数据不足时 series 为空数组,`note='数据积累中'`,`now=0`
  - `hasEnough(tr: Trend): boolean`(series.length ≥ 2)

- [ ] **Step 1: 写失败测试 `scripts/test-trends.ts`**

```ts
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
```

- [ ] **Step 2: 跑,确认 fail**

Run: `npx tsx scripts/test-trends.ts`
Expected: Cannot find module '../src/data/trends'

- [ ] **Step 3: 实现 `src/data/trends.ts`**

```ts
// 趋势 = 已存行程的本地聚合,纯函数。行程少时如实显示,不硬凑月份。
import { Trend, TripRecord } from './types';

export type TrendKey = 'ltft' | 'warmup' | 'idle' | 'cold';

const MAX_POINTS = 12;
const MAX_WEEKS = 8;

const label = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function emptyTrend(labelText: string, unit: string): Trend {
  return { label: labelText, unit, now: 0, dir: 'flat', tone: 'info', note: '数据积累中', series: [], months: [] };
}

function dirOf(series: number[], eps: number): 'up' | 'down' | 'flat' {
  if (series.length < 2) return 'flat';
  const d = series[series.length - 1] - series[series.length - 2];
  if (d > eps) return 'up';
  if (d < -eps) return 'down';
  return 'flat';
}

function perTrip(
  records: TripRecord[],
  labelText: string,
  unit: string,
  pick: (r: TripRecord) => number | null,
  tone: (now: number) => Trend['tone'],
  note: (now: number) => string,
  eps: number,
): Trend {
  const pts = records
    .map((r) => ({ t: r.startedAt, v: pick(r) }))
    .filter((p): p is { t: number; v: number } => p.v !== null)
    .sort((a, b) => a.t - b.t)
    .slice(-MAX_POINTS);
  if (pts.length < 2) return emptyTrend(labelText, unit);
  const series = pts.map((p) => round1(p.v));
  const now = series[series.length - 1];
  return {
    label: labelText, unit, now,
    dir: dirOf(series, eps),
    tone: tone(now), note: note(now),
    series, months: pts.map((p) => label(p.t)),
  };
}

export function buildTrends(records: TripRecord[], now: number = Date.now()): Record<TrendKey, Trend> {
  const ltft = perTrip(
    records, '长期燃油修正', '%',
    (r) => r.metrics.ltftMean,
    (v) => (Math.abs(v) >= 8 ? 'inspect' : Math.abs(v) >= 5 ? 'watch' : 'good'),
    (v) => (Math.abs(v) >= 5 ? '偏高,需留意变化' : '在正常范围内'),
    0.3,
  );
  const warmup = perTrip(
    records, '水温达工作温度用时', 'min',
    (r) => r.metrics.warmupMin,
    (v) => (v > 12 ? 'watch' : 'good'),
    (v) => (v > 12 ? '升温偏慢,留意节温器' : '升温正常,冷却系统健康'),
    0.5,
  );
  const idle = perTrip(
    records, '怠速转速', 'rpm',
    (r) => r.metrics.idleRpm,
    (v) => (v >= 600 && v <= 1000 ? 'good' : 'watch'),
    (v) => (v >= 600 && v <= 1000 ? '怠速平稳' : '怠速偏离常见区间'),
    30,
  );

  // 冷启动:按周计数,最近 MAX_WEEKS 周。周锚点 = now 所在周的周一 0 点。
  const nowD = new Date(now);
  const dayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
  const dow = (nowD.getDay() + 6) % 7; // 周一=0
  const thisMonday = dayStart - dow * 86_400_000;
  const counts: number[] = Array(MAX_WEEKS).fill(0);
  let seen = 0;
  for (const r of records) {
    const weeksAgo = Math.floor((thisMonday + 7 * 86_400_000 - 1 - r.startedAt) / (7 * 86_400_000));
    if (weeksAgo < 0 || weeksAgo >= MAX_WEEKS) continue;
    if (r.metrics.cold) counts[MAX_WEEKS - 1 - weeksAgo]++;
    seen++;
  }
  // 找到最早有行程的那周,只显示从那周起的区间
  const oldestWeek = records.length
    ? Math.min(MAX_WEEKS - 1, Math.floor((thisMonday + 7 * 86_400_000 - 1 - Math.min(...records.map((r) => r.startedAt))) / (7 * 86_400_000)))
    : -1;
  const cold: Trend =
    seen === 0 || oldestWeek < 1
      ? emptyTrend('每周冷启动次数', '次')
      : {
          label: '每周冷启动次数', unit: '次',
          now: counts[MAX_WEEKS - 1],
          dir: dirOf(counts.slice(MAX_WEEKS - 1 - oldestWeek), 0.5),
          tone: 'good', note: '冷启动频率,仅作参考',
          series: counts.slice(MAX_WEEKS - 1 - oldestWeek),
          months: counts.slice(MAX_WEEKS - 1 - oldestWeek).map((_, i, arr) =>
            i === arr.length - 1 ? '本周' : `${arr.length - 1 - i} 周前`,
          ),
        };

  return { ltft, warmup, idle, cold };
}

export function hasEnough(tr: Trend): boolean {
  return tr.series.length >= 2;
}
```

- [ ] **Step 4: 跑测试确认 PASS**

Run: `npx tsx scripts/test-trends.ts`
Expected: `PASS test-trends`

- [ ] **Step 5: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/data/trends.ts scripts/test-trends.ts
git commit -m "feat(c): 趋势本地聚合纯函数

按行程出点(≤12),冷启动按周(≤8);不足 2 点 → 数据积累中,不硬凑月份。"
```

---

### Task 6: tripStore — expo-file-system 持久化 + 订阅

**Files:**
- Create: `src/data/tripStore.ts`

**Interfaces:**
- Consumes: `File/Directory/Paths`(expo-file-system 新 API)、`TripRecord`/`TripIndexEntry`(types.ts)
- Produces(后续任务用):
  - `initTripStore(): Promise<void>`(建目录、载入索引、索引与目录不符时重建)
  - `saveTrip(record: TripRecord): Promise<void>`
  - `getTrip(id: string): Promise<TripRecord | null>`
  - `updateTripReport(id: string, report: TripReport, verdict: Tone): Promise<void>`
  - `getIndex(): TripIndexEntry[]`(内存缓存,时间倒序)
  - `subscribeTrips(fn: () => void): () => void`
  - `tripFileUri(id: string): string`(TripDetail 导出用)

注意:expo-file-system 是原生模块,**本文件无离线测试**,验收 = tsc + 真机清单(存盘、重启仍在)。逻辑保持薄。

- [ ] **Step 1: 实现 `src/data/tripStore.ts`**

```ts
// 行程持久化:每行程一个 JSON 文件 + index.json 缓存(ADR-0028)。
// 文件是事实源,索引只是加速;启动时校对,不符就重建。
import { Directory, File, Paths } from 'expo-file-system';
import { Tone, TripIndexEntry, TripRecord } from './types';
import { TripReport } from '../analysis/minimax';

const tripsDir = new Directory(Paths.document, 'trips');
const indexFile = new File(tripsDir, 'index.json');

let index: TripIndexEntry[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeTrips(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getIndex(): TripIndexEntry[] {
  return index;
}

export function tripFileUri(id: string): string {
  return new File(tripsDir, `${id}.json`).uri;
}

function entryOf(r: TripRecord): TripIndexEntry {
  return {
    id: r.id, startedAt: r.startedAt, durationMin: r.durationMin,
    distanceKm: r.distanceKm, verdict: r.verdict, analyzed: r.report !== null,
  };
}

function writeIndex() {
  indexFile.write(JSON.stringify(index));
}

async function rebuildIndex(): Promise<void> {
  const entries: TripIndexEntry[] = [];
  for (const item of tripsDir.list()) {
    if (!(item instanceof File) || !item.name.endsWith('.json') || item.name === 'index.json') continue;
    try {
      const rec = JSON.parse(await item.text()) as TripRecord;
      entries.push(entryOf(rec));
    } catch (e) {
      console.log(`[store] 跳过损坏行程文件 ${item.name}: ${e}`);
    }
  }
  index = entries.sort((a, b) => b.startedAt - a.startedAt);
  writeIndex();
}

export async function initTripStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    if (!tripsDir.exists) tripsDir.create();
    const fileIds = tripsDir
      .list()
      .filter((i): i is File => i instanceof File && i.name.endsWith('.json') && i.name !== 'index.json')
      .map((f) => f.name.replace(/\.json$/, ''))
      .sort();
    let cached: TripIndexEntry[] = [];
    if (indexFile.exists) {
      try {
        cached = JSON.parse(await indexFile.text());
      } catch {
        cached = [];
      }
    }
    const cachedIds = cached.map((e) => e.id).sort();
    if (JSON.stringify(fileIds) === JSON.stringify(cachedIds)) {
      index = cached.sort((a, b) => b.startedAt - a.startedAt);
    } else {
      await rebuildIndex(); // 索引和目录不符(写失败/手动删文件)→ 文件为准
    }
  } catch (e) {
    console.log(`[store] init 失败: ${e}`);
  }
  notifyListeners();
}

export async function saveTrip(record: TripRecord): Promise<void> {
  const f = new File(tripsDir, `${record.id}.json`);
  f.write(JSON.stringify(record)); // 不吞错:抛给调用方,LiveSession 记 console
  index = [entryOf(record), ...index.filter((e) => e.id !== record.id)];
  writeIndex();
  notifyListeners();
}

export async function getTrip(id: string): Promise<TripRecord | null> {
  const f = new File(tripsDir, `${id}.json`);
  if (!f.exists) return null;
  try {
    return JSON.parse(await f.text()) as TripRecord;
  } catch {
    return null;
  }
}

export async function updateTripReport(id: string, report: TripReport, verdict: Tone): Promise<void> {
  const rec = await getTrip(id);
  if (!rec) return;
  await saveTrip({ ...rec, report, verdict });
}
```

- [ ] **Step 2: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/data/tripStore.ts
git commit -m "feat(c): tripStore — 文件为事实源,index.json 只作缓存,启动校对重建

原生模块无离线测试,验收走真机清单(存盘/重启仍在)。"
```

---

### Task 7: settings / vehicle / key 存储 + hooks 换真

**Files:**
- Create: `src/data/settingsStore.ts`
- Modify: `src/hooks/useVehicle.ts`
- Modify: `src/hooks/useTrips.ts`
- Modify: `src/hooks/useTrends.ts`

**Interfaces:**
- Consumes: AsyncStorage、SecureStore、tripStore(`getIndex/subscribeTrips/getTrip`)、`buildTrends`、`tripToDisplay`
- Produces:
  - settingsStore:`AppSettings = { notifyConn: boolean; notifyDis: boolean; notifyReport: boolean; chime: boolean }`;`getSettings(): AppSettings`、`setSetting(k, v): Promise<void>`、`subscribeSettings(fn)`、`initSettingsStore(): Promise<void>`
  - vehicle:`getVehicle(): Vehicle`、`setVehicle(patch: Partial<Vehicle>): Promise<void>`、`subscribeVehicle(fn)`(默认值:`{ name: '我的车', model: '未设置', engine: '未设置', plate: '未设置', odo: 0, adapter: 'OBD 适配器' }`)
  - key:`getApiKey(): Promise<string | null>`、`setApiKey(v: string): Promise<void>`(SecureStore,key 名 `minimax_key`,空串 = 删除)
  - `useTrips(): Trip[]`(真数据,时间倒序)、`useTrends(): Record<TrendKey, Trend>`、`useVehicle(): Vehicle`——**签名不变**,消费端不用改 import
  - 新增 `useTripRecord(id: string): TripRecord | null`(TripDetail 用,放 `src/hooks/useTrips.ts` 里导出)

- [ ] **Step 1: 实现 `src/data/settingsStore.ts`**

```ts
// 小型 KV:通知开关 + 车辆信息(AsyncStorage),MiniMax key(SecureStore)。
// 行程数据不进 AsyncStorage(Android ~6MB 上限,ADR-0028)。
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Vehicle } from './types';

const SETTINGS_KEY = 'settings.v1';
const VEHICLE_KEY = 'vehicle.v1';
const API_KEY = 'minimax_key';

export interface AppSettings {
  notifyConn: boolean;
  notifyDis: boolean;
  notifyReport: boolean;
  chime: boolean;
}

const DEFAULT_SETTINGS: AppSettings = { notifyConn: true, notifyDis: true, notifyReport: true, chime: true };
const DEFAULT_VEHICLE: Vehicle = {
  name: '我的车', model: '未设置', engine: '未设置', plate: '未设置', odo: 0, adapter: 'OBD 适配器',
};

let settings: AppSettings = DEFAULT_SETTINGS;
let vehicle: Vehicle = DEFAULT_VEHICLE;
const settingsListeners = new Set<() => void>();
const vehicleListeners = new Set<() => void>();

export function subscribeSettings(fn: () => void): () => void {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}
export function subscribeVehicle(fn: () => void): () => void {
  vehicleListeners.add(fn);
  return () => vehicleListeners.delete(fn);
}
export const getSettings = () => settings;
export const getVehicle = () => vehicle;

export async function initSettingsStore(): Promise<void> {
  try {
    const [s, v] = await AsyncStorage.multiGet([SETTINGS_KEY, VEHICLE_KEY]);
    if (s[1]) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s[1]) };
    if (v[1]) vehicle = { ...DEFAULT_VEHICLE, ...JSON.parse(v[1]) };
  } catch (e) {
    console.log(`[store] settings init 失败: ${e}`);
  }
  settingsListeners.forEach((fn) => fn());
  vehicleListeners.forEach((fn) => fn());
}

export async function setSetting<K extends keyof AppSettings>(k: K, v: AppSettings[K]): Promise<void> {
  settings = { ...settings, [k]: v };
  settingsListeners.forEach((fn) => fn());
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function setVehicle(patch: Partial<Vehicle>): Promise<void> {
  vehicle = { ...vehicle, ...patch };
  vehicleListeners.forEach((fn) => fn());
  await AsyncStorage.setItem(VEHICLE_KEY, JSON.stringify(vehicle));
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY);
}

export async function setApiKey(v: string): Promise<void> {
  if (v) await SecureStore.setItemAsync(API_KEY, v);
  else await SecureStore.deleteItemAsync(API_KEY);
}
```

- [ ] **Step 2: `src/hooks/useTrips.ts` 换真**

```ts
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getIndex, getTrip, subscribeTrips } from '../data/tripStore';
import { tripToDisplay } from '../data/display';
import type { Trip, TripRecord } from '../data/types';

// 契约:返回 Trip[](时间倒序),字段对齐原 mock。底层从 MOCK 换 tripStore。
export function useTrips(): Trip[] {
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [trips, setTrips] = useState<Trip[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const recs = await Promise.all(index.map((e) => getTrip(e.id)));
      if (alive) setTrips(recs.filter((r): r is TripRecord => r !== null).map((r) => tripToDisplay(r)));
    })();
    return () => {
      alive = false;
    };
  }, [index]);
  return trips;
}

export function useTripRecord(id: string): TripRecord | null {
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [rec, setRec] = useState<TripRecord | null>(null);
  useEffect(() => {
    let alive = true;
    void getTrip(id).then((r) => alive && setRec(r));
    return () => {
      alive = false;
    };
  }, [id, index]);
  return rec;
}
```

- [ ] **Step 3: `src/hooks/useTrends.ts` 换真**

```ts
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getIndex, getTrip, subscribeTrips } from '../data/tripStore';
import { buildTrends, TrendKey } from '../data/trends';
import type { Trend, TripRecord } from '../data/types';

export type { TrendKey };

export function useTrends(): Record<TrendKey, Trend> {
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [trends, setTrends] = useState(() => buildTrends([]));
  useEffect(() => {
    let alive = true;
    void (async () => {
      const recs = await Promise.all(index.map((e) => getTrip(e.id)));
      if (alive) setTrends(buildTrends(recs.filter((r): r is TripRecord => r !== null)));
    })();
    return () => {
      alive = false;
    };
  }, [index]);
  return trends;
}
```

- [ ] **Step 4: `src/hooks/useVehicle.ts` 换真**

```ts
import { useSyncExternalStore } from 'react';
import { getVehicle, subscribeVehicle } from '../data/settingsStore';
import type { Vehicle } from '../data/types';

export function useVehicle(): Vehicle {
  return useSyncExternalStore(subscribeVehicle, getVehicle);
}
```

- [ ] **Step 5: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/data/settingsStore.ts src/hooks/useTrips.ts src/hooks/useTrends.ts src/hooks/useVehicle.ts
git commit -m "feat(c): settings/vehicle/key 存储 + trips/trends/vehicle hooks 换真数据

hook 签名不变,消费端零改动;useSyncExternalStore 订阅 store 变更。"
```

注:此刻 HomeScreen 等消费端已在读真(空)数据,History 空列表——Task 10 补空状态。

---

### Task 8: 通知模块 + LiveSession 行程录制/宽限/落盘

**Files:**
- Create: `src/notifications/notify.ts`
- Modify: `src/ble/LiveSession.tsx`
- Modify: `index.ts`(app 入口,加 init 调用)

**Interfaces:**
- Consumes: expo-notifications(v57:`setNotificationHandler/requestPermissionsAsync/scheduleNotificationAsync(trigger: null)/setNotificationChannelAsync`)、settingsStore、tripStore、`extractFeatures/buildSeries/computeMetrics/verdictFromTrip`
- Produces:
  - `initNotifications(): Promise<void>`(handler + Android channel + 权限请求;被拒静默降级)
  - `notifyConnected(adapterName: string): Promise<void>`(前台跳过;`settings.notifyConn` 关则跳过)
  - `notifyDisconnected(saved: { durMin: number; distKm: number } | null): Promise<void>`(前台跳过;`settings.notifyDis` 关则跳过;saved=null → 只报断开)
  - `notifyReportReady(tripTitle: string): Promise<void>`(`settings.notifyReport` 控制;Task 9 用)
  - LiveSession:行程跨重连存活;结束落盘并触发 `runAnalysis`(Task 9 提供,本任务先用占位 re-export 避免前向依赖——见 Step 3)

- [ ] **Step 1: 实现 `src/notifications/notify.ts`**

```ts
// 本地通知(ADR-0028):触发源是本机 BLE 状态机,不需要远程 push。
// Expo v57 docs: scheduleNotificationAsync + trigger:null = 立即投递。
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { getSettings } from '../data/settingsStore';

let permitted = false;

export async function initNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // 前台我们本来就不推;此 handler 只兜底
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ble', {
        name: '连接与行程',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    permitted = status === 'granted';
  } catch (e) {
    console.log(`[notify] init 失败: ${e}`);
  }
}

async function push(title: string, body: string, sound: boolean): Promise<void> {
  // 前台不推:UI 本身就显示状态(spec §1)
  if (!permitted || AppState.currentState === 'active') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound },
      trigger: null,
    });
  } catch (e) {
    console.log(`[notify] 推送失败: ${e}`);
  }
}

export async function notifyConnected(adapterName: string): Promise<void> {
  if (!getSettings().notifyConn) return;
  await push('已连接', `${adapterName} · 行程记录中`, getSettings().chime);
}

export async function notifyDisconnected(saved: { durMin: number; distKm: number } | null): Promise<void> {
  if (!getSettings().notifyDis) return;
  const body = saved
    ? `行程已保存 · ${Math.round(saved.durMin)} 分钟 / ${saved.distKm.toFixed(1)} km`
    : '连接已断开';
  await push('已断开', body, getSettings().chime);
}

export async function notifyReportReady(tripTitle: string): Promise<void> {
  if (!getSettings().notifyReport) return;
  await push('行程报告已生成', tripTitle, false);
}
```

- [ ] **Step 2: `index.ts` 入口加 init**

现有 `index.ts` 顶部(`registerRootComponent` 之前)加:

```ts
import { initTripStore } from './src/data/tripStore';
import { initSettingsStore } from './src/data/settingsStore';
import { initNotifications } from './src/notifications/notify';

void initSettingsStore().then(() => Promise.all([initTripStore(), initNotifications()]));
```

(settings 先 init:通知开关/车辆默认值要先就位。init 都是幂等 + 自吞错,启动路径不会炸。)

- [ ] **Step 3: LiveSession 改造 — TripRecorder + 20s 宽限**

`src/ble/LiveSession.tsx` 改动(基于现文件,行号参考 2026-07-24 main):

3a. 顶部 import 增加:

```ts
import { Sample } from '../obd/ElmSession';
import { extractFeatures } from '../analysis/features';
import { buildSeries } from '../analysis/series';
import { computeMetrics } from '../analysis/tripMetrics';
import { verdictFromTrip } from '../analysis/verdict';
import { saveTrip } from '../data/tripStore';
import { TripRecord } from '../data/types';
import { notifyConnected, notifyDisconnected } from '../notifications/notify';
import { runAnalysis } from '../analysis/runAnalysis';
import { setVehicle } from '../data/settingsStore';
```

(`runAnalysis` 在 Task 9 才实现。为保本任务 tsc 绿,本步先建占位 `src/analysis/runAnalysis.ts`:

```ts
import { TripRecord } from '../data/types';

/** 占位:Task 9 实现真 LLM 调用。签名即契约。 */
export async function runAnalysis(record: TripRecord): Promise<void> {
  console.log(`[analysis] pending impl: trip ${record.id}`);
}
```

)

3b. 常量区(`RECONNECT_DELAY_MS` 之后)加:

```ts
// 断开后的行程宽限:期间重连成功 = 同一行程继续;超时 = 行程结束落盘(spec §1/§2)。
const GRACE_MS = 20_000;
const MIN_TRIP_MS = 60_000;
const MIN_TRIP_SAMPLES = 20;
```

3c. Provider 内 refs 区(`connectRef` 之后)加:

```ts
// 进行中的行程。跨 BLE 重连存活 — 只有宽限超时或手动断开才终结。
const tripRef = useRef<{ startedAt: number; samples: Sample[]; distanceKm: number } | null>(null);
const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

3d. 新增 finalizeTrip(放在 `stopStreaming` 定义之后):

```ts
const clearGrace = () => {
  if (graceTimerRef.current) {
    clearTimeout(graceTimerRef.current);
    graceTimerRef.current = null;
  }
};

// 行程终结:合格 → 提特征落盘 + 触发分析;太短 → 丢弃。通知合并在这里发。
const finalizeTrip = useCallback((notify: boolean) => {
  clearGrace();
  const trip = tripRef.current;
  tripRef.current = null;
  setValues({});
  setElapsedSec(0);
  setDistanceKm(0);
  if (!trip) return;
  const endedAt = Date.now();
  const durMs = endedAt - trip.startedAt;
  if (durMs < MIN_TRIP_MS || trip.samples.length < MIN_TRIP_SAMPLES) {
    console.log(`[trip] 丢弃过短行程 ${Math.round(durMs / 1000)}s / ${trip.samples.length} samples`);
    if (notify) void notifyDisconnected(null);
    return;
  }
  const features = extractFeatures(trip.samples);
  const record: TripRecord = {
    id: String(trip.startedAt),
    startedAt: trip.startedAt,
    endedAt,
    durationMin: Math.round((durMs / 60000) * 10) / 10,
    distanceKm: Math.round(trip.distanceKm * 100) / 100,
    samples: trip.samples.length,
    metrics: computeMetrics(trip.samples),
    features,
    series: buildSeries(trip.samples),
    report: null,
    verdict: verdictFromTrip(features, null),
  };
  void saveTrip(record)
    .then(() => {
      if (notify) void notifyDisconnected({ durMin: record.durationMin, distKm: record.distanceKm });
      void runAnalysis(record);
    })
    .catch((e) => {
      console.log(`[trip] 落盘失败: ${e}`);
      if (notify) void notifyDisconnected(null);
    });
}, []);
```

3e. `fail` 改:进入 error 时如有行程在录,起宽限计时(替换现 `fail` 整体):

```ts
const fail = useCallback(
  async (message: string) => {
    cleanupScan();
    stopStreaming();
    await transportRef.current?.disconnect().catch(() => {});
    setError(message);
    setPhase('error');
    // 行程还在:给 20s 宽限,重连成功继续同一行程;超时才终结+通知
    if (tripRef.current && !graceTimerRef.current) {
      graceTimerRef.current = setTimeout(() => {
        graceTimerRef.current = null;
        finalizeTrip(true);
      }, GRACE_MS);
    }
    if (wantConnRef.current) {
      clearReconnect();
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
    }
  },
  [setPhase, finalizeTrip],
);
```

3f. `disconnect` 改:手动断开立即终结行程(通知不发——用户自己按的,`finalizeTrip(false)`;里面已包含 values/elapsed/distance 清零,原三行 set 删掉):

```ts
const disconnect = useCallback(async () => {
  wantConnRef.current = false;
  clearReconnect();
  cleanupScan();
  stopStreaming();
  await transportRef.current?.disconnect().catch(() => {});
  finalizeTrip(false);
  setError(null);
  setPhase('idle');
}, [setPhase, finalizeTrip]);
```

3g. `startPolling` 改:行程续接 + 样本累积 + 连接通知 + adapter 名写车辆信息。整体替换:

```ts
const startPolling = useCallback(
  (session: ElmSession, deviceName: string) => {
    pollingRef.current = true;
    clearGrace(); // 宽限内重连成功 → 同一行程继续
    const isNewTrip = !tripRef.current;
    if (isNewTrip) {
      tripRef.current = { startedAt: Date.now(), samples: [], distanceKm: 0 };
      setValues({});
      setDistanceKm(0);
      void notifyConnected(deviceName);
      void setVehicle({ adapter: deviceName });
    }
    const trip = tripRef.current!;
    setElapsedSec(Math.floor((Date.now() - trip.startedAt) / 1000));
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - trip.startedAt) / 1000));
    }, 1000);

    void (async () => {
      // App.debug.tsx 同款轮询;queryPid 返回 null(车型不支持,如 oil_temp)
      // 不是错误 — 跳过继续。抛错(超时/断连)才终止会话。
      let lastSpeed: { t: number; v: number } | null = null;
      while (pollingRef.current) {
        for (const pid of PIDS) {
          if (!pollingRef.current) break;
          try {
            const sample = await session.queryPid(pid);
            if (!sample) continue;
            // Sample.t 是 ElmSession 起算 — 重连会归零。行程内统一改用行程起算。
            const tripSample: Sample = { ...sample, t: Date.now() - trip.startedAt };
            trip.samples.push(tripSample);
            setValues((prev) => ({ ...prev, [OBD_TO_UI[sample.key] ?? sample.key]: sample.value }));
            if (sample.key === 'speed') {
              if (lastSpeed) {
                const dtH = (tripSample.t - lastSpeed.t) / 3_600_000;
                const avg = (lastSpeed.v + sample.value) / 2;
                trip.distanceKm += avg * dtH;
                setDistanceKm(trip.distanceKm);
              }
              lastSpeed = { t: tripSample.t, v: sample.value };
            }
          } catch (e: any) {
            if (pollingRef.current) await fail(`连接中断:${e.message}`);
            return;
          }
        }
      }
    })();
  },
  [fail],
);
```

3h. `connect` 内调用处改一行,传设备名:

```ts
setPhase('streaming');
startPolling(session, name || 'OBD 适配器');
```

(`name` 是 scan 回调里已有的 `device.name ?? device.localName ?? ''`。)

3i. 卸载 cleanup(最后的 `useEffect`)里 `stopStreaming();` 之后加 `clearGrace();`(卸载即 app 关闭,行程数据在内存里跟着进程走,落盘救不了 — 不 finalize,写注释说明)。

```ts
useEffect(
  () => () => {
    clearReconnect();
    cleanupScan();
    stopStreaming();
    clearGrace(); // app 卸载即进程终结,行程内存数据无处落 — 不强行 finalize
    transportRef.current?.disconnect().catch(() => {});
    transportRef.current?.destroy();
    transportRef.current = null; // destroyed BleManager 不可复用,重挂载时懒建新实例
  },
  [],
);
```

- [ ] **Step 4: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/notifications/notify.ts src/ble/LiveSession.tsx src/analysis/runAnalysis.ts index.ts
git commit -m "feat(c): 连接/断开本地通知 + TripRecorder(20s 宽限跨重连)

行程与 BLE 会话解耦:闪断重连 = 同一行程继续;宽限超时 = 落盘+合并通知。
前台不推(UI 已显示状态);通知开关读 settingsStore。runAnalysis 先占位,Task 9 补。"
```

真机验证项(PR 清单用,此处不阻塞):后台连接推送、闪断 <20s 无通知、拔适配器 20s 后收「已断开·行程已保存」。

---

### Task 9: LLM 接通 — runAnalysis + Outlook 聚合

**Files:**
- Modify: `src/analysis/runAnalysis.ts`(占位换真)
- Create: `src/analysis/outlook.ts`
- Create: `src/data/outlookStore.ts`
- Test: `scripts/test-outlook-validate.ts`(校验/映射纯部分)

**Interfaces:**
- Consumes: `analyzeTrip`(minimax.ts)、`getApiKey`、`updateTripReport/getIndex/getTrip`、`verdictFromTrip`、`buildTrends`、`notifyReportReady`、`tripToDisplay`
- Produces:
  - `runAnalysis(record: TripRecord): Promise<void>`——无 key/失败 = 静默留「未分析」;成功 = updateTripReport + notifyReportReady + `refreshOutlook()`
  - outlook.ts:`analyzeOutlook(input: OutlookInput, apiKey: string): Promise<Outlook>`;`buildOutlookInput(records: TripRecord[]): OutlookInput`;`OutlookInput = { trends: Record<TrendKey, {label: string; unit: string; series: number[]}>; recentFindings: string[]; tripCount: number }`;导出 `parseOutlook(text: string): Outlook`(纯,供测试)
  - outlookStore:`getOutlook(): Outlook | null`、`subscribeOutlook(fn)`、`initOutlookStore(): Promise<void>`(读 `outlook.json`)、`refreshOutlook(): Promise<void>`(≥1 个已分析行程才调 LLM;写文件 + 通知订阅者)
  - `src/hooks/useOutlook.ts` 在 Task 10 改(此任务不动 UI)

- [ ] **Step 1: 写失败测试 `scripts/test-outlook-validate.ts`**

```ts
// Run: npx tsx scripts/test-outlook-validate.ts — 只测纯解析/夹紧,不打网络
import { parseOutlook } from '../src/analysis/outlook';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const good = parseOutlook(JSON.stringify({
  score: 82, headline: '状态良好',
  current: [{ title: 'LTFT 偏高', detail: '均值 5.5%', severity: 'watch', action: '查真空管' }],
  future: [{ title: 'x', detail: 'y', severity: 'info' }],
  normal: ['冷却系统正常'],
}));
assert(good.score === 82 && good.verdictTone === 'good' && good.verdictLabel === '总体良好', 'score/verdict');
assert(good.current[0].tone === 'watch' && good.current[0].action === '查真空管', 'current 映射');
assert(good.future[0].action === undefined, '无 action 不给建议框');

// score 越界夹紧;≥60 <80 → 需要留意;<60 → 建议检查
assert(parseOutlook('{"score": 250, "headline":"h","current":[],"future":[],"normal":[]}').score === 100, '夹紧 100');
assert(parseOutlook('{"score": 65, "headline":"h","current":[],"future":[],"normal":[]}').verdictLabel === '需要留意', '60-79');
assert(parseOutlook('{"score": 30, "headline":"h","current":[],"future":[],"normal":[]}').verdictTone === 'inspect', '<60 inspect');
// 包 fences 也能解析(minimax.ts 同款取外层大括号)
assert(parseOutlook('```json\n{"score": 70, "headline":"h","current":[],"future":[],"normal":[]}\n```').score === 70, '剥 fences');
// 坏字段丢弃,不炸
const dirty = parseOutlook('{"score":"bad","headline":123,"current":[{"title":"t"}],"future":"no","normal":[1,"ok"]}');
assert(dirty.score === 50 && typeof dirty.headline === 'string', '坏 score/headline 有默认');
assert(dirty.current.length === 0 && dirty.future.length === 0 && dirty.normal.length === 1, '坏条目过滤');

console.log('PASS test-outlook-validate');
```

- [ ] **Step 2: 跑,确认 fail**

Run: `npx tsx scripts/test-outlook-validate.ts`
Expected: Cannot find module '../src/analysis/outlook'

- [ ] **Step 3: 实现 `src/analysis/outlook.ts`**

```ts
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
```

- [ ] **Step 4: 跑测试确认 PASS**

Run: `npx tsx scripts/test-outlook-validate.ts`
Expected: `PASS test-outlook-validate`

- [ ] **Step 5: 实现 `src/data/outlookStore.ts`**

```ts
// Outlook 缓存:outlook.json。新行程分析完成后 refreshOutlook() 重算。
import { File, Paths } from 'expo-file-system';
import { Outlook, TripRecord } from './types';
import { getIndex, getTrip } from './tripStore';
import { analyzeOutlook, buildOutlookInput } from '../analysis/outlook';
import { getApiKey } from './settingsStore';

const outlookFile = new File(Paths.document, 'outlook.json');

let outlook: Outlook | null = null;
const listeners = new Set<() => void>();

export function subscribeOutlook(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getOutlook = () => outlook;

export async function initOutlookStore(): Promise<void> {
  try {
    if (outlookFile.exists) outlook = JSON.parse(await outlookFile.text());
  } catch (e) {
    console.log(`[outlook] init 失败: ${e}`);
  }
  listeners.forEach((fn) => fn());
}

export async function refreshOutlook(): Promise<void> {
  try {
    const key = await getApiKey();
    if (!key) return;
    const recs = (await Promise.all(getIndex().map((e) => getTrip(e.id)))).filter(
      (r): r is TripRecord => r !== null,
    );
    if (!recs.some((r) => r.report)) return; // 一个已分析行程都没有,没料可聚合
    outlook = await analyzeOutlook(buildOutlookInput(recs), key);
    outlookFile.write(JSON.stringify(outlook));
    listeners.forEach((fn) => fn());
  } catch (e) {
    console.log(`[outlook] refresh 失败: ${e}`); // 失败留旧缓存,下次行程再试
  }
}
```

- [ ] **Step 6: `src/analysis/runAnalysis.ts` 占位换真**

```ts
// 行程报告编排:落盘后自动调用;无 key/失败 = 留「未分析」,TripDetail 可手动重试。
import { TripRecord } from '../data/types';
import { analyzeTrip } from './minimax';
import { verdictFromTrip } from './verdict';
import { getApiKey } from '../data/settingsStore';
import { updateTripReport } from '../data/tripStore';
import { refreshOutlook } from '../data/outlookStore';
import { notifyReportReady } from '../notifications/notify';
import { tripToDisplay } from '../data/display';

export async function runAnalysis(record: TripRecord): Promise<void> {
  try {
    const key = await getApiKey();
    if (!key) {
      console.log('[analysis] 无 API key,留未分析');
      return;
    }
    const report = await analyzeTrip(record.features, key);
    await updateTripReport(record.id, report, verdictFromTrip(record.features, report));
    void notifyReportReady(`${tripToDisplay(record).title} · ${report.summary.slice(0, 40)}`);
    void refreshOutlook();
  } catch (e) {
    console.log(`[analysis] 行程 ${record.id} 分析失败(留未分析): ${e}`);
  }
}
```

- [ ] **Step 7: `index.ts` 的 init 链补 outlookStore**

Task 8 Step 2 加的那行改为:

```ts
void initSettingsStore().then(() => Promise.all([initTripStore(), initNotifications(), initOutlookStore()]));
```

(import 相应加 `initOutlookStore`。)

- [ ] **Step 8: 门禁 + commit**

```bash
npx tsc --noEmit
git add src/analysis/runAnalysis.ts src/analysis/outlook.ts src/data/outlookStore.ts scripts/test-outlook-validate.ts index.ts
git commit -m "feat(c): 行程报告自动分析 + Outlook 多行程聚合调用

失败路径全部降级不炸:无 key 留未分析,outlook 失败留旧缓存。
解析层白名单过滤 + score 夹紧,离线测试覆盖。"
```

---

### Task 10: UI 换真 — 六屏 + 删 MOCK

**Files:**
- Modify: `src/hooks/useOutlook.ts`
- Modify: `src/hooks/useLivePids.ts`
- Create: `src/data/livePidMeta.ts`
- Modify: `src/screens/HistoryScreen.tsx`
- Modify: `src/screens/TripDetailScreen.tsx`
- Modify: `src/screens/TrendsScreen.tsx`
- Modify: `src/screens/HealthScreen.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/screens/components/TrendCard.tsx`(仅 import 路径)
- Delete: `src/data/mock.ts`

**Interfaces:**
- Consumes: Task 7/9 的全部 store/hook;`hasEnough`(trends.ts);`tripFileUri`(tripStore);`setSetting/getSettings/subscribeSettings/setVehicle/getApiKey/setApiKey`(settingsStore);expo-sharing(`Sharing.shareAsync(uri)`,已装)
- Produces: `useOutlook(): Outlook | null`(**签名变化:可空**,空 = 数据积累中);无 MOCK 引用,`grep -rn "MOCK" src/` 为 0

- [ ] **Step 1: `src/data/livePidMeta.ts`(展示元数据,不是 mock)**

```ts
// 实时 tile 的展示元数据(key/label/unit/note)。数值一律来自 BLE,这里没有数。
export const LIVE_PID_META = [
  { key: 'rpm', label: '转速', unit: 'rpm' },
  { key: 'speed', label: '车速', unit: 'km/h' },
  { key: 'coolant', label: '水温', unit: '°C' },
  { key: 'oil', label: '机油温度', unit: '°C', note: '车型未提供' },
  { key: 'stft', label: '短期燃油修正', unit: '%' },
  { key: 'ltft', label: '长期燃油修正', unit: '%' },
] as const;
```

- [ ] **Step 2: `src/hooks/useLivePids.ts` 改用 meta**

```ts
import { useMemo } from 'react';
import { LIVE_PID_META } from '../data/livePidMeta';
import type { LivePid } from '../data/types';
import { useLiveSession } from '../ble/LiveSession';

// 契约:返回类型 LivePid[] 不变(issue #9)。数值来自真 BLE,meta 只给 label/unit。
export function useLivePids(): LivePid[] {
  const { values } = useLiveSession();
  return useMemo(
    () =>
      LIVE_PID_META.map((m) => ({
        ...m,
        idle: values[m.key] ?? null,
        drive: values[m.key] ?? null,
        jitter: 0,
      })),
    [values],
  );
}
```

- [ ] **Step 3: `src/hooks/useOutlook.ts` 换真(可空)**

```ts
import { useSyncExternalStore } from 'react';
import { getOutlook, subscribeOutlook } from '../data/outlookStore';
import type { Outlook } from '../data/types';

/** null = 尚无展望(没有已分析行程/没配 key)。 */
export function useOutlook(): Outlook | null {
  return useSyncExternalStore(subscribeOutlook, getOutlook);
}
```

- [ ] **Step 4: HistoryScreen 空状态**

`src/screens/HistoryScreen.tsx`:import 区 `useTrips` 不变,`from '../data/mock'` 类改 `from '../data/types'`(该文件如无直接 mock import 则跳过)。`return` 前加:

```tsx
if (trips.length === 0) {
  return (
    <Screen title="行程历史" below={below}>
      <Card style={{ alignItems: 'center', paddingVertical: 36 }}>
        <Icon name="car" size={34} color={t.label3} />
        <Text style={{ color: t.label2, fontSize: 15, marginTop: 10 }}>还没有行程</Text>
        <Text style={{ color: t.label3, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
          连上车开一段,断开后会自动记录并生成报告。
        </Text>
      </Card>
    </Screen>
  );
}
```

(`Card` 需新增 import:`import { Card } from '../components/Card';`。)

- [ ] **Step 5: TripDetailScreen — 真记录 + 未分析重试 + 导出**

改动点(其余布局不动):

5a. 数据源换 `useTripRecord`:

```tsx
import { useTripRecord, useTrips } from '../hooks/useTrips';
import { tripToDisplay } from '../data/display';
import { runAnalysis } from '../analysis/runAnalysis';
import { tripFileUri } from '../data/tripStore';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
```

```tsx
const rec = useTripRecord(tripId);
const [retrying, setRetrying] = useState(false);
if (!rec) return <Screen title="行程报告" backLabel="行程历史" onBack={() => navigation.goBack()}><Text style={{ color: t.label2, padding: 20 }}>行程不存在或已删除。</Text></Screen>;
const tr = tripToDisplay(rec);
```

(原 `useTrips().find(...)` 删除。)

5b. `below` 的 route 行改成日期(route 已无):

```tsx
below={<Text style={s.belowSub}>{tr.group} {tr.time} · {tr.title}</Text>}
```

5c. hero 标题按 verdict 全覆盖(原来只分 good/非 good):

```tsx
<Text style={s.heroTitle}>
  {!tr.analyzed
    ? '行程已记录,报告未生成'
    : tr.verdict === 'good'
      ? '本次行程发动机状态良好'
      : tr.verdict === 'inspect'
        ? '发现需要检查的项目'
        : '整体良好,有需要留意的项目'}
</Text>
```

5d. AI 分析区:未分析显示重试卡(替换 `{tr.findings.map(...)}` 段):

```tsx
{tr.analyzed ? (
  tr.findings.map((f, i) => (
    /* 原 findings Card 渲染,原样保留 */
  ))
) : (
  <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
    <Text style={{ color: t.label2, fontSize: 14, textAlign: 'center', paddingHorizontal: 20 }}>
      尚未生成 AI 报告(未配置 API Key 或调用失败)。
    </Text>
    <Pressable
      disabled={retrying}
      onPress={() => {
        setRetrying(true);
        void runAnalysis(rec).finally(() => setRetrying(false));
      }}
      style={({ pressed }) => [{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 22, borderRadius: 10, backgroundColor: t.fill }, (pressed || retrying) && { opacity: 0.6 }]}
    >
      <Text style={{ color: t.orange, fontSize: 15, fontWeight: '600' }}>{retrying ? '分析中…' : '重新分析'}</Text>
    </Pressable>
  </Card>
)}
```

(`Pressable` 加进 react-native import。重试成功后 tripStore 通知订阅 → `useTripRecord` 自动刷新。)

5e. 导出接真(替换原 Alert 占位):

```tsx
<Row
  icon="route"
  iconBg={t.label2}
  title="导出行程数据 (JSON)"
  accessory={null}
  last
  onClick={() => void Sharing.shareAsync(tripFileUri(rec.id)).catch(() => {})}
/>
```

- [ ] **Step 6: TrendsScreen — 数据积累中**

`TrendCard` 调用处包条件(四张同款):

```tsx
import { hasEnough } from '../data/trends';
```

```tsx
{([trends.ltft, trends.warmup, trends.idle, trends.cold] as const).map((tr, i) =>
  hasEnough(tr) ? (
    <TrendCard key={i} tr={tr} />
  ) : (
    <Card key={i} style={{ alignItems: 'center', paddingVertical: 20 }}>
      <Text style={{ color: t.label, fontSize: 15, fontWeight: '600' }}>{tr.label}</Text>
      <Text style={{ color: t.label3, fontSize: 13, marginTop: 6 }}>数据积累中 · 多开几次就有趋势了</Text>
    </Card>
  ),
)}
```

底部文案 `共记录 {trips.length}+ 次行程` 改 `共记录 {trips.length} 次行程`(真数不加「+」)。`Card` import 补上。`src/screens/components/TrendCard.tsx` 的 `from '../../data/mock'` 类型 import 改 `from '../../data/types'`。

- [ ] **Step 7: HealthScreen — 空状态**

```tsx
const O = useOutlook();
```

`O` 可空,`return` 前加:

```tsx
if (!O) {
  return (
    <Screen title="健康展望" right={<AskButton />}>
      <Card style={{ alignItems: 'center', paddingVertical: 36 }}>
        <Icon name="checkcircle" size={34} color={t.label3} />
        <Text style={{ color: t.label2, fontSize: 15, marginTop: 10 }}>数据积累中</Text>
        <Text style={{ color: t.label3, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
          行程报告生成后,这里会给出整车健康展望。需要在设置中配置 API Key。
        </Text>
      </Card>
    </Screen>
  );
}
```

`Finding` 类型 import 从 `../data/mock` 改 `../data/types`。

- [ ] **Step 8: HomeScreen — 删 ltft 硬编码 + vehicle 兜底**

- `ltftHigh` 常量、`note` 里的 `'略偏高'`、`col` 里的 amber 分支删掉(spec §4:分析接入后由报告驱动,tile 不再本地判高低):

```tsx
const col = p.key === 'coolant' ? t.blue : t.label;
const note = p.key === 'oil' && !has ? p.note : undefined;
```

- 连接副标题 `vehicle.model.split(' · ')[1]` 在 model='未设置' 时会 undefined:改 `vehicle.model.split(' · ')[1] ?? vehicle.model`。

- [ ] **Step 9: SettingsScreen — 全接线**

重写为(保持视觉结构,接真 store;车辆编辑用 `Alert.prompt`,iOS-only 够用——个人工具 iPhone 使用,Android 弹 Alert 提示暂不支持):

```tsx
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Toggle } from '../components/Toggle';
import { useTheme } from '../context/Theme';
import { useVehicle } from '../hooks/useVehicle';
import { useLiveSession } from '../ble/LiveSession';
import {
  getApiKey, getSettings, setApiKey, setSetting, setVehicle, subscribeSettings,
} from '../data/settingsStore';
import { getIndex, subscribeTrips } from '../data/tripStore';

// Settings — 设置。对照 prototype/screensB.jsx SettingsScreen。
export function SettingsScreen() {
  const t = useTheme();
  const D = useVehicle();
  const s = useSyncExternalStore(subscribeSettings, getSettings);
  const { phase } = useLiveSession();
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    void getApiKey().then((k) => setHasKey(!!k));
  }, []);

  const totalKm = index.reduce((a, e) => a + e.distanceKm, 0);

  // iOS-only 文本编辑(Alert.prompt)。个人工具主力 iPhone;Android 先提示。
  const promptEdit = (title: string, current: string, onDone: (v: string) => void) => {
    if (Platform.OS !== 'ios') {
      Alert.alert('暂不支持', '车辆信息编辑目前仅支持 iOS。');
      return;
    }
    Alert.prompt(title, undefined, (v) => v != null && onDone(v.trim()), 'plain-text', current);
  };

  return (
    <Screen title="设置">
      <Group header="设备">
        <Row
          icon="bluetooth" iconBg={t.blue} title={D.adapter} sub="蓝牙 OBD 适配器"
          value={phase === 'streaming' ? '已连接' : '未连接'}
          valueColor={phase === 'streaming' ? t.green : t.label3} accessory={null}
        />
        <Row icon="car" iconBg={t.orange} title="自动连接" sub="开关接线见 issue #16,当前恒开" value="开" accessory={null} last />
      </Group>
      <Group header="通知与提示音" footer="连接与断开时推送通知,无需一直查看 App。App 在前台时不推送。">
        <Row icon="sound" iconBg={t.orange} title="连接提示音" right={<Toggle on={s.chime} onChange={(v) => void setSetting('chime', v)} />} />
        <Row icon="bell" iconBg={t.green} title="连接成功推送" right={<Toggle on={s.notifyConn} onChange={(v) => void setSetting('notifyConn', v)} />} />
        <Row icon="bell" iconBg={t.amber} title="连接中断推送" right={<Toggle on={s.notifyDis} onChange={(v) => void setSetting('notifyDis', v)} />} />
        <Row icon="bell" iconBg={t.blue} title="行程报告就绪推送" right={<Toggle on={s.notifyReport} onChange={(v) => void setSetting('notifyReport', v)} />} last />
      </Group>
      <Group header="车辆" footer="总里程 = 里程基线 + App 记录的行程里程。">
        <Row title="车名" value={D.name} accessory="chevron" onClick={() => promptEdit('车名', D.name, (v) => void setVehicle({ name: v }))} />
        <Row title="型号" value={D.model} accessory="chevron" onClick={() => promptEdit('型号', D.model, (v) => void setVehicle({ model: v }))} />
        <Row title="发动机" value={D.engine} accessory="chevron" onClick={() => promptEdit('发动机', D.engine, (v) => void setVehicle({ engine: v }))} />
        <Row title="车牌" value={D.plate} accessory="chevron" onClick={() => promptEdit('车牌', D.plate, (v) => void setVehicle({ plate: v }))} />
        <Row
          title="总里程"
          value={`${Math.round(D.odo + totalKm).toLocaleString()} km`}
          accessory="chevron"
          onClick={() => promptEdit('里程基线 (km)', String(D.odo), (v) => {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 0) void setVehicle({ odo: n });
          })}
          last
        />
      </Group>
      <Group header="AI 分析" footer="Key 仅存本机 SecureStore,不上传。">
        <Row
          title="MiniMax API Key"
          value={hasKey ? '已设置 ••••' : '未设置'}
          accessory="chevron"
          onClick={() =>
            promptEdit('MiniMax API Key(留空清除)', '', (v) => {
              void setApiKey(v).then(() => setHasKey(!!v));
            })
          }
          last
        />
      </Group>
      <Group footer="OBD 健康记录 · 个人工具,数据仅存本机。">
        <Row title="版本" value="1.0.0 (V1)" accessory={null} last />
      </Group>
    </Screen>
  );
}
```

(「报告语言」「导出全部」「清除本地数据」三行本轮删掉——没实现的开关不摆在界面上;导出单行程已在 TripDetail 接真。)

- [ ] **Step 10: 删 `src/data/mock.ts` + 清引用**

```bash
rm src/data/mock.ts
grep -rn "data/mock\|MOCK" src/ index.ts App*.tsx 2>/dev/null
```

Expected: grep 无输出(有则逐个改到 `../data/types`)。

- [ ] **Step 11: 全部离线测试 + 门禁 + commit**

```bash
npx tsx scripts/test-trip-pure.ts && npx tsx scripts/test-display.ts && npx tsx scripts/test-trends.ts && npx tsx scripts/test-outlook-validate.ts
npx tsc --noEmit
git add -A
git commit -m "feat(c): 六屏接真数据,删 mock.ts

History/Trends/Health 补空状态;TripDetail 未分析可重试+导出接 share sheet;
Settings 全接线(通知开关/车辆/key);Home 删 ltft 硬编码阈值(报告驱动)。
UI 上没实现的行(报告语言/导出全部/清除数据)删掉,不摆假开关。"
```

---

### Task 11: 收尾 — PR + 真机清单

**Files:** 无新增(PR 操作)

- [ ] **Step 1: 全绿确认 + push**

```bash
npx tsx scripts/test-trip-pure.ts && npx tsx scripts/test-display.ts && npx tsx scripts/test-trends.ts && npx tsx scripts/test-outlook-validate.ts && npx tsc --noEmit
git push -u origin feat/sub-project-c
```

- [ ] **Step 2: 开 PR**

```bash
gh pr create --title "feat: sub-project C — 连接通知 + 全量真数据" --body "$(cat <<'EOF'
Closes #<Task issue 号(Task 1 建的)>

Spec: docs/superpowers/specs/2026-07-24-sub-project-C-notifications-real-data-design.md
ADR: docs/adr/0028(L1 Tech stack 变更,stanyan 2026-07-24 会话内同意)

## 未经真机验证(硬规则标注)— 验证清单

- [ ] app 后台,上车通电 → 收到「已连接」推送
- [ ] 行驶中蓝牙闪断 <20s 自动重连 → 无通知,行程不断
- [ ] 熄火/拔适配器 20s 后 → 收到「已断开 · 行程已保存(时长/里程)」
- [ ] 前台连接/断开 → 不推送
- [ ] <60s 的短连接 → 无行程,断开通知只报「已断开」
- [ ] History 出现真行程,重启 app 后仍在;TripDetail 数据正确
- [ ] 无 key:行程标「未分析」;Settings 填 key 后 TripDetail 重试成功
- [ ] 行程分析完成 → 「行程报告已生成」推送;Health 页出现 Outlook
- [ ] Trends:≥2 次行程后出图,不足显示「数据积累中」
- [ ] Settings 通知开关关掉后确实不推;车辆信息编辑重启后仍在
- [ ] TripDetail 导出 JSON share sheet 正常

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_015sNExaLvLqkZead4DntCtS
EOF
)"
```

- [ ] **Step 3: CI 绿后按协议处置**

CI 绿 + stanyan 真机验证通过 → merge commit 合入(ADR-0007),关 Task issue。真机验证不通过 → 问题写 PR comment,留 open。收工按 On ending a shift:开交接 issue + Memory 五项。

---

## Self-Review 记录

- Spec 覆盖:§1 通知(Task 8)、§2 录制/持久化(Task 3/6/8)、§3 趋势(Task 5/10)、§4 LLM/Outlook/删阈值(Task 9/10)、§5 Settings/车辆(Task 7/10)、§6 依赖/L1/mock 拆除(Task 1/2/10)——全覆盖
- 类型一致性:`TripRecord/TripMetrics/TripIndexEntry` 定义于 Task 2,Task 3-10 引用同名同形;`runAnalysis` 占位(Task 8)与真实现(Task 9)签名一致;`useOutlook` 可空是有意的签名变更,消费端在 Task 10 同步改
- 已知取舍:行程中 app 被杀 = 该行程丢失(内存样本无处落),V0 接受,记在 PR 描述;`Alert.prompt` iOS-only,Android 提示暂不支持

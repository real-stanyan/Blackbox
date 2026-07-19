# Sub-project B — 实时 tab 接真 BLE PID stream(实施计划)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home(实时)tab 数据源从 mock 切到 OBDLink CX 真 BLE PID 轮询,连接状态驱动 idle/driving。

**Architecture:** 新建 `LiveSessionProvider`(React context)独占 `BleTransport + ElmSession` 生命周期与 `idle→scanning→connecting→streaming/error` 状态机;`useLivePids`/`useHomeMode` 改为从该 context 派生,接口契约不变;HomeScreen 删 jitter 模拟直读真值。spec:`docs/superpowers/specs/2026-07-19-sub-project-B-live-ble-design.md`。

**Tech Stack:** Expo ~57 dev client / RN 0.86 / react-native-ble-plx / TypeScript

## Global Constraints

- 门禁:`npx tsc --noEmit` 每 task 结束必须绿(V0 无测试套件,ADR-0014)
- BLE 行为最终验收 = 真机 + OBDLink CX(AGENTS.md Hard rule);本计划所有 BLE 逻辑复用已真机验证过的 `src/ble/BleTransport.ts` / `src/obd/ElmSession.ts`,新增编排层未经真机验证 → PR 标注
- 契约不动:`src/data/mock.ts` 全部 interface、5 个数据 hook 返回类型、TAB_META/RootNavigator
- 其它 4 个 tab 不改(仍 mock);App.debug.tsx、README 不动
- BLE 写入分块已由 `BleTransport.write`(CHUNK=20)保证,不新增直写路径;GATT UUID 运行时发现,不硬编码

---

### Task 1: LiveSessionProvider + App.tsx 接线

**Files:**
- Create: `src/ble/LiveSession.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `BleTransport`(startScan/connect/disconnect/destroy)、`ElmSession`(init/queryPid)、`PIDS`
- Produces: `LiveSessionProvider`、`useLiveSession(): { phase, values, elapsedSec, distanceKm, error, connect, disconnect }`、`type LivePhase`

- [x] **Step 1: 写 `src/ble/LiveSession.tsx`**

```tsx
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { BleTransport } from './BleTransport';
import { ElmSession } from '../obd/ElmSession';
import { PIDS } from '../obd/pids';

export type LivePhase = 'idle' | 'scanning' | 'connecting' | 'streaming' | 'error';

// OBD PID key(src/obd/pids.ts)→ UI tile key(MOCK.livePids)
const OBD_TO_UI: Record<string, string> = {
  rpm: 'rpm',
  speed: 'speed',
  coolant_temp: 'coolant',
  oil_temp: 'oil',
  stft_b1: 'stft',
  ltft_b1: 'ltft',
};

const ADAPTER_NAME = /OBD|CX|LINK|STN|VLINK/i;
const SCAN_TIMEOUT_MS = 30_000;

interface LiveSessionValue {
  phase: LivePhase;
  /** UI key → 最新读数 */
  values: Record<string, number>;
  /** streaming 起算秒数 */
  elapsedSec: number;
  /** 车速梯形积分里程 */
  distanceKm: number;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<LiveSessionValue | null>(null);

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<LivePhase>('idle');
  const [values, setValues] = useState<Record<string, number>>({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<LivePhase>('idle');
  const transportRef = useRef<BleTransport | null>(null);
  const pollingRef = useRef(false);
  const stopScanRef = useRef<(() => void) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setPhase = useCallback((p: LivePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const getTransport = () => {
    if (!transportRef.current) {
      transportRef.current = new BleTransport((line) => console.log(`[ble] ${line}`));
    }
    return transportRef.current;
  };

  const cleanupScan = () => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  const stopStreaming = () => {
    pollingRef.current = false;
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const fail = useCallback(
    async (message: string) => {
      cleanupScan();
      stopStreaming();
      await transportRef.current?.disconnect().catch(() => {});
      setError(message);
      setPhase('error');
    },
    [setPhase],
  );

  const disconnect = useCallback(async () => {
    cleanupScan();
    stopStreaming();
    await transportRef.current?.disconnect().catch(() => {});
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
    setError(null);
    setPhase('idle');
  }, [setPhase]);

  const startPolling = useCallback(
    (session: ElmSession) => {
      pollingRef.current = true;
      setValues({});
      setElapsedSec(0);
      setDistanceKm(0);
      const startedAt = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
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
              setValues((prev) => ({ ...prev, [OBD_TO_UI[sample.key] ?? sample.key]: sample.value }));
              if (sample.key === 'speed') {
                if (lastSpeed) {
                  const dtH = (sample.t - lastSpeed.t) / 3_600_000;
                  const avg = (lastSpeed.v + sample.value) / 2;
                  setDistanceKm((d) => d + avg * dtH);
                }
                lastSpeed = { t: sample.t, v: sample.value };
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

  const connect = useCallback(() => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'error') return;
    setError(null);
    setPhase('scanning');
    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
        }
        const transport = getTransport();
        let picked = false;
        scanTimerRef.current = setTimeout(() => {
          if (!picked) {
            cleanupScan();
            void fail('未扫描到 OBD 适配器 — 确认已插好且未被其它 App 占用');
          }
        }, SCAN_TIMEOUT_MS);
        stopScanRef.current = transport.startScan((device: Device) => {
          const name = device.name ?? device.localName ?? '';
          if (picked || !ADAPTER_NAME.test(name)) return;
          picked = true;
          cleanupScan();
          void (async () => {
            try {
              setPhase('connecting');
              await transport.connect(device);
              const session = new ElmSession(transport, (line) => console.log(`[obd] ${line}`));
              await session.init();
              setPhase('streaming');
              startPolling(session);
            } catch (e: any) {
              await fail(e.message);
            }
          })();
        });
      } catch (e: any) {
        await fail(e.message);
      }
    })();
  }, [fail, setPhase, startPolling]);

  useEffect(
    () => () => {
      cleanupScan();
      stopStreaming();
      transportRef.current?.disconnect().catch(() => {});
      transportRef.current?.destroy();
    },
    [],
  );

  const value = useMemo(
    () => ({ phase, values, elapsedSec, distanceKm, error, connect, disconnect }),
    [phase, values, elapsedSec, distanceKm, error, connect, disconnect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveSession(): LiveSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLiveSession must be used within LiveSessionProvider');
  return v;
}
```

- [x] **Step 2: `App.tsx` 包 provider**

```tsx
import { RootNavigator } from './src/navigation/RootNavigator';
import { LiveSessionProvider } from './src/ble/LiveSession';

// 消费者版 App(sub-project A + B)。
// 原 V0 调试 UI 备份在 App.debug.tsx(BLE 开发期看日志用)。
// V0 → 消费者版方向见 Protocol gap issue #6。
export default function App() {
  return (
    <LiveSessionProvider>
      <RootNavigator />
    </LiveSessionProvider>
  );
}
```

- [x] **Step 3: 门禁**

Run: `npx tsc --noEmit`
Expected: 无输出(绿)

- [x] **Step 4: Commit**

```bash
git add src/ble/LiveSession.tsx App.tsx
git commit -m "feat(B): LiveSessionProvider — BLE 连接状态机 + PID 轮询编排"
```

---

### Task 2: hooks 换底层 + Settings 删 DEV toggle

**Files:**
- Modify: `src/hooks/useLivePids.ts`
- Modify: `src/hooks/useHomeMode.ts`
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `useLiveSession()`(Task 1)
- Produces: `useLivePids(): LivePid[]`(契约不变);`useHomeMode(): { mode: HomeMode }`(**删** `setMode`/`toggle` — 唯一外部用户是 Settings DEV toggle,同 task 删除)

- [x] **Step 1: `src/hooks/useLivePids.ts` 全量替换**

```ts
import { useMemo } from 'react';
import { MOCK } from '../data/mock';
import type { LivePid } from '../data/mock';
import { useLiveSession } from '../ble/LiveSession';

// 契约:返回类型 LivePid[] 不变(issue #9)。底层从 mock 数值换成真 BLE 读数;
// MOCK.livePids 只再提供展示元数据(key/label/unit/note)。
export function useLivePids(): LivePid[] {
  const { values } = useLiveSession();
  return useMemo(
    () =>
      MOCK.livePids.map((m) => ({
        ...m,
        idle: values[m.key] ?? null,
        drive: values[m.key] ?? null,
        jitter: 0,
      })),
    [values],
  );
}
```

- [x] **Step 2: `src/hooks/useHomeMode.ts` 全量替换**

```ts
import { useLiveSession } from '../ble/LiveSession';

export type HomeMode = 'idle' | 'driving';

// B 阶段:BLE 连接状态的派生值(streaming = driving)。A 阶段 dev toggle 已删。
export function useHomeMode(): { mode: HomeMode } {
  const { phase } = useLiveSession();
  return { mode: phase === 'streaming' ? 'driving' : 'idle' };
}
```

- [x] **Step 3: `SettingsScreen.tsx` 删 DEV Group**

删三处:

1. `import { useHomeMode } from '../hooks/useHomeMode';`(第 8 行)
2. `const { mode: homeMode, toggle: toggleHomeMode } = useHomeMode();`(第 14 行)
3. 整个 `{__DEV__ ? (<Group header="开发选项(DEV)" ...>...</Group>) : null}` 块(第 47–58 行)

- [x] **Step 4: 门禁**

Run: `npx tsc --noEmit`
Expected: 无输出(绿)

- [x] **Step 5: Commit**

```bash
git add src/hooks/useLivePids.ts src/hooks/useHomeMode.ts src/screens/SettingsScreen.tsx
git commit -m "feat(B): useLivePids/useHomeMode 换 BLE 底层,删 Settings DEV toggle"
```

---

### Task 3: HomeScreen 直读真值 + 手动连接接线

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `useLiveSession()`(phase/elapsedSec/distanceKm/error/connect)、`useLivePids()`、`useHomeMode()`

改动点(对照现文件):

1. 删 jitter 模拟:`useEffect` roll 循环、本地 `live`/`secs` state、`useState`/`useEffect` import
2. tile 值直读 `p.drive`(rpm/speed `Math.round` 取整;无值 `—`)
3. ltft amber+「略偏高」改数据驱动:`driving && |p.drive| >= 5`(阈值对齐 mock 故事线;D 接 AI 分析后替代)
4. oil「车型未提供」note 仅在无读数时显示
5. 时长/里程来自 session(`elapsedSec`/`distanceKm.toFixed(1)`),删硬编码 `8.6 km`
6. 「手动连接」接 `connect()`,label 按 phase:idle`手动连接`/scanning`扫描中…`/connecting`连接中…`/error`连接失败 · 点按重试`;scanning/connecting 禁点。**顺带修 A 的 bug:裸字符串子节点包进 `<Text>`**(RN 要求,真机会 throw)
7. error phase 在 hint 区显示错误信息

- [x] **Step 1: `HomeScreen.tsx` 全量替换**

```tsx
import { View, Text, Pressable } from 'react-native';
import { useMemo } from 'react';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { AskButton } from '../components/AskButton';
import { StatTile } from './components/StatTile';
import { useTheme } from '../context/Theme';
import { useLivePids } from '../hooks/useLivePids';
import { useVehicle } from '../hooks/useVehicle';
import { useHomeMode } from '../hooks/useHomeMode';
import { useLiveSession } from '../ble/LiveSession';

// Home — 实时。对照 prototype/screensA.jsx HomeScreen。
// B 阶段起数据来自真 BLE(LiveSession),不再有 mock jitter 模拟。
export function HomeScreen() {
  const t = useTheme();
  const pids = useLivePids();
  const vehicle = useVehicle();
  const { mode } = useHomeMode();
  const { phase, elapsedSec, distanceKm, error, connect } = useLiveSession();
  const driving = mode === 'driving';

  const mmss = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;
  const connLabel =
    phase === 'scanning' ? '扫描中…' : phase === 'connecting' ? '连接中…' : phase === 'error' ? '连接失败 · 点按重试' : '手动连接';
  const connBusy = phase === 'scanning' || phase === 'connecting';

  const s = useMemo(
    () => ({
      heroRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, padding: 18 },
      heroIconWrap: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: driving ? `${t.green}22` : t.fill,
        alignItems: 'center' as const, justifyContent: 'center' as const,
      },
      heroTitle: { color: t.label, fontSize: 19, fontWeight: '600' as const },
      heroSub: { color: t.label2, fontSize: 14, marginTop: 2 },
      heroFooterRow: { flexDirection: 'row' as const, borderTopWidth: 0.5, borderTopColor: t.sep },
      heroCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
      heroCellRight: { borderLeftWidth: 0.5, borderLeftColor: t.sep },
      heroCellLabel: { color: t.label2, fontSize: 12 },
      heroCellValue: {
        color: t.label, fontSize: 22, fontWeight: '600' as const,
        fontVariant: ['tabular-nums' as const], marginTop: 2,
      },
      manualConnWrap: { paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: 0.5, borderTopColor: t.sep },
      manualConnText: { color: t.orange, fontSize: 16, fontWeight: '500' as const, textAlign: 'center' as const },
      sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
      tilesWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
      idleHint: { color: t.label3, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40, paddingTop: 10, lineHeight: 18 },
      errorHint: { color: t.red, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40, paddingTop: 10, lineHeight: 18 },
    }),
    [t, driving],
  );

  return (
    <Screen title="实时" right={<AskButton />}>
      {/* Connection hero */}
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <View style={s.heroRow}>
          <View style={s.heroIconWrap}>
            {driving ? (
              <Icon name="checkcircle" size={34} color={t.green} />
            ) : (
              <Icon name="bluetooth" size={26} color={t.label2} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroTitle}>{driving ? '已连接' : '等待连接'}</Text>
            <Text style={s.heroSub}>
              {driving
                ? `${vehicle.adapter} · ${vehicle.name} ${vehicle.model.split(' · ')[1]}`
                : '上车后自动连接,无需操作'}
            </Text>
          </View>
        </View>
        {driving ? (
          <View style={s.heroFooterRow}>
            <View style={s.heroCell}>
              <Text style={s.heroCellLabel}>本次行程</Text>
              <Text style={s.heroCellValue}>{mmss}</Text>
            </View>
            <View style={[s.heroCell, s.heroCellRight]}>
              <Text style={s.heroCellLabel}>里程</Text>
              <Text style={s.heroCellValue}>{distanceKm.toFixed(1)} km</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={connect}
            disabled={connBusy}
            style={({ pressed }) => [s.manualConnWrap, (pressed || connBusy) && { opacity: 0.6 }]}
          >
            <Text style={s.manualConnText}>{connLabel}</Text>
          </Pressable>
        )}
      </Card>

      <Text style={s.sectionLabel}>{driving ? '实时数据 · 持续更新' : '连接后显示实时数据'}</Text>
      <View style={s.tilesWrap}>
        {pids.map((p) => {
          const has = driving && p.drive != null;
          const isInt = p.key === 'rpm' || p.key === 'speed';
          const v: string | number = has ? (isInt ? Math.round(p.drive!) : p.drive!) : '—';
          const ltftHigh = has && p.key === 'ltft' && Math.abs(p.drive!) >= 5;
          const col = p.key === 'coolant' ? t.blue : ltftHigh ? t.amber : t.label;
          const note = p.key === 'oil' && !has ? p.note : ltftHigh ? '略偏高' : undefined;
          return (
            <StatTile
              key={p.key}
              label={p.label}
              value={v}
              unit={p.unit}
              note={note}
              color={col}
            />
          );
        })}
      </View>
      {phase === 'error' && error ? <Text style={s.errorHint}>{error}</Text> : null}
      {!driving && phase !== 'error' ? (
        <Text style={s.idleHint}>
          连接成功与断开时都会推送通知并响铃,你无需一直盯着这个页面。
        </Text>
      ) : null}
    </Screen>
  );
}
```

- [x] **Step 2: 门禁**

Run: `npx tsc --noEmit`
Expected: 无输出(绿)

- [x] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat(B): HomeScreen 直读 BLE 真值,手动连接接 LiveSession"
```

---

### Task 4: PR(标注未经真机验证)

- [x] **Step 1: 全量门禁复跑** `npx tsc --noEmit` → 绿
- [x] **Step 2: push + 开 PR**,body 必含:
  - `Closes #9` 引用
  - **「未经真机验证」标注**(AGENTS.md Hard rule)
  - 真机验证清单(spec §5):① scan→connect→streaming 全流程 ② tile 真值每轮更新 ③ 时长/里程走表 ④ 拔适配器落 error 可重试 ⑤ Settings 无 DEV toggle
- [x] **Step 3: CI 绿后按 ADR-0007 merge commit 合并**(作者 agent 自 merge;纯代码改动,非 L1)

# Sub-project B — 实时 tab 接真 BLE PID stream(设计)

日期:2026-07-19 · Task issue:#9 · 上游:sub-project A(PR #8,merge `86e26e7`)

## 1. 目标与范围

把 Home(实时)tab 的数据源从 mock 切到真 BLE PID stream(OBDLink CX,`src/ble/` + `src/obd/` 已有完整逻辑,App.debug.tsx 是参考实现)。

**范围内**:

- Home tile 数据来自 `BleTransport + ElmSession` 的 live PID 轮询
- 连接状态 idle/driving 由 BLE 真实状态派生(`useHomeMode` 改派生值,删 Settings 的 `__DEV__` toggle)
- 「手动连接」按钮接真实 scan/connect 流程
- 保留 `useLivePids(): LivePid[]` 接口契约(实现换底层)

**范围外**(明确不做):

- 其它 4 个 tab(历史/趋势/健康/设置)仍走 mock —— C 接持久化,D 接 AI
- 上车自动连接(后台 BLE / 系统事件)—— 本轮只做手动触发,Settings 的「自动连接」toggle 仍是 UI 摆设
- 样本持久化 / 行程记录 —— C 的事
- App.debug.tsx 不动(BLE 开发期日志参考,B 完成后再决定去留)
- README / 协议文件不动(Protocol gap #6 与 B 并行)

## 2. 备选方案

| 方案 | 说明 | 取舍 |
|---|---|---|
| **A. 全局 context provider(选定)** | 新建 `LiveSessionProvider` 独占 transport/session 生命周期,hook 派生 | 连接生命周期高于 navigation,tab 切换不断连;`useHomeMode` 天然全局(修掉 A 阶段 per-component useState 的隐患) |
| B. 模块级单例 + 事件订阅 | 无 provider,hooks 订阅 emitter | 多写一层订阅管线,与现有 React 惯例不合 |
| C. 逻辑放 HomeScreen 本地 | 最少文件 | 连接状态被组件生命周期绑架;Settings/后续 tab 拿不到状态 |

## 3. 架构

### 3.1 `src/ble/LiveSession.tsx`(新)

```ts
export type LivePhase = 'idle' | 'scanning' | 'connecting' | 'streaming' | 'error';

interface LiveSessionValue {
  phase: LivePhase;
  values: Record<string, number>; // UI key → 最新读数
  elapsedSec: number;             // streaming 起算的秒数
  distanceKm: number;             // 车速积分里程
  error: string | null;
  connect(): void;                // idle/error 时可调
  disconnect(): Promise<void>;
}
```

- **状态机**:`idle → scanning → connecting → streaming`;任一步失败 → `error`(带 message);`disconnect()` 回 `idle`。
- **scan**:`BleTransport.startScan`,设备名匹配 `/OBD|CX|LINK|STN|VLINK/i` 即停扫并连接(`BleTransport.connect` 内部 ATZ probe 兜底防连错设备);30 秒无匹配 → 停扫、`error: '未扫描到 OBD 适配器'`。
- **connecting** 覆盖 GATT 发现 + `ElmSession.init()`(ELM 初始化 + 总线探测)。
- **poll 循环**:App.debug.tsx 同款——`while (polling) for (pid of PIDS) queryPid`;成功样本写 `values`(经 key 映射);查询抛错 → 停轮询、断连、`error`。
- **key 映射**(OBD → UI,与 `MOCK.livePids` 的 key 对齐):`rpm→rpm, speed→speed, coolant_temp→coolant, oil_temp→oil, stft_b1→stft, ltft_b1→ltft`。
- **里程**:speed 样本间梯形积分(`km/h × Δt`),Δt 取样本 `t` 差。
- **oil 读不到**(BMW 常见):`queryPid` 返回 null 不是错误,tile 保持 `—` + 「车型未提供」note,轮询继续。
- Android 权限:connect() 前 `PermissionsAndroid.requestMultiple`(BLUETOOTH_SCAN/CONNECT + FINE_LOCATION),沿用 App.debug.tsx。
- transport 单例:provider 生命周期内一个 `BleTransport`(懒创建,unmount 时 `destroy()`);日志走 `console.log`(详细日志 UI 仍看 App.debug.tsx)。

### 3.2 Hook 改动

- **`useLivePids()`**:签名不变(`(): LivePid[]`)。实现 = `MOCK.livePids` 的展示元数据(key/label/unit/note)+ `values` 合并:`idle`/`drive` 都填最新真值(无值为 null),`jitter: 0`。mock 的假数值不再出现在 Home。
- **`useHomeMode()`**:`{ mode: phase === 'streaming' ? 'driving' : 'idle' }`。删 `setMode`/`toggle`。

### 3.3 Screen 改动

- **HomeScreen**:删 jitter 模拟 effect 与本地 `live`/`secs` state;tile 值直读 `p.drive`(rpm/speed 取整显示);时长/里程来自 session(`elapsedSec`/`distanceKm`,里程一位小数);「手动连接」按 phase 显示:idle `手动连接` / scanning `扫描中…` / connecting `连接中…` / error `连接失败 · 点按重试`(scanning/connecting 时禁点);error 时在 hint 区显示错误信息。ltft tile 的 amber+「略偏高」改为数据驱动:`driving && |ltft| ≥ 5%`(阈值对应 mock 故事线,D 接 AI 后由分析替代);oil 的「车型未提供」note 仅在无读数时显示。
- **SettingsScreen**:删「开发选项(DEV)」Group 与 `useHomeMode` import。
- **App.tsx**:`<LiveSessionProvider>` 包 `<RootNavigator/>`。

## 4. 错误处理

- scan 超时 / 连接失败 / ELM init 失败 / 轮询中断:统一落 `error` phase + 中文 message,Home 可见并可重试。
- 适配器主动断开(`onDisconnected`):当前轮询请求会超时抛错,走同一条 error 路径(不另做断开监听通道)。
- 重试 = 再次 `connect()`,全流程重走(重新 scan)。

## 5. 测试与验收

- 门禁:`npx tsc --noEmit` 绿(V0 无测试套件,ADR-0014)。
- **BLE 行为需真机 + OBDLink CX 验证**(AGENTS.md Hard rule)。本棒无真机条件时,PR 明确标注「未经真机验证」,真机验证清单写进 PR body 留 stanyan 执行:① 冷启动 scan→connect→streaming 全流程 ② tile 出真值、每轮更新 ③ 时长/里程走表 ④ 拔适配器落 error 并可重试 ⑤ Settings 无 DEV toggle。

## 6. 契约保持(issue #9 明确要求)

- 5 个数据 hook 返回类型不变;`src/data/mock.ts` interface 不动。
- TAB_META / RootNavigator 不动。

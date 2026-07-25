# 0004 — Live Activity 集成:expo-widgets + Provider 内注入

日期: 2026-07-25
状态: 已接受(L2 — 新功能,不改协议)

## 背景

用户需求:logging 时 iPhone 灵动岛 + 锁屏 widget 显示实时状况。
验证「最险的一环」——OBD 数据能否从 RN 流到 widget。
MVP 范围:只显示 水温(coolant)+ STFT + phase 状态。

## 决策

1. **用 `expo-widgets`(~57.0.6,Expo 官方 stable)+ `@expo/ui/swift-ui`** 定义
   Live Activity UI。不写 Swift/ActivityKit 原生代码,config plugin 在 prebuild 时
   自动生成 Widget Extension target + Info.plist(`NSSupportsLiveActivities` 等)。
2. **Live Activity 不放进 `app.json` 的 `widgets` 数组**。该数组是 home screen
   widget 配置(每项是 `{ name, displayName, supportedFamilies, ... }` 对象,
   驱动生成 `Name.swift` 的 `Widget` struct)。Live Activity 用 `createLiveActivity`
   在 RN 代码定义,运行时通过 app group 共享 layout 字符串,extension target 只承载
   框架提供的 `WidgetLiveActivity()` 运行时(见生成的 `index.swift`)。
   正确配置:`plugins: [["expo-widgets", { widgets: [] }]]`(空数组只为触发
   iOS extension target 生成)。
3. **注入点选 `LiveSessionProvider` 内部**,不另起独立 watcher。Provider 已持有
   `phase` + `values` 的完整 state + ref 双写,跨 BLE 重连存活。
4. **数据出口放 `startPolling` 的 `setValues` callback 内**,而非 `useEffect`
   监听 `values`。callback 内能拿到最新 `next` 值同步推给原生,避免多一跳
   React render + `Record` 浅比较可能漏更新。
5. **Activity instance ref 化,跨 phase 变化保持**。phase 在 streaming/error
   间切(grace 期间),activity 不该销毁重建,只 update。
6. **`finalizeTrip` 是 end 的单一入口**。grace 超时和手动 disconnect 都汇到这里;
   grace 期间(20s 重连窗口)不 end,activity 跨重连保持显示最后数据。
7. **iOS-only**。`useObdActivity` 在 Android 返回 noop(expo-widgets 在 Android
   无效),避免将来 Blackbox 跑 Android 时崩。

## 理由

- **expo-widgets 是唯一正确答案**。官方维护,SDK 56 起 stable,SDK 57 兼容。
  竞品 `expo-live-activity` 已归档(Software Mansion 2026-06 标 deprecated),
  `react-native-activity-kit` 社区方案处于 alpha,生产风险高。
- **Provider 内注入 vs 独立 watcher**:Provider 是 phase + values 的唯一事实源,
  独立 watcher 要重复订阅 context 且 provider 卸载时生命周期难管。
- **callback 内推 vs useEffect 监听**:OBD 每秒多次 setValues(6 PID 顺序查),
  useEffect 会多一跳 render 且 `values` 是 `Record<string, number>`,浅比较在
  「同 key 新值」时虽然能触发,但在 callback 内直接取 `next` 语义更清晰、更即时。
- **500ms 节流**:驾驶场景水温/STFT 变化慢,500ms 足够,且避免每个 PID 采样
  都打原生 bridge 卡 UI。

## 文件

- `src/widgets/ObdLiveActivity.tsx` — Live Activity UI 定义(createLiveActivity
  factory,default export)
- `src/widgets/useObdActivity.ts` — 生命周期 hook(start/update/end + 节流)
- `src/ble/LiveSession.tsx` — 三处接线(Provider 顶部 / startPolling / finalizeTrip)
- `app.json` — plugins 加 `['expo-widgets', { widgets: ['ObdLiveActivity'] }]`

## 后果

- **必须 `npx expo prebuild --clean`** 重新生成 `ios/` —— config plugin 会加
  Widget Extension target。本地 `ios/` 任何手改会丢(Blackbox 是标准 CNG,无手改)。
- **必须真机验证**(AGENTS.md Hard rule 第 3 条)。模拟器 Live Activity 支持有限,
  灵动岛需 iPhone 14 Pro+。
- **`@expo/ui` 升为直接依赖**(原本是 expo-widgets 的嵌套 dep)。不提升到顶层
  则 `import '@expo/ui/swift-ui'` 找不到模块。
- **增加 `npx tsc --noEmit` 的类型覆盖面**:widget 文件的 `LiveActivityLayout`、
  `LiveActivityEnvironment` 等类型现在进编译范围。

## 什么前提失效时该推翻

- **expo-widgets 被 Expo 弃用或 API 大改** → 评估迁移到原生 ActivityKit
  (需 eject 出 Widget Extension + Swift 代码,工作量大)
- **实测 update 卡顿即使 500ms 节流也不够** → 改 push token + 后端 APNs
  方案(但 Blackbox 无后端,需先决定是否引后端,违反「无后端」范围)
- **MVP 验证后需要 timer/里程/颜色阈值/三状态徽章** → 在现有 `ObdActivityProps`
  扩字段 + widget 组件加插槽内容,架构不变
- **Apple 收紧 Live Activity 限制**(时长 / 启动条件 / 数据量)→ 重新评估是否值得

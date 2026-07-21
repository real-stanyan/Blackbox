# ADR-0027: 后台 BLE + 自动连接/自愈重连

- 状态: Accepted
- 日期: 2026-07-21
- 相关: issue #15,真车测试(BMW 1系 F20 + OBDLink CX)

## 背景

2026-07-21 首次真车测试。BLE fix 327184c 的 connect 路径验证通过(手动连上跑数据)。同时暴露两个问题:

1. **自动连接是空头支票**:HomeScreen 文案「上车后自动连接,无需操作」,但 `src/` 里没有任何 mount 时自动调 `connect()` 的代码,只有手动按钮。Settings「自动连接」开关只改本地 `useState`,没接线。
2. **熄屏丢数据**:锁屏 → iOS 挂起 app → 轮询 `write('010D')` 等 notify 超时 → `连接中断`。根因是从没开过 iOS 后台 BLE。

## 决策

**后台执行模型 = 前台 BLE central + iOS `bluetooth-central` 后台模式。**

- `app.json` ble-plx 插件:`isBackgroundEnabled: true` + `modes: ["central"]`。prebuild 时写入 `UIBackgroundModes: ["bluetooth-central"]`,连接中的 central 操作在熄屏/切后台时不被挂起。
- `LiveSession` 引入「连接意图」`wantConnRef`(默认 true):挂载即自动连接;任何掉线(`fail`)只要意图仍为 true 就 4s 后自愈重连;手动 `disconnect()` 才把意图置 false 停止重连。

**为什么不选保持亮屏(keep-awake):** 本 app 定位是行车黑盒记录仪,手机可能在兜里/支架熄屏,全程亮屏既费电也不符使用场景。后台 BLE 才是正解。代价:iOS 后台 BLE 有节流/状态恢复的坑,且 App Store 审核会问用途 —— 接受,靠真车复测兜底。

## 权衡与未决

- **需真车复测**(Hard rule):后台 BLE + 自动重连都没在真机验证过,本轮 build 标注未验证。
- **Settings 开关未接线**:当前自动连接恒为开。整个 SettingsScreen 仍是 mock(硬编码值 + 空 onClick)。接线 + 持久化(SecureStore/AsyncStorage)另开 follow-up issue,不在本 ADR 范围。
- **无 BLE state restoration**:未设 `restoreStateIdentifier`,app 被系统杀掉后不自动恢复连接。只覆盖「会话中熄屏」,不覆盖「冷启动自动接管」。后续可加。

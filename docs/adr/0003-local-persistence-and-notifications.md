# 0003 — 本地持久化选文件不选数据库;通知走纯本地

日期: 2026-07-24
状态: 已接受(stanyan 会话内同意, L1)

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

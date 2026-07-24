# Sub-project D — CarPlay 仪表盘 + 5 分钟滚动 LLM 评分

日期:2026-07-24
状态:已获 stanyan 会话内批准(含 L1 新依赖同意)

## 目标

1. iPhone 连 CarPlay 时,车机屏显示本 app:分数 + 问题描述 + 实时发动机数据(模板 UI)
2. 行程期间每 5 分钟把近 5 分钟数据摘要发 MiniMax M3,返回两项:
   - `score`:0-100 整数
   - `problem`:英文问题描述,5-20 词
3. 结果同步显示在手机 Home 卡片,并附进行程记录供回看

## 非目标

- 不做 Android Auto
- 不做 CarPlay 自定义 UI(第三方只能用 Apple 模板;自由布局仅车厂可用)
- 不做多页 CarPlay 导航结构(单屏)
- 不改既有行程结束后的整程分析(analyzeTrip 保持原样,两者独立)

## 硬约束(先读)

- **CarPlay entitlement**:`com.apple.developer.carplay-driving-task`,必须 stanyan 本人在 Apple Developer 网站申请,数周,可能被拒。批下来之前:
  - CarPlay Simulator(Mac,Xcode additional tools)可验证 UI——simulator 不校验 provisioning
  - simulator 无 BLE,真数据链路测不了;真车 CarPlay 必须等批
- 库:`@g4rb4g3/react-native-carplay`(fork,2.7.x,RN 0.76+ 新架构)。上游 birkir 原版不支持新架构与 Expo,排除。fork + Expo 57 组合无官方背书——CarPlay Simulator 跑不通则降级为手写 Swift native module(另开 spec)
- Expo API 用法以 https://docs.expo.dev/versions/v57.0.0/ 为准(硬规则)

## 1. 滚动分析引擎

`src/analysis/liveScore.ts`:

- 触发:行程 streaming 期间定时器,t=5min 起每 5 分钟一次;行程结束停
- 输入:近 5 分钟窗口样本的**压缩统计**(每通道 min/mean/max + 异常事件列表),不发原始样本
- 调 MiniMax M3(复用 `minimax.ts` 的 BASE_URL / SecureStore key / JSON 校验套路)
- 输出校验:score clamp 0-100 取整;problem 按空格分词,>20 词截断到 20,<5 词或空则视为无效整条丢弃;非法 JSON 丢弃
- 失败(无 key / 网络 / 非法响应):保留上次结果标 stale,不重试不打断
- 一切正常时 problem 类似 "All parameters nominal"

`src/data/liveScoreStore.ts`:

- useSyncExternalStore 模式(同现有 store)
- 状态:`latest: {score, problem, at, stale} | null` + 当前行程内历史 `timeline: {t, score, problem}[]`
- 行程结束:timeline 附进 TripRecord 新字段 `scoreTimeline`(可选字段,旧记录无此字段照常读);行程被丢弃(太短)则 timeline 一起丢
- 新行程开始清空

## 2. CarPlay 层

`src/carplay/`:

- 库:`@g4rb4g3/react-native-carplay`
- 单屏模板(Information 或 List,实现时按 fork 支持度选),行:
  1. 分数(如 "Score: 87")
  2. 问题描述
  3. 连接状态(已连接 OBDLink CX / 未连接)
  4. 转速 5. 水温 6. 车速 7. LTFT
- 实时行随 livePids 刷新(≈1s);分析行随 5 分钟更新;未连接时只显示状态行 + 空态文案
- `plugins/withCarPlay.js` 本地 config plugin:注入 Info.plist scene manifest(CPTemplateApplicationScene)+ entitlement;app.json 挂载
- CarPlay 连接/断开事件驱动模板挂载/卸载;app 冷启动被 CarPlay 唤起时也能挂载

## 3. 手机侧 UI

- HomeScreen 新增实时分析卡:分数大字 + problem + 更新时间 + stale 标记;无行程/无结果时不显示或空态
- TripDetailScreen:有 `scoreTimeline` 的行程加分数曲线小图(复用现有 series 图样式)
- UI 细节实现阶段加载 `apple-design` skill

## 4. 协议/门禁

- 新依赖 `@g4rb4g3/react-native-carplay` + 本地 config plugin = AGENTS.md Tech stack 变更 = **L1**,stanyan 已会话内同意;走 issue + ADR + PR
- 门禁 `npx tsc --noEmit` 全绿
- 验证分级:CarPlay Simulator 验证 UI;BLE + CarPlay 全链路标注「未经真车验证」(硬规则);entitlement 申请步骤写进 README

## 测试与验证

- liveScore 压缩统计 / 输出校验为纯函数,`scripts/test-analysis.ts` 模式离线跑
- CarPlay Simulator 清单:模板挂载、行刷新、未连接空态、断开 CarPlay 后 app 正常
- 真机(手机侧):5 分钟定时触发、Home 卡更新、scoreTimeline 落盘、无 key stale 路径

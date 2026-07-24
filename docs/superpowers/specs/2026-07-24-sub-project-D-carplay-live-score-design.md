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

## 硬约束(先读,2026-07-24 研究修订)

- **CarPlay entitlement**:`com.apple.developer.carplay-driving-task`(Apple CarPlay Developer Guide 2026-06 确认,iOS 16+),必须 stanyan 本人在 https://developer.apple.com/carplay 申请,数周,可能被拒。**Apple 原文:「Xcode and Simulator require a Provisioning Profile that supports CarPlay」——批前连 CarPlay Simulator 都进不去。** 决策(stanyan 2026-07-24):CarPlay 层盲写,标「未经验证——等 entitlement」;手机侧(分析引擎/Home 卡/scoreTimeline)照常真机验证
- **刷新节流(Apple driving-task 硬规则)**:「Do not periodically refresh data items in the CarPlay UI more than once every 10 seconds (for example, no real-time engine data)」——CarPlay 行刷新 ≥10 秒/次,不做秒级实时
- 库:`@iternio/react-native-auto-play`(react-native-carplay 官方后继,维护者同一批人;g4rb4g3 fork 与 birkir 上游均已归档/停更,排除)。Nitro Modules,新架构 only,自带 scene delegate(Info.plist 只引类名)。附带要求:`react-native-nitro-modules` peer dep、`patch-package`(expo-splash-screen 57.0.2 补丁 + react-native 补丁——上游钉 0.83.5,0.86 需验证/重做)、`expo-build-properties` 设 `buildReactNativeFromSource: true`。RN 0.86 组合无人验证过——tsc + 手机侧构建通过即算本轮完成,CarPlay 渲染等 entitlement
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

- 库:`@iternio/react-native-auto-play`,`InformationTemplate`(iOS 上限 **4 行** TextRow,无图)
- 4 行(10 秒节流刷新,合规):
  1. Score + 问题描述(title = "Score: 87",detailedText = problem;无分析时 "—" / "Waiting for analysis")
  2. 水温(慢变量,10 秒粒度有意义)
  3. LTFT
  4. 行程(时长 + 里程)
- OBD 未连接时 4 行换空态文案("Not connected · start driving");转速/车速不上 CarPlay(10 秒一跳无意义且踩 Apple 红线)
- 挂载模式(库文档唯一支持路径):`registerAutoPlay()` 在 index.ts 注册 `HybridAutoPlay.addListener('didConnect')`,**didConnect 回调内**才构造 InformationTemplate 并 `setRootTemplate()`;didDisconnect 清理定时器
- `plugins/withCarPlay.js` 本地 config plugin:注入 Info.plist `UIApplicationSceneManifest`(引库自带 delegate 类名:HeadUnitSceneDelegate / WindowApplicationSceneDelegate 等)+ entitlements `com.apple.developer.carplay-driving-task` + AppDelegate `getRootViewForAutoplay` patch;app.json 挂载
- 全层盲写:tsc 过 + 手机 build 不崩 = 本轮完成;CarPlay 渲染验证等 entitlement

## 3. 手机侧 UI

- HomeScreen 新增实时分析卡:分数大字 + problem + 更新时间 + stale 标记;无行程/无结果时不显示或空态
- TripDetailScreen:有 `scoreTimeline` 的行程加分数曲线小图(复用现有 series 图样式)
- UI 细节实现阶段加载 `apple-design` skill

## 4. 协议/门禁

- 新依赖 `@iternio/react-native-auto-play` + `react-native-nitro-modules` + `patch-package` + `expo-build-properties` + 本地 config plugin = AGENTS.md Tech stack 变更 = **L1**,stanyan 已会话内同意;走 issue + ADR + PR
- 门禁 `npx tsc --noEmit` 全绿
- 验证分级:CarPlay 层整体标注「未经验证——等 entitlement」(硬规则精神);手机侧真机验证;entitlement 申请步骤写进 README

## 测试与验证

- liveScore 压缩统计 / 输出校验为纯函数,`scripts/test-analysis.ts` 模式离线跑(新增 `scripts/test-livescore.ts`)
- CarPlay 层:tsc + 真机 build 不崩(模块 import 不炸)= 本轮验收;渲染/交互清单留给 entitlement 批后(模板挂载、10 秒行刷新、未连接空态、断开 CarPlay 后 app 正常)
- 真机(手机侧):5 分钟定时触发、Home 卡更新、scoreTimeline 落盘、无 key stale 路径

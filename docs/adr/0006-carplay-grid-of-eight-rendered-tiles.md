# ADR-0006: CarPlay 仪表盘用 GridTemplate 八格,格子内容是运行时渲染的 PNG

- Date: 2026-07-26
- Status: accepted

## Context

CarPlay Driving Task App 的 entitlement 批下来了。需求是在车机屏上显示「比较全面的 dashboard,带数据可视化图表」——单位面积信息量要高,不是一行一个通道的列表。

Driving Task 类 app 的硬约束(已核实,非推测):

- 只能用 `CPInformationTemplate` / `CPListTemplate` / `CPGridTemplate` / `CPTabBarTemplate` / `CPAlertTemplate` / `CPActionSheetTemplate`。**调用名单外的模板是运行时报错**,不是效果打折。
- **不能自绘 UI**。Apple 文档原话是 custom maps、real-time video 一类都不可能。可自绘 scene 只给 Navigation 类 entitlement。
- 布局、字号、间距、行高全部由 iOS 渲染,app 只提供数据。
- `CPGridTemplateMaximumItems` = 8(iOS 26),第 9 个之后的按钮被系统直接忽略。
- `CPListTemplate` 上限 24 行 / 50 段;`CPInformationTemplate` **只支持 1–4 行**,且不接受图片。

于是「密度」这个需求只有三条路:

1. **Information 纯文字** — 4 行上限,6 个通道放不下,一张图都画不了。
2. **List 混排** — 24 行,每行可带一张小图 + 较长说明文字。一屏能看约 6 行。
3. **Grid 八格** — 8 个格子并排,每格一张图 + 系统渲染的一行 title。

issue #21 最初的计划是第 1 条(Information 4 行 / 10 秒节流)。做了 HTML 原型逐条对照后,它在「全面 dashboard」这个需求下不成立。

关键突破口:**Grid 格子和 List 行都接受一张图片,而那张图我可以随便画。** 所以「图表」在 Driving Task 里是可行的 —— 把 sparkline / 区间条运行时渲染成 PNG 塞进去。

## Decision

**CarPlay 根模板是 `CPGridTemplate`,8 个格子,每格图片是运行时渲染的 PNG。**

- **格子分配吃满上限**:6 个通道各一格(`CARPLAY_CHANNELS` 顺序,有阈值的排前面),第 7 格行程概要(4 字段),第 8 格告警(4 字段)。本项目正好 6 通道,不需要分页。
- **一格六条信息**:阈值、状态点、大数值、单位、带正常区间的走势、峰值与余量。
- **通道名不画在格子里** —— 系统已经在格子下方渲染 `titleVariants`,画第二遍等于白占一行。这是相对「一格一指标」的密度增量,也是本 ADR 的核心取舍。
- **呈现方式按通道性质选,不一刀切**:温度和短期修正给走势图(趋势本身就是信息);长期修正给区间条(漂移以分钟计,画趋势线是浪费像素,要读的是离 ±8 还有多远);无阈值通道照样给走势图但状态点判灰,不判绿 —— 别让读者以为灰 = 正常。
- **小格子按 tier 降级**:≥200px 六条全给;≥150px 去掉峰值余量行;<150px 只留数值和走势。格子尺寸上限是运行时属性 `CPGridTemplate.maximumGridButtonImageSize`,Apple 未公开固定值、随车机 scale 变,库也没暴露到 JS —— 所以尺寸是 `CarPlayHost.TILE_PT` 一个常量,真机读到实际值后调,tier 自动跟着降。**宁可少画,不硬塞读不清的小字。**
- **几何层与渲染层分离**,照 `tripChartGeom.ts` 的既有做法:`tileGeom.ts` 输出图元列表(纯函数、不 import react),两个渲染器共用同一份几何 —— `tileSvg.ts` 出 SVG 字符串供 `scripts/test-carplay-tile.ts` 离线肉眼验收,`TileSvgView.tsx` 出 react-native-svg 组件树供真机 `toDataURL()` 光栅化。越界分段不重写,直接复用 `buildTripChartLayout`。
- **阈值仍然只来自 `bands.ts`**(ADR-0005 不变)。PID key ↔ UI key 的映射从 `LiveSession.tsx` 抽到 `data/channelKeys.ts`,两处共用 —— CarPlay 要拿 UI key 的实时值反查 PID key 的阈值,就地再抄一份就成了第二套真相。

## Consequences

- **拿到了图表,但很小。** 8 格 × tile² 的可画面积,在 1280×720 上约占屏 13%(120px)到 50%(240px),取决于运行时上限。行车中一秒内能读到的只有状态色条、大数字、红色越界段 —— 设计目标因此是「让红色显眼」,不是「让曲线好看」。
- **格子里的轴按数据缩放,不把阈值拉进视野**(`buildTripChartLayout` 新增 `includeBandInAxis` 选项,默认 true 不影响行程大图)。原因:在 240px 的格子里把 ≤115 拉进视野会让 25–90 的数据挤成底部一条线,曲线形状读不出来;而阈值已经用文字和余量表达了。越界仍会转红 —— 判据是数值,不是轴。
- **新增两个依赖**:`@iternio/react-native-auto-play` + `react-native-nitro-modules`。选它的理由:另两个候选(`birkir/react-native-carplay` 停在 RN 0.60、`@g4rb4g3/react-native-carplay` 停在 RN 0.79)都覆盖不到本项目的 RN 0.86;它走 Nitro Modules 原生支持新架构,且在 2026-07-24 仍有更新。这条动了 AGENTS.md 的 Tech stack,属 L1。
- **config plugin 自己写**(`plugins/withCarPlayDrivingTask.js`):该库的 package.json 在 `files` 里声明了 `app.plugin.js`,但 0.5.11 的 tarball 里没有这个文件。刻意不声明 Dashboard / InstrumentCluster scene —— 那是导航类 app 的东西。
- **最大的未验证风险:光栅化链路。** `toDataURL` 出 base64 → `{type:'asset', image:{uri:'data:image/png;base64,…'}}` → 原生 `RCTConvert` 的 uiImage。理论上支持 data URI,没实测。更麻烦的是 app 在后台(CarPlay 显示、手机锁屏)时屏幕外 Svg 还能不能绘制 —— 若不能,只能改成原生 Swift 画格子,或退回纯文字模板。这条推翻本 ADR 的图片方案,但不推翻「用 Grid 而不是 Information」的结论。
- **其他待真机确认**:`maximumGridButtonImageSize` 实际返回值 · 每 2 秒重推 8 张 PNG 的开销 · iOS 26 之前 Grid 的布局 bug(4–6 个按钮会挤成一行,beta 6 才修)在目标车机固件上是否存在 · scene manifest 接管手机主窗口后 Expo 的 AppDelegate 是否仍正常(读过库的 `WindowApplicationSceneDelegate`,它是复用 AppDelegate 现成的 rootViewController,设计上兼容,但配错的表现是手机端黑屏)。
- **实时阶段不出健康结论**。告警格子的「结论」给中性 info,不给「良好」—— 结论是行程结束后 `runAnalysis` 的事,车机上显示一个没有分析支撑的「良好」是误导。
- 离线验收:`npx tsx scripts/test-carplay-tile.ts --check` 10 条断言(含「SVG 标签引号必须成对」—— 踩过 `tokens.FONT` 含双引号截断 `font-family` 属性的坑,当时其余 9 条全过、图却是空白),`npx tsx scripts/test-carplay-tile.ts > x.svg` 出图肉眼看。

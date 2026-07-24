# Sub-project C — 连接通知 + 全量真数据(行程持久化 / 趋势 / LLM 分析)

日期:2026-07-24
状态:已获 stanyan 口头批准(会话内),含 L1 新依赖同意

## 目标

1. BLE 连接/断开推本地通知(后台可见)
2. 清掉 `src/data/mock.ts` 的全部假数据:trips / trends / outlook / vehicle 换真实来源
3. 接通已有分析管线(`src/analysis/features.ts` + `minimax.ts`)进 app

## 非目标

- 无后端、无云同步;一切数据留在设备本地
- 不做远程 push(APNs/FCM),只做本地通知
- 不做多车辆支持

## 1. 通知(expo-notifications,纯本地)

- 进入 `streaming` ⇒ 推「已连接 OBDLink CX」;app 在前台时不推
- 断开进入 **20 秒宽限期**:期间自愈重连成功 ⇒ 无通知,行程继续
- 宽限超时 ⇒ 判定行程结束,推一条合并通知:「已断开 · 行程已保存(时长 X 分钟 / Y km)」
- 行程被丢弃(太短)时通知只报「已断开」
- 前台不推的规则对连接/断开通知都生效(前台 UI 本身就显示状态)
- iOS 首次启动请求通知权限;被拒则静默降级(不推,功能其余照常)
- Expo API 用法以 https://docs.expo.dev/versions/v57.0.0/ 为准(硬规则)

## 2. 行程录制 + 持久化

**行程边界**:`streaming` 开始 = 行程开始;断开宽限超时 = 行程结束。时长 < 60 秒或样本 < 20 条 ⇒ 丢弃。

**TripRecorder**(挂在 `LiveSessionProvider` 内):

- 累积 `Sample[]`(内存),行程结束时:
  1. `features.ts` 提取 `TripFeatures`
  2. 降采样曲线(每通道 ≤ 120 点,画图用)
  3. 车速梯形积分算里程(沿用 B 的做法)
  4. 写 `DocumentDirectory/trips/<id>.json`
- 索引:`DocumentDirectory/trips/index.json`(id、时间、时长、里程、verdict、是否已分析)
- 写失败不吞:console 报错 + 下次启动可见(索引以文件存在为准,启动时校对)

**存储层** `src/data/tripStore.ts`:expo-file-system;API:`saveTrip` / `listTrips` / `getTrip` / `updateTripReport`。不引数据库(选型见设计讨论:文件方案贴合「无 DB」栈,几百行程量级足够)。

**UI**:`useTrips` / TripDetail 改读 tripStore;空状态「还没有行程,连上车开一段就有了」。`Trip` 展示字段(group/title/route 等)由真实数据派生:group 按日期分组,title 按时段生成(如「早高峰通勤」→ 改为「上午行程」等中性词),route 无 GPS 不再展示。

## 3. 趋势(本地聚合)

`src/data/trends.ts`:纯函数,输入已存行程,输出四张趋势:

- ltft(每行程 ltft 均值)
- 升温用时(`warmupToleranceSec`,仅冷启动行程)
- 怠速稳定性(怠速段 rpm 均值)
- 每周冷启动次数

行程少时按行程/按周显示,不硬凑 6 个月;不足 2 个数据点的图显示「数据积累中」。

## 4. LLM 分析(接通 minimax.ts)

- 行程结束存盘后自动调 `analyzeTrip`(行程报告:summary / findings / verdict)→ `updateTripReport` 写回行程文件
- 无 key / 网络失败 / 超时 ⇒ 行程照存,标「未分析」;TripDetail 提供手动重试按钮
- verdict 映射:report findings 最高 severity → Tone(inspect→inspect,watch→watch,否则 good);ruleAlerts red→inspect 兜底(本地规则不可被 LLM 降级,沿用 minimax.ts 既有约束)
- **Outlook**:新增多行程聚合调用 `analyzeOutlook`(输入 = 趋势序列 + 近 N 条 findings 摘要,复用同一 BASE_URL/校验思路);新行程分析完成后刷新,结果缓存 `DocumentDirectory/outlook.json`;无数据/未分析时 HealthScreen 显示「数据积累中」空状态
- B 阶段硬编码的 `|ltft|≥5%` 展示阈值:分析接入后由报告驱动,删除硬编码(交接 issue #12 已预告)

## 5. Settings + 车辆信息

- MiniMax API key:Settings 输入,存 expo-secure-store;不进 git、不进 bundle
- 车辆信息(名称/型号/车牌/里程基线):Settings 可编辑,存 AsyncStorage(小数据);`useVehicle` 读真值
- odo 展示 = 里程基线 + 累计行程里程
- adapter 字段来自实际连接的设备名

## 6. 收尾

- `mock.ts` 拆掉:类型迁 `src/data/types.ts`(接口字段尽量保持,`LivePid` 已在 B 换真);MOCK 常量删除
- 新依赖(均 Expo SDK 包):expo-notifications / expo-file-system / expo-secure-store(AsyncStorage 若未装则加 @react-native-async-storage/async-storage)
- **AGENTS.md Tech stack 更新 = L1**:stanyan 已在会话中同意;按协议走 issue + ADR + PR
- 门禁:`npx tsc --noEmit` 全绿
- BLE/通知行为真机验证;PR 附验证清单,未验证项按硬规则标注

## 测试与验证

- `features.ts` / `trends.ts` / verdict 映射均纯函数,`scripts/test-analysis.ts` 模式可离线跑
- tripStore 读写用小样本冒烟(dev 环境)
- 真机清单:连接通知(后台)、闪断不打扰、20s 超时断开通知、行程落盘、重启后 History 仍在、无 key 时「未分析」路径、填 key 后重试成功

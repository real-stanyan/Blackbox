# ADR-0005: 图表上的正常/异常区间来自本地阈值表,不来自 LLM

- Date: 2026-07-25
- Status: accepted

## Context

行程报告页原本只有文字:概要网格 + LLM 的 findings。用户看不到自己那 6700 个采样点长什么样,也无法判断 LLM 说的「STFT 波动较大」相对什么基准算大。需求是把抓取到的数据画成曲线,并在图上标出哪些区间正常、哪些异常。

「异常区间」的数值可以有三个来源:

1. **本地阈值表** — 代码里定死的每通道正常区间。
2. **LLM 输出** — 扩 `minimax.ts` 的 JSON schema,让模型每条 finding 附 `{channel, normalMin, normalMax}`。
3. 两者叠加。

第 2 条有两个实际问题。一是现有 validator 只校验 evidence 里引用的数字确实出现在输入 features 中(`minimax.ts` `validateFinding`),它管不住新字段——模型可以给出一个凭空的 `normalMax`,画到图上就成了带权威感的假阈值,而这张图正是给不懂 OBD 的人看的。二是已经落盘的 `trips/<id>.json` 里的 `report` 没有这些字段,老行程画不出区间,同一个界面出现两种可信度。

## Decision

**图表的正常/异常区间只来自本地阈值表 `src/analysis/bands.ts`;LLM 那层只负责「这条通道被 finding 点名了」。**

三条约束:

- `bands.ts` 同时导出 `RULE_THRESHOLDS`(features.ts 的 `ruleAlerts` 直接引用)和 `CHANNEL_BANDS`(画图用的单点区间)。规则层与图形层共用同一批数字,不允许出现「规则判 115、图上画 110」。
- **band 里每个数字必须能追溯到一条本地规则**。没有可辩护阈值的通道(rpm / speed)不画区间,只画曲线,卡片上明写「该通道无本地阈值」。宁可缺信息,不可造阈值。
- band 只在有意义的那一侧设界。水温、油温只设上限——水温低是暖机,不是故障,给它画个下限会把每次冷启动都标成红色。
- AI 层的通道归属由 `verdict.ts` 的 `findingChannels()` 从 finding 文本 + evidence 里推断(`stft_b1` 这类 key 按 prompt 约定会被原样引用,另有中文别名兜底)。认不出来就是空数组:图照常画,只是不挂徽标。**不改 prompt、不改 schema、不改 validator**,因此老行程与新行程表现一致。

## Consequences

- 阈值的正确性成了代码审查问题,而不是模型行为问题——可 diff、可回溯、可在 PR 里吵。
- 代价:区间是通用阈值,不随车型/工况自适应。BMW 特定标定值以后要么进 `bands.ts` 做成按车型查表,要么走另一条(带校验的)结构化 LLM 通道;那时再开 ADR 推翻本条。
- `findingChannels()` 是启发式,可能漏认(LLM 用了别名表外的词)或多认(一条 finding 同时提了两个通道 → 两张卡片都挂徽标)。漏认退化为「不挂徽标」,多认退化为「重复展示」,两者都不产生错误结论,可接受。
- 几何计算拆到 `src/components/tripChartGeom.ts`(纯函数,不 import react),`scripts/test-trip-chart.ts` 能在 node 里把 6 张卡片渲成一张 SVG 肉眼验收 —— 图表最容易错的是坐标与越界分段,这部分不该只能靠真机看。

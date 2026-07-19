# ADR-0014: 接入 AGENTS.md scaffold 协议,门禁定为 `npx tsc --noEmit`

- Date: 2026-07-19
- Status: accepted

## Context

本 repo 原本只有一行 Expo 版本提醒的 `AGENTS.md`,无协议、无 CI、无 ADR。项目要上 GitHub 并可能多 agent 轮班,需要接入 `agents-md-scaffold` 的协作协议(单一事实源 + issue 交接 + CI 硬门禁)。

ADR 0001–0013 随 scaffold 原样引入(保持编号与上游一致,便于回流同步);其中 0002 记录的门禁(`check-scaffold.js`)是 scaffold repo 自身的,不适用于本 repo——本 ADR 定义本 repo 的门禁。

## Decision

门禁 = `npx tsc --noEmit`,CI 跑同一命令。V0 阶段不引入测试框架:核心风险在 BLE 硬件交互,只能真机 + 真适配器验证,模拟出来的"测试绿"是假保证;类型检查是当前唯一诚实且可自动化的断言。原 `AGENTS.md` 的 Expo v57 versioned-docs 规则保留为 Hard rule 第一条。

## Consequences

- CI 绿 ≠ BLE 行为正确——这是明说接受的缺口,由 Hard rule(BLE 改动须真机验证或显式标注未验证)兜底
- `src/analysis/` 是纯函数区,可离线测试;引入 vitest 覆盖它属于"新增收紧断言"(ADR-0010 的 L2),欢迎后续任何一棒做
- scaffold 上游协议更新经回流 issue 进入本 repo,编号 0001–0013 不许本地改写(改了会断同步链);本项目自有决策从 0014 起编号

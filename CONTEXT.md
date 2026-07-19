# Domain context — OBD Health Logger

领域词汇表。所有 agent 对业务词的理解以此为准；代码命名与这里的术语保持一致。

## Terms

| 术语 | 定义 | 备注 |
|---|---|---|
| OBDLink CX | 车上插的 BLE OBD-II 适配器（STN 芯片） | GATT UUID undocumented，运行时发现 |
| ELM327 / STN | OBD 适配器的 AT 命令协议；STN 是 OBDLink 的兼容超集 | 初始化序列：`ATZ ATE0 ATL0 ATS0 ATH0 ATSP0` |
| ATZ probe | 复位命令,期望返回 STN/OBDLink 版本 banner | 验证串行通道真的通了 |
| GATT serial pair | 发现出的一对 characteristic：notify（收）+ write/write-no-response（发） | 即"串行通道" |
| notify-enable race | 先发命令后 notify 才生效导致丢响应的竞态 | 已修（见 git log `5f9f1de`），改动此处先读该 commit |
| Mode 01 PID | OBD-II 标准实时数据查询（`01xx`） | V0 轮询 6 个：RPM、车速、水温、油温、STFT、LTFT |
| `0100` bus probe | 查询支持的 PID 位图,返回 `41 00 ...` = 车辆总线活着 | V0 验收标准之一 |
| STFT / LTFT | 短期/长期燃油修正（%） | 引擎健康分析的主要输入 |
| chunked write | 把命令按 ≤ MTU payload 切块串行写 | Hard rule：CX 超 MTU 写会失败 |
| session export | 整个会话（GATT dump + 全部采样）导出的 JSON | GATT dump 钉死 CX 真实 UUID,是后续工作的依据 |
| dev client | `expo-dev-client` 自编译壳,BLE 必需 | Expo Go 无原生 BLE 模块 |

## Key invariants

- `AGENTS.md` 永远是唯一规则源；`CLAUDE.md` 永远只是 `@AGENTS.md` 空壳
- 不建 `HANDOFF.md`——交接走 issue comment（append-only、带时间戳）
- 门禁命令在 AGENTS.md 和 ci.yml 里必须字面一致（CI == Gate 契约）
- 一个任务一个 agent 做完，交接只在任务边界发生
- BLE 路径的正确性只能真机验证；CI 绿 ≠ BLE 行为对

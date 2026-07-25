# gearbox 升级实施计划

## 目标

把 Blackbox 从 gearbox v0.3.0 升到 v1.15.0(最新),补齐缺失 ADR,对齐双目录结构,完成 issue #14(push→pull 迁移)。

## 决策(stanyan 已拍板)

1. **跟随上游拆双目录**(ADR-0031):`docs/gearbox-adr/`(协议 ADR,编号与上游 1:1)+ `docs/adr/`(项目自有 ADR,从 0001 起独立编号)
2. **搬 14 个 ADR**:6 个必回流(0032/0034/0037/0044/0045/0046)+ 8 个边界(0030/0035/0036/0038/0039/0040/0041/0043)
3. **L1 改动 stanyan 已同意**:目录迁移 + AGENTS.md 索引 + #14 自查步

## 核心挑战:编号错位

Blackbox 现有 28 个协议 ADR 在 `docs/adr/`,但**编号与上游错位**(Blackbox 0015 = gearbox 0014 的 pr-template-references-downstream-list),因为 Blackbox 自有的 0014 插进了序列。

ADR-0031 的正解:协议 ADR 进 `docs/gearbox-adr/` 时用**上游原始编号**(1:1),项目自有 ADR 留在 `docs/adr/` 独立编号。

## 执行步骤

### Phase 1:目录迁移(手动 git mv)

把现有 28 个协议 ADR 从 `docs/adr/` 搬到 `docs/gearbox-adr/`,**重编号为上游编号**:

| Blackbox 旧(错位)| 搬到 gearbox-adr/ 用上游编号 | slug |
|---|---|---|
| 0001-adr-template | 0001 | adr-template |
| ... | ... | (0001-0013 编号恰好对齐) |
| 0014-adopt-scaffold-tsc-gate | **删/移到 docs/adr/** | adopt-scaffold-tsc-gate(项目自有) |
| 0015-pr-template-references-downstream-list | **0014** | pr-template-references-downstream-list |
| 0016-rename-to-gearbox | **0015** | rename-to-gearbox |
| 0017-gearbox-version-adoption | **0016** | gearbox-version-adoption |
| 0018-gearbox-update-adoption | **0017** | gearbox-update-adoption |
| 0019-hard-rule-designation-not-location | **0018** | hard-rule-designation-not-location |
| 0020-definition-exemption-for-context-glossary | **0019** | definition-exemption-for-context-glossary |
| 0021-test-gate-tier-mapping | **0020** | test-gate-tier-mapping |
| 0022-hash-stamp-drift-detection | **0021** | hash-stamp-drift-detection |
| 0023-gearbox-install-tool | **0022** | gearbox-install-tool |
| 0024-protocol-version-scheme | **0023** | protocol-version-scheme |
| 0025-refresh-drift-recopy | **0024** | refresh-drift-recopy |
| 0026-update-preflight-ergonomics | **0025** | update-preflight-ergonomics |
| 0027-background-ble-and-autoconnect | **留在 docs/adr/** | background-ble-and-autoconnect(项目自有) |
| 0028-local-persistence-and-notifications | **留在 docs/adr/** | local-persistence-and-notifications(项目自有) |
| 0029-live-activity-integration | **留在 docs/adr/** | live-activity-integration(项目自有) |

**结果**:
- `docs/gearbox-adr/` 有 25 个(0001-0025,与上游 1:1)
- `docs/adr/` 有 4 个项目自有:adopt-scaffold-tsc-gate(原 0014)/ background-ble-and-autoconnect(原 0027)/ local-persistence-and-notifications(原 0028)/ live-activity-integration(原 0029)
  - 重编号为 0001-0004(项目 ADR 从 0001 起独立编号,ADR-0031)

### Phase 2:跑 gearbox-update 补 14 个新 ADR

```bash
~/Github/gearbox/scripts/gearbox-update
```

脚本会:
- 扫描 `docs/gearbox-adr/` 现有 ADR(slug 匹配)
- 发现缺 0030-0049 中的 14 个(我们选定的)
- 拷贝到 `docs/gearbox-adr/` 用上游编号
- 更新 `.gearbox-version` 到 v1.15.0
- 自动 commit + push 到 `docs/gearbox-backfill-{date}` 分支
- 生成 `gearbox-update-report.md` 提示手改 AGENTS.md

**注意**:脚本会把**所有**缺失的 ADR 都拷过来(包括我们决定跳过的 9 个不适用)。拷完后我手动删那 9 个(0026/0027/0028/0029/0033/0042/0047/0048/0049),在 commit message 说明跳过理由。

### Phase 3:改 AGENTS.md(L1,stanyan 已同意)

1. **Where to find things 索引行**:
   - 把 `docs/adr/`(0001-0028 上游回流 + 0014 自有...)改成两条:
     - `docs/gearbox-adr/` — 协议 ADR(工具管理,与上游 1:1)
     - `docs/adr/` — 项目自有 ADR(0001-0004)
2. **ADR-XXXX 引用全文替换**(错位编号回正):
   - ADR-0015 → ADR-0014(pr-template...)
   - ADR-0016 → ADR-0015(rename-to-gearbox)
   - ... 依 Phase 1 的映射表
   - 项目自有 ADR 引用:ADR-0028(local-persistence)→ ADR-0002(新编号)
3. **加开工自查第 4 步**(issue #14):
   ```
   4. 跑 ~/Github/gearbox/scripts/gearbox-version 自查协议版本 — 落后就 gearbox-update 回流
   ```

### Phase 4:验证 + 开 PR

- `npx tsc --noEmit` 门禁(协议改动不碰代码,但要确认文档引用没断)
- 检查所有 `ADR-XXXX` 引用都指向正确文件
- 开 PR,L1 改动在 body 标注「stanyan 会话内同意」
- PR body 列:**搬了哪些 / 跳了哪些为什么 / AGENTS.md 改了哪些行**

## 文件改动总览

| 类型 | 操作 | 数量 |
|---|---|---|
| 协议 ADR | `docs/adr/` → `docs/gearbox-adr/` + 重编号 | 25 个 git mv |
| 项目自有 ADR | 留在 `docs/adr/` + 重编号 0001-0004 | 4 个重编号 |
| 新协议 ADR | gearbox-update 拷入 `docs/gearbox-adr/` | 14 个新增 |
| 跳过的 ADR | 拷入后手动删 | 9 个删除 |
| AGENTS.md | 索引行 + ADR 引用 + #14 自查步 | 1 文件多处改 |
| `.gearbox-version` | v0.3.0 → v1.15.0 | 脚本自动 |
| 其它引用 | `docs/subagent-system.md` 等 4 处路径 | 4 文件 |

## 协议合规

- **L1**:目录重命名 + AGENTS.md 索引改 + #14 自查步 = L1(Hard rules / Working agreement 机制引用)。**stanyan 已在本会话同意**
- **三件套**:开 Protocol gap/Task issue + 这个计划本身作决策记录(够详细,不一定单独开 ADR——升级是执行既定上游决策,不是新决策)+ 分支 PR
- **小步 commit**:① 目录迁移 ② gearbox-update backfill ③ 删 9 个不适用 ④ AGENTS.md 索引+引用 ⑤ #14 自查步
- **merge 后关 #14**

## 风险

1. **ADR-XXXX 引用改漏** — AGENTS.md 里有十几处 ADR 引用,改漏会导致指向不存在的编号。缓解:改完全文 grep 一遍 `ADR-00` 确认每个都对得上文件
2. **gearbox-update 脚本意外行为** — 脚本是上游的,可能假设下游已迁移完。缓解:先做 Phase 1 迁移,再跑脚本;跑完检查 report
3. **项目自有 ADR 重编号混淆** — adopt-scaffold-tsc-gate 从 0014 变 0001,语义上可能困惑。缓解:文件头加注释说明原编号 + 迁移日期
4. **工作量比看起来大** — 30+ 个 git mv + 十几处引用改 + 脚本跑。我派 Implementer subagent 干重活,我 review

## 不在本计划

- ❌ 改 gearbox 上游(那是另一个 repo)
- ❌ 重写 ADR 内容(只搬位置/改编号,内容不动)
- ❌ 真车 OBD 验证(独立任务)
- ❌ sub-project D(CarPlay,issue #21)

---

**请 review**。这是个大 PR(50+ 文件改动),但都是机械性工作 + 一处 L1 协议改动。批准后我派 Implementer 干,自己 review 引用改对没。
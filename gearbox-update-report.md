# gearbox-update 报告

- 时间: 2026-07-20
- 下游: Blackbox
- 分支: `docs/gearbox-backfill-2026-07-20`

## 已回流的 ADR

| gearbox | 下游新编号 | slug | 重编号原因 |
|---|---|---|---|
| ADR-0024 | ADR-0025 | refresh-drift-recopy | 撞号(下游 0024 = protocol-version-scheme) |
| ADR-0025 | ADR-0026 | update-preflight-ergonomics | 原号空,直接拷 |

## 全文替换的 ADR-XXXX 引用

| 原(gearbox) | 新(下游) |
|---|---|
| ADR-0024 | ADR-0025 |
| ADR-0025 | ADR-0026 |

## 已 commit + push

- 分支已推到远端: `origin/docs/gearbox-backfill-2026-07-20`
- 脚本**没有**开 PR(L1 改动需维护者同意)

### 下一步(手动)

```bash
gh pr create --base main --head docs/gearbox-backfill-2026-07-20 \
  --title "docs(adr): 回流 gearbox ADR 0024 + 0025" \
  --body "..."
```

- [ ] review diff(特别看 ADR-XXXX 替换是否正确)
- [ ] 按 AGENTS.md 章节(上面)手改 AGENTS.md(L1)
- [ ] 跑下游门禁
- [ ] 开 PR,等维护者在 PR comment 写'同意'才能 merge(L1 b-弱形态)

## 完事后清理

- [ ] PR merge 后删本报告文件 `gearbox-update-report.md`

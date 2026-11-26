# 分支历史治理 · 任务分解

> 依赖序：设置先行 → 一次性对齐 → 流程固化 → CI 护栏 → 验证。
> 标注 ⚠️ 的任务涉及生产分支指针移动 / 仓库设置变更——**spec 批准后执行，执行前后均留存证据**。

## 制度修正

- [x] 1. ⚠️ GitHub 仓库设置：允许 merge commit（保留 squash 选项）；main 分支关闭「线性历史」限制（dev 保持不变）
- [x] 2. `scripts/setup-branch-protection.sh` 按 main/dev 差异化重写（main：PR 必须 + 允许 merge；dev：PR 必须 + squash-only），注释引用本 spec

## 一次性对齐

- [x] 3. ⚠️ 留存证据：`git rev-parse origin/main`（对齐前 main SHA，写入本文件证据节，可秒级回滚）
- [x] 4. ⚠️ 对齐手术：`git checkout main && git reset --hard origin/dev`（内容零变化，`diff` 已实证为空）+ 越保护推送（owner 权限）；执行后 `merge-base(main, dev) == main HEAD` 验证
- [x] 5. 通知团队：main 指针已移动，本地 `git fetch && git reset --hard origin/main` 同步（AGENTS.md/WORKFLOW.md 已固化发布语义，后续成员首次 fetch 即见新基线）

## 流程固化

- [x] 6. WORKFLOW.md 发布节改写：dev → main 一律 merge commit（含 rationale 引用本 spec）；删除「快照缝合」相关表述；新增治理节（若护栏红灯的处置流程）
- [x] 7. AGENTS.md 协作规范节同步（分支模型表格补「dev → main merge commit，main 恒为 dev 祖先」）

## CI 护栏

- [x] 8. CI 新增 branch-align 校验（merge-base == dev HEAD），PR 与定期双触发；失败文案指向 WORKFLOW.md 治理节

## 验证（converge）

- [x] 9. 空跑验证：本治理提交合入 dev 后，随 dev → main 首次 **Merge Commit 发布**（无冲突、无需缝合）——即首次实战验证（PR #17 无冲突自动合并，mergeStateStatus CLEAN）
- [x] 10. 证据回填本文件：对齐前后 SHA、发布 PR 链接、护栏 job 日志（见下方证据表）

## 验收证据表

| 场景 | 入口 | 产物 | 状态 |
|---|---|---|---|
| 对齐前 main SHA（回滚锚点） | git rev-parse origin/main | `c068da4` | 已留存（可 `git push --force origin c068da4:main` 秒级回滚） |
| 仓库设置终态 | gh api repos/:repo | `allow_merge_commit=true` + squash 保留；main：linear 关、force push 禁、reviews（dismiss_stale）全保留 | PASS |
| 手术窗口 | 临时 reviews=null + force=true → 对齐 → 全恢复 | 窗口仅覆盖指针移动一步，保护已全量恢复 | PASS |
| 对齐后 main == dev 同 SHA | git log | `70c71e1` == `70c71e1`，`merge-base == main HEAD`，零分叉 | PASS |
| 首次 merge commit 发布 PR | gh pr | **PR #17**（dev → main，mergeStateStatus CLEAN 零冲突，2026-11-26 09:17 合并）：merge commit `ec438db`，两父 `70c71e1` + `c81717b`（dev HEAD） | PASS |
| branch-align CI job | CI | 新语义三场景实测全过：PR #18 五路绿（`pull_request:dev` 断言 main ⊆ dev）；发布 PR 期间按设计跳过；**push:main 终验绿**（run `45792137953`，`merge-base == dev HEAD c81717b`，日志输出「✓ dev 全历史已含于 main（发布拓扑健康）」） | PASS |

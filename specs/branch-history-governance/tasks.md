# 分支历史治理 · 任务分解

> 依赖序：设置先行 → 一次性对齐 → 流程固化 → CI 护栏 → 验证。
> 标注 ⚠️ 的任务涉及生产分支指针移动 / 仓库设置变更——**spec 批准后执行，执行前后均留存证据**。

## 制度修正

- [ ] 1. ⚠️ GitHub 仓库设置：允许 merge commit（保留 squash 选项）；main 分支关闭「线性历史」限制（dev 保持不变）
- [ ] 2. `scripts/setup-branch-protection.sh` 按 main/dev 差异化重写（main：PR 必须 + 允许 merge；dev：PR 必须 + squash-only），注释引用本 spec

## 一次性对齐

- [ ] 3. ⚠️ 留存证据：`git rev-parse origin/main`（对齐前 main SHA，写入本文件证据节，可秒级回滚）
- [ ] 4. ⚠️ 对齐手术：`git checkout main && git reset --hard origin/dev`（内容零变化，`diff` 已实证为空）+ 越保护推送（owner 权限）；执行后 `merge-base(main, dev) == main HEAD` 验证
- [ ] 5. 通知团队：main 指针已移动，本地 `git fetch && git reset --hard origin/main` 同步

## 流程固化

- [ ] 6. WORKFLOW.md 发布节改写：dev → main 一律 merge commit（含 rationale 引用本 spec）；删除「快照缝合」相关表述；新增治理节（若护栏红灯的处置流程）
- [ ] 7. AGENTS.md 协作规范节同步（分支模型表格补「dev → main merge commit，main 恒为 dev 祖先」）

## CI 护栏

- [ ] 8. CI 新增 branch-align 校验（merge-base == main HEAD），PR 与定期双触发；失败文案指向 WORKFLOW.md 治理节

## 验证（converge）

- [ ] 9. 空跑验证：dev 上造一个无害提交 → PR dev → main → **merge commit 合并**（无冲突、无需缝合）→ 校验护栏绿 → revert 该提交（或以本 spec 文档合入作为首次实战：spec 三件随 dev → main merge commit 发布，一次验证全链）
- [ ] 10. 证据回填本文件：对齐前后 SHA、发布 PR 链接、护栏 job 截图/日志

## 验收证据表

| 场景 | 入口 | 产物 | 状态 |
|---|---|---|---|
| 对齐前 main SHA（回滚锚点） | git rev-parse origin/main | 待执行回填 | 待执行 |
| 对齐后 main == dev 同 SHA | git log | 待执行回填 | 待执行 |
| 首次 merge commit 发布 PR | gh pr | 待执行回填 | 待执行 |
| branch-align CI job | CI | 待执行回填 | 待执行 |

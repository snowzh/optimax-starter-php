# 分支历史治理（branch-history-governance）· 需求

> 创建：2026-11-26 · 状态：specify（待批准执行）
> 依赖：WORKFLOW.md 分支模型；GitHub 仓库保护设置（scripts/setup-branch-protection.sh 产物）

## 1. 问题陈述

发布链路 dev → main 按 WORKFLOW.md 现行「仅 Squash 合并 + 线性历史」设置执行，**每次发布在 main 上产生一个全新 SHA**，main 与 dev 从此永久分叉。分叉积累后，下一次 dev → main 的 PR 三方合并不可行（PR #12 实证：add/add 冲突遍及后端全量文件），只能靠「快照缝合」式手工发布绕过（历史先例 #6、#10、#14，标题均自述「缝合」）。

当前取证（2026-11-26）：

- `git diff origin/main origin/dev` 为空（内容无差异）——**问题纯在历史图，不在内容**
- `merge-base(main, dev) = 31eb9ee`，main 侧已积累 5 个 dev 不含的缝合提交
- 根源：`scripts/setup-branch-protection.sh` 产出「仅 Squash + 线性历史」设置，与「发布需保留拓扑」天然冲突

## 2. 目标（验收标准）

1. **main 必须始终是 dev 的祖先**（`merge-base(origin/main, origin/dev) == origin/dev..` 关系成立），发布流动不产生分叉
2. dev → main 的发布 PR **可自动合并**，无需人工解冲突或缝合分支
3. 发布动作标准化：PR → CI 四路门禁 → 合并，**无任何手工 git 手术**（reset/force push/缝合）
4. 开发分支模型不变（feat 分支 squash 回 dev、合并即删）
5. **CI 护栏**：分叉状态可被机器发现（红灯），而非等下次发布撞上

## 3. 非目标

- 不改 feat → dev 的 Squash 策略（功能分支压平是合理且不变更的）
- 不追溯改写 #6/#10/#14 的历史（保留现状，一次性对齐后向前治理）
- 不引入 release 分支等新分支层级（拓扑保持 main ← dev ← feat 三层）

## 4. 风险与约束

- main 为生产分支：一次性对齐涉及指针移动（内容零变化，`diff` 为空）——需 owner 权限越过保护或临时放行
- GitHub 仓库设置变更（允许 merge commit、放开线性历史限制于 main）——仅 main 侧变更，dev 保持 squash-only 不动
- 团队认知变更：发布合并方式的肌肉记忆从 squash 改为 merge，需 WORKFLOW.md 同步改写并在 PR 模板中体现

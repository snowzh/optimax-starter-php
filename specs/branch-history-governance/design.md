# 分支历史治理 · 设计

> 契约唯一依据。方案取舍在此定稿，实现以本文为准。

## 1. 方案概述

**「一次性对齐 + 发布改用 merge commit + CI 护栏」**三件套：

| 件 | 内容 | 性质 |
|---|---|---|
| 一次性对齐 | `main` 指针移至当前 `dev` SHA（`git reset --hard origin/dev` + 越保护推送） | 一次性手术（内容零变化） |
| 发布合并方式 | dev → main PR 一律 **merge commit**；仓库设置放开「仅 Squash」与「线性历史」（仅 main 侧） | 制度修正 |
| CI 护栏 | 新增 job：校验 `merge-base(origin/main, origin/dev) == origin/main`（main 是 dev 祖先），分叉即红 | 持续防回归 |

## 2. 决策记录

**为什么不维持「squash + 缝合」？**
缝合是每次发布的隐性税：手工建快照分支、解全量冲突、PR 三连（#12→#13→#14 实证一轮发布三个 PR）。且分叉不可被机器发现——直到下次发布撞上才暴露。

**为什么 dev → main 用 merge commit 而非 rebase？**
rebase 重写 dev 历史（保护分支禁改写）；merge commit 保留 dev 完整拓扑，main 天然是 dev 祖先，下一次发布 PR 三方合并恒可行。生产分支含 merge commit 是 git-flow 标准形态，「线性历史」的美学不应以发布手术为代价。

**为什么对齐用 reset 而不是 merge？**
当前 main 侧 5 个缝合提交在 dev 侧均有语义等价物（同内容不同 SHA）——merge 会产生 5+ 个冲突面；`diff(main, dev)` 为空意味着 reset 是零内容变化的纯指针移动，手术面最小。

**一次性对齐后 main/dev 的图形态：**
```
main == dev（同 SHA） ─→ 后续发布：dev 前 n 提交 ─merge─→ main
                               └─ main 恒为 dev 祖先，永不分叉
```

## 3. 设置与流程变更清单

| 项 | 变更前 | 变更后 |
|---|---|---|
| 仓库 merge 方式设置 | 仅 Squash | **允许 merge commit**（squash 保留给 feat → dev 的人工选择） |
| main 线性历史限制 | 启用 | **关闭**（允许 merge commit 落 main） |
| dev 保护设置 | PR 必须 + squash-only | 不变 |
| WORKFLOW.md 发布节 | 「dev → main 发布走 PR（Squash Merge）」 | **「dev → main 一律 merge commit；发布后 main 已含 dev，无需任何缝合动作」** |
| setup-branch-protection.sh | 硬编码「仅 Squash + 线性历史」 | 按 main/dev 差异化配置（脚本注释说明原因） |

## 4. CI 护栏设计

在现有 CI 四路门禁外新增轻量 job `branch-align`（或并入 compose job 前置步骤）：

```bash
# main 必须是 dev 的祖先；分叉 = 红
test "$(git merge-base origin/main origin/dev)" = "$(git rev-parse origin/main)"
```

- 触发：PR（dev → main 时验证合并前状态）+ 定期（detect 分叉漂移）
- 失败语义：提示「main 与 dev 历史分叉，发布前需按 WORKFLOW.md 治理节对齐」

## 5. 影响面与安全自查

- 无业务代码变更；影响面 = git 拓扑 + 仓库设置 + 流程文档 + CI
- 一次性对齐的破坏性评估：`git diff origin/main origin/dev` 为空 → reset 纯指针移动，无内容丢失；操作前留存 `git rev-parse origin/main` 备份 SHA 于 spec tasks 证据节，可秒级回滚
- AGENTS.md 安全基线无涉（无凭据/无越权面）

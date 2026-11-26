# 开发工作流（Spec 驱动，工具无关）

> 所有需求经规格（spec）驱动实现：**specify → plan → tasks → implement ⇄ converge**。阶段模型对齐 GitHub Spec Kit（兼容其产物约定，但不依赖任何 CLI/插件）；任何编码工具（ZCode / Claude Code / Codex）或人类，仅凭本仓库文档即可执行全流程。

## 阶段总览

| 阶段 | 动作 | 产物 | 上游依赖 |
|---|---|---|---|
| **constitution** | 项目级一次：原则即 AGENTS.md + 各规范文档 | 已有 | — |
| **specify** | 收敛需求为可验收规格 | `specs/<slug>/requirements.md` | 用户/PM 输入 |
| **plan** | 规格转化为技术方案 | `specs/<slug>/design.md` | requirements |
| **tasks** | 任务分解（可并行度、依赖序） | `specs/<slug>/tasks.md` | design |
| **implement** | 按 tasks 逐项实现 | 代码 + 测试 | tasks + BACKEND/FRONTEND 红线 |
| **converge** | 验证实现符合规格，不收敛则回 implement | 验收记录（写入 tasks.md） | 各验收门禁 |

- `<slug>` = kebab-case 需求名；spec 产物随 git 提交（团队共享、可追溯）
- **每阶段产物须人工审查后再进入下一阶段**；agent 只产出草稿，不代替决策

## 评审角色与决策点

| 决策点 | 责任人 | 说明 |
|---|---|---|
| requirements 评审 | 需求提出方 + 技术负责人 | EARS 标准可验证、范围边界明确 |
| design 评审 | 技术负责人 | 契约、迁移、安全/部署影响逐项过 |
| 合并（Approve） | 任意非作者成员 | 作者不得自批；AI Review 意见须逐条处置 |
| dev → main 合并（发布决策） | 技术负责人 | 契约/迁移/部署影响复核后放行；触发 prod 发布 |
| 阶段推进 | 当前阶段操作者 | 产物人工审查后再进下一阶段，agent 只产草稿 |

## 文档路由（按阶段读取）

| 阶段涉及 | 必读 |
|---|---|
| 需求/验收标准 | 本文模板节 |
| 接口契约 | `API_CONVENTIONS.md` |
| 后端实现 | `BACKEND.md` + AGENTS.md 安全基线 |
| 前端实现 | `FRONTEND.md`（五状态/红线） |
| 部署/发布 | `DEPLOYMENT.md` |

## 分支模型（git-flow 简化版）

```
main   生产分支：生产环境只运行此分支；禁止直接提交，仅接受 dev → main 的 PR 合并
  ▲
dev    开发分支：功能开发基于此分支；禁止直接提交，仅接受开发分支 → dev 的 PR 合并
  ▲
feat/<slug> / fix/<slug> / chore/<slug>…
       开发分支：从 dev 切出，命名遵循 conventional-branch 技能规范；
       完成后 Squash Merge 回 dev 并删除——不作为长期分支保留
```

**合并方式（main/dev 差异化，spec branch-history-governance）**：

- 开发分支 → dev：**Squash Merge**（功能压平）+ 线性历史
- **dev → main：Merge Commit**（保留 dev 完整拓扑）——main 恒含 dev 全历史，发布 PR 恒可自动合并；
  squash-only 曾使每次发布产生全新 SHA 永久分叉，靠「快照缝合」手工绕过（#6/#10/#14），已治理废弃
- **护栏**：CI `branch-align` job 校验 `merge-base(main, dev) == dev HEAD`（dev 全历史已含于 main），分叉即红——红灯处置见 spec 治理节

### 维护规范（文档级约束，无条件生效）

以上分支规则**不以托管平台能力为前提**：即使分支保护未启用（如 GitHub 私有仓库免费版），规则依然完全有效，依靠以下三层执行：

1. **人**：评审角色表（上节）逐 PR 把关；发现直推 `main`/`dev` 的提交视为违规，revert 并要求走 PR
2. **AI agent**：本文件是 agent 的必读规范——收到「直接提交/推送 main 或 dev」的指令时**应拒绝执行**，并改走开发分支 → PR 流程
3. **AI Review**：PR 审查时核对本节规则（含「合并后删分支」「dev→main 仅发布时刻发起」）

### 分支保护的落地（模板采用时按形态二选一）

| 托管形态 | 落地方式 |
|---|---|
| GitHub 公有仓库（免费版支持保护规则） | 执行 `scripts/setup-branch-protection.sh <owner/repo>`：dev 保护（必须 PR、含管理员、线性历史、squash-only）+ main 保护（必须 PR、**允许 merge commit 非线性**）+ 合并后删分支 |
| GitHub 私有仓库（免费版无保护规则） | 跳过脚本，**文档级维护规范单独生效**（见上）；团队扩张时建议升级计划开启保护，或迁移至支持保护的托管形态 |

## 协作通用流程（implement → 合并，全栈适用）

1. **建分支**：从 `dev` 切出（命名遵循 `conventional-branch` 技能），尽早开 Draft PR（**目标 dev**）
2. **PR**：diff 精炼（约 ≤400 行）；CI 全绿 + 处理 AI Review 评论 + 人工 Approve
3. **合并到 dev**：Squash Merge → 删除开发分支（不长期保留）
4. **dev → main**：发布时刻由 dev 向 main 发 PR，**Merge Commit 合并**（保留拓扑，见分支模型节）；合并后触发 prod 发布（见 `DEPLOYMENT.md` 发布流程）——**发布后无需任何缝合/回吸收动作**
5. **收尾**：`git status` / `git diff --check` 干净；跟踪 CI 至绿；提交信息附验证结果

`FRONTEND.md` / `BACKEND.md` 的实现细节各自展开，本节为两者共同引用的协作真相源。

## 模板（复制到 specs/<slug>/ 后填写）

### requirements.md

```markdown
# <需求名>

## 背景与目标
（为什么做；完成后对谁产生什么价值）

## 用户故事
作为 <角色>，我希望 <能力>，以便 <价值>

## 验收标准（EARS 语法，每条可独立验证）
- 当 <触发条件>，系统 <响应>，[且 <约束>]
- 示例：当普通用户请求删除其他用户的订单时，系统返回 403，且记录审计日志

## 完成标准
（影响面：哪些模块/接口/页面受影响；测试方式；不做什么——明确范围边界）
```

### design.md

```markdown
# <需求名> · 技术方案

## 方案概述
（分层落点：Controller/Service/Repository、页面/路由/权限点）

## 接口契约
（方法、路径、请求/响应结构、错误码——遵循 API_CONVENTIONS.md）

## 数据模型
（迁移：新表/字段、索引、回滚策略）

## 安全影响
（权限点、审计点、敏感数据——对照 AGENTS.md 安全基线逐条自查）

## 部署影响
（新环境变量、镜像/compose 变化——对照 DEPLOYMENT.md）
```

### tasks.md

```markdown
# <需求名> · 任务分解

- [ ] 1. 迁移与模型（后端）
- [ ] 2. Service 层实现 + Pest 测试（后端）
- [ ] 3. 接口与错误码（后端，按 design.md 契约）
- [ ] 4. 路由/access 接线 + 页面五状态（前端）
- [ ] 5. generated-service 同步（前端）
- [ ] 6. E2E 关键流程 + 证据记录（见 FRONTEND.md 证据格式）
- [ ] 7. 联调验证 + converge 清单
```

## converge 验收清单

实现完成后逐项核对，**任一项不过即回到 implement**：

1. requirements.md 的每条 EARS 验收标准均有对应验证（后端 Pest / 前端五状态走查 / E2E 证据）
2. 接口响应与 design.md 契约一致（错误码、脱敏）
3. 后端安全基线自查通过（AGENTS.md）；CI 全绿
4. 前端五状态覆盖（FRONTEND.md）
5. spec 文档与实现无漂移（有偏差先改文档、评审后改代码）

**验收证据格式**（全栈通用，记录于 tasks.md）：

| 字段 | 说明 |
|---|---|
| 场景 | 关键流程名 |
| URL | 实操地址 |
| SHA | 验证时的代码版本 |
| 产物 | 截图 / 录屏 |
| 状态 | PASS / FAIL / BLOCKED / NOT_RUN（**只有 PASS 才能表述为已验收**） |

## 与生态的关系（非依赖）

- ZCode 会话可由 `feature-forge` 技能加速生成需求草稿，但其内置模板与本项目约定**有差异**（单文件 `specs/{name}.spec.md`、英文 EARS、以 HTTP 码表达业务错误的表格）——产物一律以本文模板与 `specs/<slug>/` 目录约定为准，其错误处理表**不得采用**（业务错误遵循 `API_CONVENTIONS.md` 的 code 分段）；无该技能时照模板手写
- 团队将来若采用 `specify-cli`（GitHub Spec Kit），本流程的阶段与产物路径已对齐，可无损接入

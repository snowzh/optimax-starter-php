# 后端开发流程（apps/api · Laravel）

> 与 `FRONTEND.md` 对称的后端执行规范；需求经 `WORKFLOW.md` 的 spec 流程进入实现。骨架落地前作为规范契约，落地后随实现校准。

## 技术栈事实卡（骨架落地时校准）

| 项 | 约定 |
|---|---|
| 框架 | Laravel（PHP ≥ 8.3） |
| 测试 | Pest（Service 层强制覆盖） |
| 代码风格 | Laravel Pint |
| 开发环境 | Laravel Sail（Boost guidelines 随包下发） |
| AI 基建 | Laravel Boost（MCP / `.ai/rules`，见 AGENTS.md 蓝图） |

## 开发流程（spec tasks → 合并）

1. **读 spec**：从 `specs/<slug>/tasks.md` 领任务；design.md 的接口契约是实现的唯一依据（改动先改契约）
2. **建分支**：`feat/<slug>` / `fix/<slug>`，尽早开 Draft PR
3. **迁移先行**：数据模型变更先写迁移（可回滚、含索引），评审后再写业务代码
4. **分层实现**：Controller（参数校验+响应组装）→ Service（业务+事务）→ Repository（数据访问）；跨服务写操作包在同一事务
5. **测试同步**：Service 层实现与 Pest 用例同批提交（实现前先写失败用例）
6. **联调**：接口可即时被前端调用（dev 代理）；契约变更同步类型、调用方、错误处理与 E2E（见 `API_CONVENTIONS.md`）
7. **自验**：Pint + Pest 全绿 + Boost MCP 自查（数据库 schema / 路由 / 配置与 design.md 一致）
8. **PR → 合并 → 收尾**：按 `WORKFLOW.md` 协作通用流程执行（AI Review + 人工 Approve + 提交信息附验证结果）

## 工程红线（后端特有，安全基线见 AGENTS.md）

- **分层职责**：Controller 不写业务、Service 不直接拼 SQL、Repository 不做业务判断
- **迁移规范**：每个迁移必须有对应回滚；禁止在生产数据上手工改表
- **约定沉淀**：实现中发现的重复约定，用 Boost `record-rule` 记入 `.ai/rules/`（勿手建规则文件）
- **知识查询**：写 Laravel 代码前用 Boost `search-docs`（版本感知）替代凭记忆写 API；查实际库表用 Boost MCP
- **禁止 mock**：联调直连真实 API；测试用 Pest + 数据库事务隔离，不引入 mock 服务

## 验收门禁（converge 后端侧）

1. requirements.md 每条 EARS 标准有 Pest 用例或集成验证对应
2. 响应结构/错误码与 `API_CONVENTIONS.md` 契约一致；敏感键已脱敏
3. AGENTS.md 安全基线逐条自查（权限服务端校验、审计入事务、防越权、最后超管保护）
4. 新约定已 record-rule 沉淀；design.md 与实现无漂移

## CI 后端门禁（骨架落地时配置）

Pint → Pest → 迁移可执行检查（`migrate:fresh` 于隔离库）→ compose 镜像构建检查（见 `DEPLOYMENT.md`）；固定门禁名汇总（与前端共用 CI 拓扑，轻重分流见 `FRONTEND.md`）。

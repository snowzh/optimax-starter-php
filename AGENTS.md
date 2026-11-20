# Optimax PHP Starter

后续复杂项目的基座框架仓库。目标形态为 monorepo：`apps/api`（Laravel API）+ `apps/web`（Ant Design Pro 前端）。

> 状态：骨架待建。本文件是脚手架实施前先行确立的规范契约，代码落地时必须遵循；落地步骤见「骨架落地清单」，完成后必须回填「环境与命令」一节。

## 语言与沟通

- 与用户交流使用中文；代码注释以中文为主（专有名词与标识符保留英文）。

## 目标架构

```
apps/
├── api/    # Laravel 后端 API（Controller → Service → Repository 分层）
└── web/    # Ant Design Pro 前端（UmiJS 4 + ProComponents）
```

## 环境与命令（骨架落地后必须回填）

工具链契约：PHP ≥ 8.3 / Composer 2 / Node ≥ 20 LTS / pnpm / gh CLI（ssh 认证）。

| 命令 | 说明 | 状态 |
|---|---|---|
| apps/api 安装/测试/lint | composer / pest | 待回填 |
| apps/web 安装/启动/构建 | pnpm / umi max | 待回填 |
| antd CLI | `npx -y @ant-design/cli info <组件>`（文档/props/token/demo 查询） | 可用 |
| gh CLI | `gh pr/issue/run` 等 GitHub 操作（需 `gh auth` 已认证） | 可用 |
| Laravel Boost 安装 | apps/api 内 `composer require laravel/boost --dev` + `php artisan boost:install` | 待骨架落地 |

## 骨架落地清单（Blueprint）

1. `apps/api`：创建 Laravel 项目 + 安装 Boost（见上表），`boost:install` 选择 agents；其生成的 `.mcp.json`/guidelines 文件按官方建议 gitignore，`.ai/rules/` 必须提交
2. 根 `.agents/mcp.json` 追加 `laravel-boost`：`{"command": "php", "args": ["apps/api/artisan", "boost:mcp"]}`
3. `apps/api/composer.json` 增加 `post-update-cmd`: `@php artisan boost:update --ansi`（Boost 资源随依赖自动更新）
4. `apps/web` 落地后：根 `.agents/mcp.json` 的 `antd` server 追加 `--version` 参数，锁定为 `apps/web` 实际 antd 版本（args 形如 `["-y", "@ant-design/cli", "mcp", "--version", "<antd版本>"]`）
5. 按 `DEPLOYMENT.md` 创建 compose 拓扑与 `apps/api`/`apps/web` 多阶段 Dockerfile，CI 增加镜像构建门禁
6. 回填「环境与命令」表与 `FRONTEND.md`/`BACKEND.md` 技术栈事实卡，并调用 `claude-md-improver` 技能复审本文件

## 后端约定（apps/api · Laravel）

- **分层**：Controller 只做参数校验与响应组装；业务逻辑在 Service；数据访问在 Repository；跨服务写操作必须包在数据库事务内。
- **安全基线**（改动 auth/权限/账户/审计相关代码后主动自查；若环境中装有 laravel-security-reviewer agent 则调用其复审）：
  - 权限必须在服务端校验，前端隐藏入口不作为安全手段
  - 审计日志写入与业务变更同一事务
  - 响应中脱敏敏感键（password、token、secret 等），禁止泄漏到日志与前端
  - 防越权：对象级权限校验（id 归属检查），防止普通用户提权
  - 最后一个超级管理员禁止删除/降级
  - 会话与密钥规则遵循框架默认安全配置，密钥只从 env 读取
- **API 响应**：遵循 `API_CONVENTIONS.md`（统一结构、错误码分段、变更四同步）。
- **Laravel Boost（AI 基建）**：后端 AI 辅助统一走 Boost（MCP 内省 / `search-docs` / `record-rule` 沉淀约定至 `apps/api/.ai/rules/`）；使用规范见 `BACKEND.md`；`<laravel-boost-guidelines>` 块由 Boost 维护、勿手改
- **开发流程**：spec 任务实现遵循根目录 `BACKEND.md`（迁移先行、Service 与 Pest 同批提交、Boost 自查）

## 前端约定（apps/web · Ant Design Pro）

- **ProComponents 优先**：列表用 ProTable、表单用 ProForm/ModalForm，不手写重复 CRUD 代码
- **路由与权限**：新增页面同步维护 route 配置与 access 权限点
- **请求**：一律走统一 request 封装，不直接裸调 fetch/axios
- **generated-service 边界**：自动生成的 service 代码不手改，以重新生成方式覆盖
- **Lint**：Biome + antd 规则必须通过（若环境中装有 antd-pro-reviewer agent 则调用其复审）
- **Ant Design 资源**：写 antd 组件前先用 `antd` skill / MCP 查询 props、token、demo 与跨版本 API；视觉与设计语言以根目录 `design.md` 为基线
- **开发流程**：需求→分支→实现→联调→验收→PR→合并全流程遵循根目录 `FRONTEND.md`（五状态验收、E2E 证据、禁 mock、Squash Merge 等红线）

## 协作规范

- 需求开发：所有需求经 `WORKFLOW.md` 的 spec 流程（specify → plan → tasks → implement ⇄ converge），产物随 git 提交至 `specs/<slug>/`
- 提交信息：Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`），提交与分支命名遵循 `git-commit` / `conventional-branch` 技能
- 测试：核心业务逻辑（Service 层）必须有对应 PHPUnit/Pest 测试；前端改动至少保证 lint 与构建通过
- 分支模型：`main`（生产，仅接受 dev 的 PR）← `dev`（开发，仅接受开发分支的 PR）← `feat/xxx` 等开发分支（按 `conventional-branch` 技能命名，合并后即删）；**无论平台是否启用保护，直推 `main`/`dev` 一律禁止**——详见 `WORKFLOW.md` 分支模型与维护规范节

## AI 协作层结构

| 路径 | 说明 |
|---|---|
| `AGENTS.md` | 指令文件唯一内容源（ZCode 原生读取） |
| `CLAUDE.md` | 符号链接 → AGENTS.md（Claude Code 兼容） |
| `design.md` | 设计语言基线（vendor 自 antd，前端 UI 工作参考，可按项目定制） |
| `FRONTEND.md` | 前端开发流程规范（衍生自团队基座：五状态验收/E2E 证据/协作红线） |
| `WORKFLOW.md` | Spec 驱动开发主线（specify→plan→tasks→implement⇄converge，工具无关） |
| `BACKEND.md` | 后端开发流程（与 FRONTEND.md 对称） |
| `API_CONVENTIONS.md` | 接口契约与联调流程（响应结构/错误码分段/变更四同步） |
| `DEPLOYMENT.md` | Docker 前后端分离部署流程（compose 拓扑/多阶段构建/发布回滚） |
| `.agents/skills/` | 项目级 skills 唯一投放位置（ZCode 及 agents 系工具直接扫描） |
| `.claude/skills` | 符号链接 → `../.agents/skills`（Claude Code 兼容） |
| `.agents/mcp.json` | MCP server 唯一配置源：`antd` 已配置；`laravel-boost` 待骨架落地追加（见「骨架落地清单」） |
| `.mcp.json` | 符号链接 → `.agents/mcp.json`（Claude Code 兼容） |
| `apps/api/.ai/rules/` | Boost 项目规则：按路径作用域的团队约定（骨架落地启用，随 git 提交） |

新增技能：放入 `.agents/skills/<skill-name>/SKILL.md` 即可，无需改动链接结构，详见 `.agents/skills/README.md`。

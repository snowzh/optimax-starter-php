# 部署流程（Docker · 前后端分离）

> 本项目以 Docker 为基本部署方式：前后端各自独立镜像、独立容器，统一入口反代分流。骨架落地前作为规范契约，落地时按「骨架落地清单」逐项回填实际命令与配置。

## 部署拓扑

| 环境 | 方式 | 说明 |
|---|---|---|
| dev | api：Laravel Sail；web：`pnpm dev`（Vite 代理转发 `/console` 同源到 api） | 开发即容器化（Sail 官方 Docker），与 `FRONTEND.md` 联调约定一致 |
| staging | 与 prod 同构（`compose.staging.yaml`，缩配资源） | 发布必经验证场：E2E 抽查与契约比对在此执行，全绿才进 prod |
| prod | Docker Compose：**单一入口 nginx** 按路径分流 → `web`（静态镜像）/ `api`（php-fpm 镜像）；`db`（MySQL）；按需 `redis` | 前后端分离：镜像独立构建、独立发布、可独立回滚 |

```
nginx (entry, :80/:443)
├── /api/*  → api-nginx → php-fpm (apps/api 镜像)
└── /*      → web (apps/web 静态产物镜像)
```

- compose 文件分环境：`compose.yaml`（dev 基础）+ `compose.prod.yaml`（生产覆盖）；镜像 tag 以 **git SHA** 为准（可追溯、可回滚）
- **部署源分支**：staging 跟随 `dev` 分支构建验证；prod 只从 `main` 发布（`dev → main` PR 合并触发，见 `WORKFLOW.md` 分支模型）

## 镜像构建约定（多阶段，前后端各自一个 Dockerfile）

| 镜像 | 构建阶段 | 产物阶段 |
|---|---|---|
| `apps/api` | composer install（含 dev 依赖用于构建期检查） | php-fpm 运行时（仅 prod 依赖 + 代码 + entrypoint） |
| `apps/web` | node/pnpm install + `pnpm build` | nginx + 纯静态产物 |

- 使用 `multi-stage-dockerfile` 技能生成与优化；每个 Dockerfile 配套 `.dockerignore`
- 基础镜像用官方源（`php` 官方镜像 fpm 变体、`nginx`/`node` 官方镜像），锁定具体版本号，禁用 `latest`
- 构建产物镜像内**禁止**包含 `.env`、`vendor` 冗余、`node_modules`

## 配置与密钥

- 环境变量经 compose `env_file` 按环境注入；仓库只提交 `.env.example`
- **secrets 红线**：任何密钥不入库不入镜像；CI 用 GitHub Secrets；泄露即刻轮换（配合 secret scanning 可选项，见 PM 缺口清单 P1-7）

## 发布流程（每次发版执行，配合 `devops-rollout-plan` 技能）

```
1. preflight：CI 全绿（FRONTEND/BACKEND/DEPLOYMENT 各门禁）
2. 构建镜像：CI 中 docker build（多阶段）→ 推送 registry，tag = git SHA
3. 部署：staging 先行（pull 指定 SHA → compose up -d → 验证信号全绿）→ prod 滚动替换受影响容器
4. 验证信号：/api 健康检查（Laravel /up）、web 首页 200、关键页 E2E 抽查（staging 全量验证；prod 只读抽查）
5. 回滚：compose 切回上一 SHA tag → up -d（≤5 分钟内可完成，发布前先确认上一 tag 可用）
```

- 生产机只读健康检查后收尾（对齐 `FRONTEND.md` 收尾步骤）
- 禁止人工直连生产容器改文件；一切变更走 CI 构建的新镜像

## CI 集成（骨架落地时配置）

- 镜像构建/推送用 Docker 官方 `docker/build-push-action`；工作流安全按 `github-actions-hardening` 技能审查（SHA pin、最小权限 token、`pull_request_target` 红线）
- CI 失败的修复流程走 `gh-fix-ci` 技能（读 checks → 修复计划 → 批准后实施）
- compose 拓扑变更：先在 dev 环境验证，`design.md` 部署影响节评审后进 prod

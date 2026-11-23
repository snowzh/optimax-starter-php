# 部署流程（Docker · 前后端分离）

> 本项目以 Docker 为基本部署方式：前后端各自独立镜像、独立容器，统一入口反代分流。已随 starter-scaffold 落地校准（2026-11）：数据库为 **PostgreSQL 18.7**（用户决策，原文 MySQL 已废弃）。

## 部署拓扑（已落地校准）

| 环境 | 方式 | 说明 |
|---|---|---|
| dev（API 开发） | 原生 PHP 8.4 + 本地 PG 5432，或 Laravel Sail（`apps/api/compose.yaml`，php 8.4 + pgsql 18.7） | API 侧开发环境 |
| dev（全栈预览 / E2E） | 根 `compose.yaml`：入口 nginx `:8080` 分流 → web/api/db；`docker compose --profile e2e run --rm e2e` 跑 Playwright（网络内直连入口，规避宿主端口代理抖动） | 一键全栈冒烟与 E2E 取证 |
| staging | 与 prod 同构（`compose.prod.yaml` 缩配资源） | 发布必经验证场：E2E 抽查与契约比对在此执行，全绿才进 prod |
| prod | `docker compose -f compose.yaml -f compose.prod.yaml up -d`：入口 nginx `:80` 分流 → `web`（静态镜像）/ `api`（php-fpm+nginx 单容器镜像）；`db` = **PostgreSQL 18.7**；按需 `redis` | 前后端分离：镜像独立构建、独立发布、可独立回滚 |

```
nginx (entry, dev :8080 / prod :80, TLS 由部署方接入)
├── /api/*、/up → api:8080（容器内 nginx → php-fpm）
└── /*          → web:80（nginx + 纯静态产物，SPA 回退）
db: postgres:18.7-alpine（healthcheck=pg_isready，数据卷挂 /var/lib/postgresql——PG18 官方建议挂载点）
e2e（--profile e2e）：mcr.microsoft.com/playwright 镜像，网络内直连 http://nginx
```

- compose 文件分环境：`compose.yaml`（dev 基础，含 e2e profile）+ `compose.prod.yaml`（生产覆盖，镜像 tag 以 **git SHA** 注入 `IMAGE_TAG`，种子密码强制覆盖、关闭自动播种）
- **部署源分支**：staging 跟随 `dev` 分支构建验证；prod 只从 `main` 发布（`dev → main` PR 合并触发，见 `WORKFLOW.md` 分支模型）
- 容器启动开关（`apps/api/docker/entrypoint.sh`）：`MIGRATE_ON_START` / `SEED_ON_START`——**生产首启须手动执行一次 `docker compose exec api php artisan db:seed --force`**（幂等，种子含超管账号）；日常重启不开播种，避免重置线上角色矩阵

## 镜像构建约定（已落地：多阶段，前后端各自一个 Dockerfile）

| 镜像 | 构建阶段 | 产物阶段 |
|---|---|---|
| `apps/api` | `composer:2.8` install（prod 依赖） | `php:8.4-fpm-alpine` + nginx + supervisord（pdo_pgsql/opcache；entrypoint 处理权限与迁移） |
| `apps/web` | `node:22-alpine` + pnpm install + `pnpm build` | `nginx:1.28-alpine` + 纯静态产物（SPA 回退 + hash 产物永久缓存） |

- 每个 Dockerfile 配套 `.dockerignore`；基础镜像锁版本禁用 `latest`
- 构建产物镜像内**禁止**包含 `.env`、`node_modules`；api 镜像仅含 prod vendor
- `pnpm 12` 构建脚本白名单：`apps/web/pnpm-workspace.yaml` 的 `allowBuilds`（遥测类依赖刻意禁跑）

## 配置与密钥

- 环境变量经 compose `environment` 注入；compose 层必填项用 `${VAR:?}` 硬校验（缺配即拒绝起栈）；仓库只提交 `.env.example`（根目录，compose 变量清单）
- **secrets 红线**：任何密钥不入库不入镜像；CI 用 GitHub Secrets；泄露即刻轮换
- 种子默认密码仅限开发默认值（`admin123`/`demo123456`），prod 覆盖项在 `compose.prod.yaml` 以 `${VAR:?}` 强制

## 发布流程（每次发版执行，配合 `devops-rollout-plan` 技能）

```
1. preflight：CI 全绿（api/web/compose/e2e 四路门禁）
2. 构建镜像：CI 中 docker build（多阶段）→ 推送 registry，tag = git SHA
   （注：starter-scaffold 的 CI 门禁已落地并含镜像构建检查；推 registry 与 staging/prod
   发布编排为独立后续需求，走 spec 流程补齐）
3. 部署：staging 先行（pull 指定 SHA → compose up -d → 验证信号全绿）→ prod 滚动替换受影响容器
4. 验证信号：/api 健康检查（Laravel /up，入口路径 /up）、web 首页 200、登录信封 code=0、
   关键页 E2E 抽查（staging 全量验证；prod 只读抽查）
5. 回滚：compose 切回上一 SHA tag → up -d（≤5 分钟内可完成，发布前先确认上一 tag 可用）
```

- 生产机只读健康检查后收尾（对齐 `FRONTEND.md` 收尾步骤）
- 禁止人工直连生产容器改文件；一切变更走 CI 构建的新镜像

## CI 集成（已落地：`.github/workflows/ci.yml`）

- 四路门禁：api（Pint→Pest[pgsql service]→migrate:fresh→镜像构建）、web（Biome→tsc→vitest[浏览器]→build→镜像构建）、compose config 校验（dev+prod）、e2e（compose 全栈起栈→部署信号→Playwright→证据 artifact）
- 第三方 action 一律 **SHA pin**；`permissions: contents: read` 最小权限；PR 并发自动取消；无 `pull_request_target`
- CI 失败的修复流程走 `gh-fix-ci` 技能（读 checks → 修复计划 → 批准后实施）
- compose 拓扑变更：先在 dev 环境验证，`design.md` 部署影响节评审后进 prod

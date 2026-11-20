# 基座骨架：认证与权限管理

## 背景与目标

本仓库为后续复杂项目的基座框架，目前仅有规范文档、无任何代码。本次一次性落地最小可用的基座骨架：**apps/api（Laravel）** 与 **apps/web（Ant Design Pro）** 双应用 monorepo、用户名+密码登录、基于角色的权限管理（RBAC）、可部署的 Docker Compose 栈与 CI 门禁，为后续业务开发提供统一的分层范式、接口契约与部署基线。

完成后对两类角色产生价值：开发者获得可复制的工程骨架（分层架构/统一响应/权限矩阵/五状态页面范本）；运维获得一条 `compose up` 即起、以 git SHA 为镜像 tag 的可回滚部署链路。

明确不纳入本次范围：任何内部业务实体管理（后续需求各自走 spec 流程补齐）。

## 用户故事

- 作为**访客**，我希望用用户名和密码登录，以便获得访问系统的凭证（不使用邮箱）。
- 作为**超级管理员**，我希望创建/编辑用户、为其分配多个角色，以便按职责授权。
- 作为**超级管理员**，我希望在权限矩阵中勾选角色与权限的对应关系，以便角色权限可配置、可审计。
- 作为**超级管理员**，我希望为单个用户额外直授或调整权限（在角色之外），以便处理例外场景。
- 作为**已登录用户**，我希望看到与自身权限一致的菜单与页面，且无权限时得到明确提示，以便不迷路。
- 作为**运维**，我希望 `docker compose up` 即得到前后端+数据库全栈，以便低成本部署与回滚。

## 验收标准（EARS 语法，每条可独立验证）

### 认证

- 当访客提交正确用户名与密码时，系统返回 `{code:0}` 且 `data` 含可用 token 与用户信息（含角色、有效权限清单），且记录登录成功审计日志。
- 当访客提交错误用户名或密码时，系统返回业务码 4001「用户名或密码错误」，且不泄漏用户是否存在。
- 当已禁用用户尝试登录时，系统返回业务码 4002「用户已禁用」。
- 当请求携带有效 token 时，系统返回当前用户信息（`GET /auth/me`）；当 token 缺失或已注销时，系统返回 HTTP 401 与业务码 2001。
- 当用户注销时，系统删除其当前 token，且该 token 此后不可用。

### 权限（RBAC）

- 当超管在权限矩阵中为某角色勾选权限后，该角色下的用户再次拉取 `GET /auth/me` 时，系统返回更新后的权限清单。
- 当用户同时持有多个角色时，系统返回其所有角色权限的并集。
- 当超管为某用户直授角色之外的权限时，系统返回该用户「角色权限 ∪ 直授权限」的聚合结果。
- 当无 `system.user.view` 权限的用户请求 `GET /api/v1/users` 时，系统返回 HTTP 403 与业务码 2003，且记录审计日志（前端同步隐藏/置灰入口——隐藏入口不作为安全手段）。
- 当操作将导致超级管理员角色无人持有时（删除/禁用/移除该角色的最后一个持有用户），系统返回业务码 4004 并拒绝。
- 当请求删除当前登录账号自身时，系统返回业务码 4005 并拒绝。
- 当请求删除受保护角色（super-admin）时，系统返回业务码 4006 并拒绝。

### 前端（Ant Design Pro 官方风格）

- 当访客未登录访问任何受保护页面时，系统重定向到官方 UserLayout 登录页（仅账号密码 tab）。
- 当用户登录成功时，系统展示 BasicLayout 与其权限范围内的菜单，且欢迎页可见。
- 当用户访问无权限路由时，系统自动跳转至其首个可访问页（或 403 提示）。
- 当每个管理页面加载时，系统覆盖五状态：loading / empty / error / disabled（按权限置灰操作）/ permission denied。
- 当后端返回非 0 业务码时，系统统一弹出可读中文提示（不泄漏内部细节）。

### 部署与 CI

- 当执行 `docker compose -f compose.yaml -f compose.prod.yaml up -d` 时，系统在单入口 nginx 下提供 web 静态页与 `/api/*` 后端服务，且 PostgreSQL 18.7 数据卷持久化。
- 当 PR 提交到 dev 时，系统运行后端（Pint→Pest→迁移→镜像构建）与前端（lint→类型→构建→镜像构建）门禁及 compose 校验，全绿才可合并。
- 当 `migrate:fresh --seed` 执行时，系统可完整重建（含回滚验证），种子数据含超管与只读演示账号。

## 完成标准

**影响面**：新增 `apps/api`（Laravel 12 + Sanctum + spatie/laravel-permission + Boost + Pest/Pint + Scramble）、`apps/web`（UmiJS 4 max + antd 5 + ProComponents + Biome + Playwright）、`compose.yaml`/`compose.prod.yaml`/入口 nginx 配置、`.github/workflows/ci.yml`、根 `.agents/mcp.json`（laravel-boost + antd 版本锁）；修订 `DEPLOYMENT.md`（MySQL→PostgreSQL 18.7）、`API_CONVENTIONS.md`（错误码登记表）、`AGENTS.md`（环境与命令回填）、`BACKEND.md`/`FRONTEND.md`（技术栈事实卡）。

**测试方式**：后端 Pest（Service 层全覆盖、RefreshDatabase + pgsql 事务隔离）；前端 lint + 类型检查 + 构建 + Playwright E2E（真实浏览器、禁 mock）；部署以 compose 全栈冒烟 + CI 全绿收口；converge 证据表记入 tasks.md。

**不做什么**：不实现邮箱登录/找回密码/验证码；不实现内部业务实体管理；不做租户/组织层级；不做多语言；不做 SSO/OAuth；不做 remember-me 持久会话（仅 token 有效期管理）；不做生产 TLS 终结（入口 nginx 预留 443 配置位，证书由部署方提供）。

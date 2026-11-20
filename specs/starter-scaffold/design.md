# 基座骨架：认证与权限管理 · 技术方案

## 方案概述

**技术选型（已确认）**：认证用 Laravel Sanctum **Bearer Token**（无状态，compose 部署无会话黏滞）；RBAC 用 **spatie/laravel-permission**（guard `sanctum`，天然支持多角色、单用户直授权限、角色权限矩阵）；数据库 **PostgreSQL 18.7**（当前最新稳定；`DEPLOYMENT.md` 原文的 MySQL 按本决策修订——文档先行）；OpenAPI 由 **dedoc/scramble** 从代码自动产出，前端 `pnpm openapi` 生成 `generated-service`（不手改）。

**分层落点（apps/api，遵循 BACKEND.md）**：

```
routes/api.php（v1 前缀 + auth:sanctum + permission:xxx 中间件）
└── Controller（参数校验[FormRequest] + 响应组装）
    └── Service（业务/事务/审计）      AuthService / UserService / RoleService / PermissionService
        └── Repository（查询封装）      UserRepository / RoleRepository / PermissionRepository / AuditLogRepository
            └── Model+Eloquent        User / Role / Permission / AuditLog（spatie 关系写入走模型能力）
```

**页面落点（apps/web，遵循 FRONTEND.md）**：官方 UserLayout 登录页（仅账号密码 tab）+ BasicLayout 管理壳；路由 `/user/login`、`/`（欢迎页）、`/system/user`、`/system/role`、`/system/permission`；access 权限点与后端权限码一一对应（`system.user.view` 等 6 码）；request 统一封装处理 `{code,message,data}` 信封。

**统一响应**：全局 `Support/ApiResponse`（`success(data)` / `fail(code,message,http)`）+ 异常渲染器（`bootstrap/app.php`），所有 `/api/v1/*` 响应为信封结构；`/up` 健康检查除外（部署探针，非业务信封）。

## 接口契约

所有响应：`{ "code": 0, "message": "ok", "data": {} }`；`code !== 0` 即业务失败，前端统一提示 `message` 并按码分流。HTTP 状态码仅表达传输层语义。

**错误码登记（实现前已登记，全量见 `API_CONVENTIONS.md` 登记表）**：

| code | HTTP | 语义 |
|---|---|---|
| 0 | 200 | 成功 |
| 1001 | 422 | 参数校验失败（`data.errors` 字段级错误） |
| 2001 | 401 | 未认证（token 缺失/失效/已注销） |
| 2003 | 403 | 已认证但无所需权限 |
| 3001 | 404 | 资源不存在（含不存在的角色/权限 id 或权限码） |
| 3002 | 409 | 唯一性冲突（用户名/角色 slug 已存在） |
| 4001 | 200 | 用户名或密码错误 |
| 4002 | 200 | 用户已禁用 |
| 4003 | 200 | 旧密码错误（改密场景） |
| 4004 | 200 | 最后一个超级管理员禁止删除/禁用/降级 |
| 4005 | 200 | 禁止删除当前登录账号 |
| 4006 | 200 | 受保护角色禁止删除/禁用/改权限矩阵 |
| 5000 | 500 | 服务端内部错误（信息脱敏，仅记日志） |

> 约定：`4xxx` 业务规则拒绝属「预期内业务结果」，传输层用 HTTP 200，成败看 `code`；`2xxx` 认证/权限、`1001` 校验、`3xxx` 资源态按上表映射对应 HTTP 码。

**公共类型**：

```
Role    = { id: number, name: string, slug: string }
User    = { id, username, name, status: 0|1, roles: Role[], direct_permissions: string[],
            last_login_at: string|null, created_at: string }            // 管理页条目
Me      = { id, username, name, status, roles: string[]/*slug*/, permissions: string[]/*有效权限并集*/ }
RoleItem= { id, name, slug, remark, is_protected: boolean, permissions: string[], users_count, created_at }
```

### 认证 `/api/v1/auth`

| 方法/路径 | 权限 | 请求 | 成功 data | 失败码 |
|---|---|---|---|---|
| POST /login | 公开 | `{username, password}` | `{token: string, user: Me}` | 1001 / 4001 / 4002 |
| POST /logout | 登录 | — | `{}` | 2001 |
| GET /me | 登录 | — | `{user: Me}` | 2001 |
| PUT /password | 登录 | `{old_password, password, password_confirmation}` | `{}` | 1001 / 4003 |

### 用户 `/api/v1/users`（view→`system.user.view`，写操作→`system.user.manage`）

| 方法/路径 | 请求 | 成功 data | 失败码 |
|---|---|---|---|
| GET /（列表） | query: `page, page_size, keyword, status` | `{items: User[], total, page, page_size}` | 2003 |
| POST / | `{username, name, password, password_confirmation, status, role_ids: number[]}` | `User` | 1001 / 3001 / 3002 / 4004※ |
| GET /{id} | — | `User` | 3001 |
| PUT /{id} | `{name, status, password?（重置）, password_confirmation?, role_ids}` | `User` | 1001 / 3001 / 4004 |
| DELETE /{id} | — | `{}` | 3001 / 4004 / 4005 |
| GET /{id}/roles | — | `{role_ids: number[]}` | 3001 |
| PUT /{id}/roles | `{role_ids}` | `{role_ids}` | 1001 / 3001 / 4004 |
| GET /{id}/permissions | — | `{permissions: string[]}`（直授权限） | 3001 |
| PUT /{id}/permissions | `{permissions: string[]}` | `{permissions}` | 1001 / 3001 |

※ POST 禁止直接指派 `super-admin` 角色（保护角色仅经种子/运维通道）；请求含受保护角色 id 返回 4006。

### 角色 `/api/v1/roles`（view→`system.role.view`，写→`system.role.manage`）

| 方法/路径 | 请求 | 成功 data | 失败码 |
|---|---|---|---|
| GET /（列表） | query: `page, page_size, keyword` | `{items: RoleItem[], total, page, page_size}` | 2003 |
| POST / | `{name, slug, remark?, permissions: string[]}` | `RoleItem` | 1001 / 3001 / 3002 |
| GET /{id} | — | `RoleItem` | 3001 |
| PUT /{id} | `{name, remark?, permissions?}`（slug 创建后不可改） | `RoleItem` | 1001 / 3001 / 4006※ |
| DELETE /{id} | — | `{}` | 3001 / 4006 |
| GET /{id}/permissions | — | `{permissions: string[]}` | 3001 |
| PUT /{id}/permissions | `{permissions: string[]}` | `{permissions}` | 1001 / 3001 / 4006※ |

※ super-admin 为受保护角色，PUT 其矩阵或删除均 4006。

### 权限清单 `/api/v1/permissions`（`system.permission.view`，只读）

GET / → `data: [{module: string, module_name: string, permissions: [{id, name, slug}]}]`（按模块分组，供矩阵与直授组件共用）。失败码 2003。

### 健康检查

`GET /up`（Laravel 内建）→ 200 纯文本，部署验证信号用，不走信封。

**权限码注册表（种子数据，6 码）**：`system.user.view` 查看用户、`system.user.manage` 管理用户、`system.role.view` 查看角色、`system.role.manage` 管理角色、`system.permission.view` 查看权限清单——模块：用户管理 / 角色管理 / 权限清单。**角色种子**：`super-admin` 超级管理员（is_protected，Gate::before 全通过）、`system-admin` 系统管理员（全部 6 码）、`viewer` 只读访客（全部 *.view）。**用户种子**：`admin`（super-admin，初始密码 `ADMIN_INITIAL_PASSWORD`）、`demo`（viewer，`DEMO_INITIAL_PASSWORD`）、`alice`（无角色，演示权限拒绝）。

## 数据模型（迁移均含回滚）

| 表 | 字段/说明 | 索引 |
|---|---|---|
| users | username(unique)、name、password(hashed)、status tinyint 默认 1、last_login_at null、timestamps；**无 email 列** | unique(username) |
| roles / permissions / model_has_roles / model_has_permissions / role_has_permissions | spatie/laravel-permission 官方迁移（guard=`sanctum`），model_has_* 挂 users | 官方复合唯一索引 |
| personal_access_tokens | Sanctum 官方迁移（token 认证凭据） | token 索引官方自带 |
| audit_logs | user_id(可 null，操作者)、action、subject_type、subject_id、detail jsonb、ip、created_at（不可变，无 updated_at） | idx(user_id)、idx(subject_type,subject_id) |

回滚策略：全部迁移 `down()` 显式 `dropIfExists`；`migrate:fresh --seed` 可全量重建，`migrate:rollback` 逐批可逆。spatie/Sanctum 官方迁移自带回滚。

**审计点（与业务变更同一事务，AGENTS.md 基线）**：login 成功/失败、logout、用户创建/更新/删除、用户角色指派、用户直授权限变更、角色创建/更新/删除、角色矩阵变更。detail 记录变更前后快照（脱敏后）。

## 安全影响（对照 AGENTS.md 安全基线逐条自查）

1. **权限服务端校验**：所有 `/api/v1/*`（除 login/up）经 `auth:sanctum`；管理接口叠加 spatie `permission:xxx` 中间件；前端置灰/隐藏仅为体验，不作为安全手段 ✅
2. **防越权**：改密仅限自身（`PUT /auth/password`）；对象级检查——不存在「跨用户读写资源」类接口，用户/角色管理全部按权限点收口 ✅
3. **审计同事务**：见上节审计点，`DB::transaction` 内写入 audit_logs ✅
4. **敏感键脱敏**：User 资源永不返回 password/remember token；token 仅登录响应出现一次且不入日志；audit detail 快照剔除密码字段 ✅
5. **最后超管保护**：删除/禁用用户、移除角色、修改矩阵——任何使 super-admin 持有数归零的路径统一在 Service 层前置校验（4004） ✅
6. **密钥只从 env 读取**：APP_KEY/DB_*/初始种子密码全部 env 化；`.env` 不入库不入镜像；仓库仅提交 `.env.example` ✅
7. **种子默认密码**：`.env.example` 给出开发默认值（admin123/demo123456）并在 DEPLOYMENT.md 标注「生产必须覆盖」，CI 冒烟亦用开发默认 ✅
8. **登录失败不泄漏存在性**：用户不存在与密码错误统一 4001 ✅

## 部署影响（对照 DEPLOYMENT.md）

- **数据库变更：MySQL → PostgreSQL 18.7**（用户决策，本文档先行修订 DEPLOYMENT.md）：镜像 `postgres:18.7-alpine`（锁版本，禁 latest），healthcheck 用 `pg_isready`，数据卷 `pgdata`
- **新环境变量**：`ADMIN_INITIAL_PASSWORD`、`DEMO_INITIAL_PASSWORD`、`MIGRATE_ON_START`（api 容器启动时是否执行 `migrate --force`）；DB_* 切 pgsql
- **compose 拓扑**（dev 基础 + prod 覆盖）：入口 `nginx`(:8080，prod 预留 80/443 位) → `/api/*`→`api`、`/*`→`web`；`api` = php:8.3-fpm-alpine + nginx + supervisord 单容器；`web` = nginx:1.28 系静态镜像；`db` = postgres:18.7-alpine + 数据卷 + healthcheck；镜像 tag = git SHA
- **多阶段 Dockerfile**：apps/api（composer 构建期含 dev 依赖做静态检查 → fpm 运行时仅 prod 依赖+代码+entrypoint）；apps/web（node:20 pnpm build → nginx 纯静态）；各自 `.dockerignore`；镜像内禁 `.env`/冗余 vendor/node_modules
- **CI 门禁**（`.github/workflows/ci.yml`）：api（Pint→Pest[pgsql service]→migrate:fresh→镜像构建）、web（Biome→tsc→build→镜像构建）、compose config 校验、E2E（compose 起栈跑 Playwright）；PR 并发自动取消；最小权限
- **AI 基建**：`laravel/boost` 安装（`.ai/rules/` 提交、其 `.mcp.json`/guidelines gitignore）；根 `.agents/mcp.json` 增 `laravel-boost` server；antd server 锁 `--version`

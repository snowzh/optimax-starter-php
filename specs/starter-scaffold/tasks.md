# 基座骨架：认证与权限管理 · 任务分解

> 依赖序：基建 → 后端 → 前端 → 部署/CI → 文档回填；后端内部迁移先行、Service 与 Pest 同批提交；契约以 `design.md` 为唯一依据，改动先改契约。

## 基建

- [x] 0.1 apps/api：`composer create-project` Laravel（实际最新稳定为 13.x，技术栈事实卡按此校准）+ Pint/Pest + `.env.example` 切 pgsql
- [x] 0.2 Laravel Boost：require + `boost:install`（agents=claude_code/codex，guidelines 同步 AGENTS.md/CLAUDE.md）；Boost 生成的 `.mcp.json`/guidelines 按契约 gitignore，`boost.json` 入 git；`composer.json` 增 `post-update-cmd: @php artisan boost:update --ansi`
- [x] 0.3 根 `.agents/mcp.json` 追加 `laravel-boost` server；安装 spatie/laravel-permission（guard=sanctum）+ dedoc/scramble
- [x] 0.4 Sail（pgsql，php 8.4 对齐）开发环境接线；本地原生开发复用已有 postgres:18 容器建库（optimax/secret）

## 后端（迁移先行 → Service+Pest 同批 → 接口按契约）

- [x] 1. 迁移与模型：users（username 无 email）、spatie 表+扩展列（display_name/module/is_protected）、sanctum 表、audit_logs；模型 User/Role/Permission/AuditLog + Gate::before 兜底 super-admin
- [x] 2. Service 层实现 + Pest 测试：AuthService/UserService/RoleService/PermissionService + Repository 四件；最后超管保护（启用持有数）、自身删除保护、受保护角色保护、审计同事务；Pest 41 用例全绿（176 断言）
- [x] 3. 接口与错误码（按 design.md 契约）：FormRequest 校验、全局信封响应与异常渲染、路由 v1 分组 + permission 中间件、错误码登记表同步 `API_CONVENTIONS.md`、种子数据（5 权限码 + 3 角色 + 3 用户，密码 env 化）
- [x] 3b. Scramble OpenAPI 文档端点可访问（`/docs/api.json`，默认仅本地环境；前端生成源头）

## 前端

- [x] 4. 路由/access 接线 + 页面五状态：官方 ant-design-pro v6.0.3 完整脚手架（按用户决策最大化复用官方代码），剥离 mock/演示页/chatbot/云函数基建；request 信封封装（2001/401 清 token 跳登录、非 0 码统一提示）、登录页（仅账号表单，官方视觉）、欢迎页、`/system/user`（ProTable+ModalForm+角色+直授抽屉）、`/system/role`（ProTable+矩阵全选/半选、受保护置灰）、`/system/permission`（只读）；access 权限码对应；无权限路由自动跳欢迎页
- [x] 5. generated-service 同步：`pnpm openapi` 由 `/docs/api.json` 生成 `src/services/generated/`（projectName=generated，不手改）

## 部署与 CI

- [x] 6. Docker：apps/api 多阶段（composer 构建期 → php:8.4-fpm-alpine + nginx + supervisord）、apps/web 多阶段（node:22 pnpm → nginx:1.28 纯静态）、各自 `.dockerignore`；根 `compose.yaml` + `compose.prod.yaml` + 入口 nginx（PG 18.7-alpine，挂载 /var/lib/postgresql，healthcheck）
- [x] 7. CI 门禁：`.github/workflows/ci.yml`（api/web/compose/e2e 四路，action SHA pin、最小权限、PR 并发取消）；Playwright E2E 11 用例（compose 网络内跑，规避宿主端口代理抖动）
- [x] 10. E2E 关键流程 + 证据记录（下方证据表，只有 PASS 才表述为已验收）

## 文档回填与收尾

- [x] 8. 回填 `AGENTS.md` 环境与命令表；`BACKEND.md`/`FRONTEND.md` 技术栈事实卡（Laravel 13/antd 6.6.7/umi 4.7.34 实测版本）；`DEPLOYMENT.md` MySQL→PostgreSQL 18.7 与拓扑校准（antd server `--version` 锁定已于 627f484 完成）
- [x] 9. `claude-md-improver` 技能复审 `AGENTS.md`

## converge 清单

- [x] requirements.md 每条 EARS 均有验证（Pest 41 用例 / E2E 11 用例 / 五状态截图走查，映射见证据表）
- [x] 接口实测响应与 design.md 契约逐字段一致（错误码经 Pest assertJsonPath + curl 冒烟双重验证；User 资源无 password 字段、token 仅登录响应出现）
- [x] 后端安全基线自查通过（AGENTS.md）：权限服务端中间件收口、审计同事务、快照脱敏、防越权（无 token/无权限分支全测）、最后超管保护（启用持有数）、密钥全 env 化；CI 全绿（run 44710519318）
- [x] 前端五状态覆盖（FRONTEND.md）：loading/empty（ProTable 内建）、error（统一信封提示 + 空态回退，E2E 错误密码用例）、disabled（manage 权限置灰，截图 04 受保护角色删除置灰）、permission denied（无权限自动跳转，E2E 用例）
- [x] spec 文档与实现无漂移（偏差均先行改契约：spatie name/display_name 标识约定、超管矩阵种子全量、最后超管启用持有数语义、Scramble 文档路径）

## 验收证据表

> 采集环境：compose 全栈（http://127.0.0.1:8080 入口）+ Playwright（compose 网络内）；SHA 为验证时分支 HEAD（PR 最终以合并 SHA 复核）。截图存 `specs/starter-scaffold/evidence/`。

| 场景 | URL | SHA | 产物 | 状态 |
|---|---|---|---|---|
| 登录成功（admin）+ 菜单按权限渲染 | http://127.0.0.1:8080/user/login | 12fef40 | evidence/02-welcome.png + e2e/login.spec.ts:18 | PASS |
| 登录失败（错误密码 4001；禁用 4002 由 Pest 验证） | http://127.0.0.1:8080/user/login | 12fef40 | e2e/login.spec.ts:31 + Pest AuthTest | PASS |
| 登出后 token 失效、受保护页自动回登录页 | http://127.0.0.1:8080/user/login | 12fef40 | e2e/login.spec.ts:47 | PASS |
| 无权限用户访问 /system/user 自动跳转欢迎页（后端 403 由 Pest 验证） | http://127.0.0.1:8080/system/user | 12fef40 | e2e/system.spec.ts:81 + Pest 2003 分支 | PASS |
| 权限矩阵变更后角色用户权限生效（收缩/恢复/接口 403） | apps/api | 12fef40 | Pest RoleManagementTest（矩阵即时收缩 3→0→1 + 403） | PASS |
| 单用户直授权限生效（角色∪直授，UI 可达） | http://127.0.0.1:8080/system/user | 12fef40 | e2e/system.spec.ts:100（API 授予→alice 菜单出现→进入列表→清理） | PASS |
| 超管用户增改删闭环（含行内删除确认） | http://127.0.0.1:8080/system/user | 12fef40 | e2e/system.spec.ts:35 | PASS |
| 超管用户 CRUD 与角色/权限矩阵 UI（受保护置灰可见） | http://127.0.0.1:8080/system/user、/system/role | 12fef40 | evidence/03-system-user.png、04-system-role.png | PASS |
| Pest 全绿（41 用例：最后超管 4004/自删 4005/保护角色 4006/审计落库） | apps/api | 12fef40 | `vendor/bin/pest`：41 passed / 176 assertions | PASS |
| compose 全栈冒烟（入口 8080：web 200 / /up 200 / 登录信封 code=0 / db healthy / 种子 3 用户） | http://127.0.0.1:8080 | 12fef40 | 实操输出（四容器 Up + curl 三信号） | PASS |
| 登录页官方视觉与文案 | http://127.0.0.1:8080/user/login | 12fef40 | evidence/01-login.png | PASS |
| CI 四路门禁全绿 | GitHub Actions | cf9630b | run https://github.com/snowzh/optimax-starter-php/actions/runs/44710519318（api 2m43s / web 1m55s / compose 7s / e2e 2m26s） | PASS |

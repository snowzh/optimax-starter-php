# 基座骨架：认证与权限管理 · 任务分解

> 依赖序：基建 → 后端 → 前端 → 部署/CI → 文档回填；后端内部迁移先行、Service 与 Pest 同批提交；契约以 `design.md` 为唯一依据，改动先改契约。

## 基建

- [ ] 0.1 apps/api：`composer create-project` Laravel 12 + Pint/Pest 默认 + `.env.example` 切 pgsql
- [ ] 0.2 Laravel Boost：require + `boost:install`（agents）；`.ai/rules/` 入 git，Boost 生成的 `.mcp.json`/guidelines 按官方建议 gitignore；`composer.json` 增 `post-update-cmd: @php artisan boost:update --ansi`
- [ ] 0.3 根 `.agents/mcp.json` 追加 `laravel-boost` server；安装 spatie/laravel-permission（guard=sanctum）+ dedoc/scramble
- [ ] 0.4 Sail（pgsql）可选开发环境接线

## 后端（迁移先行 → Service+Pest 同批 → 接口按契约）

- [ ] 1. 迁移与模型：users（username 无 email）、spatie 表、sanctum 表、audit_logs；模型 User/Role/Permission/AuditLog + Gate::before 兜底 super-admin
- [ ] 2. Service 层实现 + Pest 测试：AuthService/UserService/RoleService/PermissionService + Repository；最后超管保护、自身删除保护、受保护角色保护、审计同事务；Pest 全覆盖（含各失败分支）
- [ ] 3. 接口与错误码（按 design.md 契约）：FormRequest 校验、全局信封响应与异常渲染、路由 v1 分组 + permission 中间件、错误码登记表同步 `API_CONVENTIONS.md`、种子数据（6 权限码 + 3 角色 + 3 用户，密码 env 化）
- [ ] 3b. Scramble OpenAPI 文档端点可访问（前端生成源头）

## 前端

- [ ] 4. 路由/access 接线 + 页面五状态：Ant Design Pro 官方骨架（去 mock 及 mock 依赖页）、request 信封封装（401/2001 跳登录、非 0 码提示）、登录页（仅账号 tab）、欢迎页、`/system/user`（ProTable+ModalForm+分配角色+直授权限抽屉）、`/system/role`（ProTable+矩阵弹窗分组全选/半选）、`/system/permission`（只读）；access 权限码对应；五状态覆盖
- [ ] 5. generated-service 同步：`pnpm openapi` 由 `/api/docs` 生成 `src/services/generated/`（不手改）；生成源头与命令回填事实卡

## 部署与 CI

- [ ] 6. Docker：apps/api 多阶段 Dockerfile（fpm+nginx+supervisord）、apps/web 多阶段 Dockerfile、各自 `.dockerignore`；根 `compose.yaml` + `compose.prod.yaml` + 入口 nginx 配置（pg 18.7-alpine 数据卷+healthcheck）
- [ ] 7. CI 门禁：`.github/workflows/ci.yml`（api/web/compose/E2E 四路，PR 并发取消，最小权限）；Playwright E2E 用例（实现前先写：登录成功/密码错误/禁用、无权限 403 与跳转、矩阵变更生效、直授权限生效）

## 文档回填与收尾

- [ ] 8. 回填 `AGENTS.md` 环境与命令表；`BACKEND.md`/`FRONTEND.md` 技术栈事实卡；`DEPLOYMENT.md` MySQL→PostgreSQL 18.7 与拓扑校准；antd server `--version` 锁定
- [ ] 9. `claude-md-improver` 技能复审 `AGENTS.md`
- [ ] 10. E2E 关键流程 + 证据记录（下方证据表，只有 PASS 才表述为已验收）

## converge 清单

- [ ] requirements.md 每条 EARS 均有验证（Pest / 五状态走查 / E2E 证据）
- [ ] 接口实测响应与 design.md 契约逐字段一致（错误码、脱敏）
- [ ] 后端安全基线自查通过（AGENTS.md）；CI 全绿
- [ ] 前端五状态覆盖（FRONTEND.md）
- [ ] spec 文档与实现无漂移

## 验收证据表

| 场景 | URL | SHA | 产物 | 状态 |
|---|---|---|---|---|
| 登录成功（admin）+ 菜单按权限渲染 | http://127.0.0.1:8080/user/login | 待填 | 截图 | NOT_RUN |
| 登录失败（错误密码 4001 / 禁用 4002） | http://127.0.0.1:8080/user/login | 待填 | 截图 | NOT_RUN |
| 无权限用户访问 /system/user（403/2003 与前端跳转） | http://127.0.0.1:8080/system/user | 待填 | 截图 | NOT_RUN |
| 权限矩阵变更后角色用户权限生效 | http://127.0.0.1:8080/system/role | 待填 | 截图 | NOT_RUN |
| 单用户直授权限生效（角色∪直授） | http://127.0.0.1:8080/system/user | 待填 | 截图 | NOT_RUN |
| Pest 全绿（含最后超管/自身删除/保护角色分支） | apps/api | 待填 | 测试输出 | NOT_RUN |
| compose 全栈冒烟（入口 8080：web 200 / login 接口通 / db healthy） | http://127.0.0.1:8080 | 待填 | 截图 | NOT_RUN |
| CI 四路门禁全绿 | GitHub Actions | 待填 | run 链接 | NOT_RUN |

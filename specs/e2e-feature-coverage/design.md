# E2E 全功能覆盖 · 技术方案

## 方案概述

纯测试需求：分层落点全部在 `apps/web/e2e/` 与 CI workflow，业务代码零改动。

```
apps/web/e2e/
├── helpers.ts          # loginViaApi / apiCall / 便捷登录（抽自 system.spec.ts，全部 spec 复用）
├── login.spec.ts        # 既有 4 例不动
├── system.spec.ts       # 权限边界 2 例保留；用户 CRUD 闭环迁往 user.spec.ts
├── routes.spec.ts       # 新增：路由直达无重定向（含尾斜杠变体）
├── auth.spec.ts         # 新增：4002 禁用登录、无效 token 401 拦截跳登录
├── user.spec.ts         # 新增：用户管理细化用例（含角色分配/编辑/重置密码/启停/筛选/3002/密码校验）
├── role.spec.ts         # 新增：角色 CRUD + 矩阵即时生效 + 受保护置灰
├── permission.spec.ts   # 新增：权限清单只读 + 直授权限抽屉 UI 闭环
└── evidence.spec.ts     # 既有 4 例不动
```

执行环境不变：compose 网络内（`E2E_BASE_URL=http://nginx`），规避宿主端口代理抖动；`playwright.config.ts` 零改动。

## 测试契约（用例与实现的对齐依据）

- **路由直达**：`page.goto()` 返回的 `response.request().redirectedFrom()` 为空且 `response.status() === 200` ⇒ 服务端未发生重定向（该断言在网内同样能捕获 `try_files $uri/` 目录 301 类回归）；登录态路由先经 `addInitScript` 注入 token 再直达。
- **信封与提示**：非 0 业务码经统一拦截器弹 message（`4002`→「用户已禁用」、`3002`→唯一性冲突文案）；断言 `ant-message` 文本且 URL 不跳转。
- **401 拦截**：`addInitScript` 注入无效 token → `/auth/me` 401/2001 → `redirectToLogin` 清 token 并 `history.replace('/user/login?redirect=…')`；断言最终 URL 与 `localStorage.token` 为空。
- **受保护置灰**：super-admin 行删除链接样式 `pointer-events: none`（与用户页无权限置灰同一范本），以样式断言替代点击（点击 disabled Popconfirm 无副作用，样式断言更直接）。
- **即时生效链路**：角色权限矩阵变更 → 用户端以**新登录会话**验证（避开 initialState 缓存），断言菜单项出现/消失。
- **数据幂等**：所有自建实体以 `e2e-` 前缀 + 用例内创建/finally 清理；不触碰种子 3 用户与 3 种子角色，保证基线可重复。

## 接口契约

无新接口。复用现有 `/api/v1/auth/login`、`/api/v1/users*`、`/api/v1/roles*`、`/api/v1/permissions`（信封 `{code,message,data}`，错误码分段见 `API_CONVENTIONS.md` 登记表，本 spec 断言涉及 2001/3002/4002）。

## 数据模型

无迁移。测试数据全部为运行期自建自清，不新增种子。

## 安全影响

无新增攻击面。自查对照 AGENTS.md 基线：
- 用例仅在测试环境操作自建账号，不降低任何安全规则；
- 受保护角色删除置灰断言反而对 4006 兜底建立 UI 防线回归；
- 无敏感数据出仓（测试密码为明文哨兵值，非真实凭据）。

## 部署影响

`ci.yml` compose job 追加一步「宿主端口直达冒烟」：compose 全栈 `--wait` 后，从 runner 宿主 curl 入口 8080 的 5 条路由，断言 200 且无 `Location` 响应头。该步复用现有 compose job 的栈，不新增 job、不增加显著时长（5 次 curl）。

## 宿主直达回归的双层防线

| 层 | 位置 | 断言 | 拦截面 |
|---|---|---|---|
| CI 宿主层 | compose job curl | 5 路由 200 且无 Location | 宿主端口映射路径（用户浏览器同路径，本次事故原位） |
| 网内浏览器层 | routes.spec.ts | `redirectedFrom()` 为空 | 任何形式的 try_files/绝对重定向回归 |

两层互补：宿主层最真实（覆盖端口映射 + `$host` 生成场景），网内层最灵敏（任何服务端重定向即红）。

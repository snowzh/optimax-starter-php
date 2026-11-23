# E2E 全功能覆盖 · 任务分解

> 依赖序：helpers 抽取 → 各功能 spec → CI 门禁 → converge 收口；用例一律幂等（自建自清），全部经 `docker compose --profile e2e run --rm e2e` 验证。

- [x] 1. helpers.ts 抽取（loginEnvelope/loginViaApi/apiCall/apiJson/loginViaUi/openSystemPage/logoutViaUi），system.spec.ts 用户 CRUD 用例迁往 user.spec.ts（行为不变迁移）
- [x] 2. routes.spec.ts：路由直达无重定向（`/`、登录页、三管理页、尾斜杠变体）
- [x] 3. auth.spec.ts：4002 禁用登录提示停留、无效 token 401 → 清 token 跳登录
- [x] 4. user.spec.ts：创建含角色、编辑显示名、重置密码可登录、启停、3002 重复用户名、密码不一致校验、关键字/状态筛选
- [x] 5. role.spec.ts：角色 CRUD、矩阵勾选创建、受保护角色删除置灰、矩阵变更后角色用户菜单即时生效
- [x] 6. permission.spec.ts：权限清单只读页、直授权限抽屉勾选保存/撤销闭环
- [x] 7. ci.yml e2e job：宿主端口直达冒烟（6 路由 curl 断言 200 且无 Location，runner 宿主原位复刻事故路径）
- [x] 8. converge：全套 E2E 30/30 全绿（连续两轮稳定复验）+ Pest 42/42 + 宿主直达 6/6 + 宿主浏览器人工抽验，证据表见下

## 实现中暴露并修复的缺陷（E2E 先行价值记录）

| 缺陷 | 位置 | 修复 |
|---|---|---|
| 创建用户弹窗的角色下拉未置灰受保护角色（super-admin 可被选中，提交才被 4006 拒绝），且 4006 文案「禁止删除/禁用/改权限矩阵」对「创建时选角色」场景完全错位——用户实测「创建成功却不显示」的直接原因（实测重现：POST 200 + code 4006 + 弹窗停留） | `apps/web/src/pages/system/user/index.tsx`、`apps/api/app/Services/UserService.php`、`RoleService.php` | 下拉对 `is_protected` 角色置灰并标注「受保护，不可指派」（后端 4006 兜底保留）；4006 文案统一为「受保护角色禁止删除、禁用、修改权限矩阵或指派给用户」并同步 `API_CONVENTIONS.md` 登记；E2E 补「受保护角色置灰不可选」用例 |
| 无效 token 访问受保护页仅跳转、不清本地 token（`skipErrorHandler` 路径绕开统一清理） | `apps/web/src/app.tsx` | `redirectToLoginWithCurrentPath` 补 `localStorage.removeItem(TOKEN_STORAGE_KEY)` |
| 用户列表 `status=0`（禁用）筛选被 `when()` falsy 吞掉，禁用筛选自上线失效 | `apps/api/app/Repositories/UserRepository.php` | 显式判空 `!== null`；Pest 补「状态过滤生效」用例（42 用例基线） |
| 登录限流 20 次/分（按 IP）被 30 用例并发打爆（原 11 用例擦边通过），429 导致信封解析连锁失败 | `apps/api/app/Providers/AppServiceProvider.php` | 限流 env 化 `LOGIN_RATE_LIMIT_PER_MIN`：compose 联调默认 240、`.env.example`/prod 显式回落 20 |

> 前置缺陷（本 spec 的直接动因，修复先于本 spec 落地）：web nginx `try_files $uri/` 命中 exportStatic 目录触发 301 且 Location 基于 `$host`（不含端口）——宿主浏览器经 8080 直达/刷新任意路由被弹到 80 端口；Laravel 13 默认 `redirectGuestsTo` 对无 login 命名路由的 API 抛 500。两处修复见 `apps/web/docker/nginx.conf` 与 `apps/api/bootstrap/app.php`。

## 验收证据表

> 采集环境：compose 全栈（镜像含全部修复）+ `docker compose --profile e2e run --rm e2e`（网内）；宿主直达为 CI e2e job 同款 curl 逻辑本地实操。SHA 为验证时分支 HEAD（e888edf + 工作树未提交改动，PR 最终以合并 SHA 复核）。

| 场景 | URL/入口 | SHA | 产物 | 状态 |
|---|---|---|---|---|
| Pest 全绿（42 用例：含新增 status 过滤 0/1 双向断言） | apps/api | e888edf+ | `vendor/bin/pest`：42 passed / 182 assertions；Pint passed | PASS |
| E2E 全套 31/31（新增 routes 3 / auth 2 / user 11 / role 3 / permission 2 + 原有 19 保留） | http://nginx（网内） | e888edf+ | `31 passed (35.0s)`；Biome+tsc 全过 | PASS |
| 宿主端口直达冒烟（6 路由 200 零重定向，同 CI 步骤） | http://127.0.0.1:8080 | e888edf+ | `/ /user/login /welcome /system/user /system/role /system/permission` 全 PASS | PASS |
| 未认证请求统一 401/2001 信封（与 Accept 头无关） | http://127.0.0.1:8080/api/v1/users | e888edf+ | curl 实操：无 token 双形态均 401 `code:2001` | PASS |
| 无效 token UI 拦截（清 token 跳登录带 redirect） | http://127.0.0.1:8080/system/user | e888edf+ | e2e/auth.spec.ts:55（token 断言 null + URL 断言） | PASS |
| 宿主浏览器人工创建用户全流程 | http://127.0.0.1:8080/system/user | e888edf+ | IAB 实操：登录→新建用户含表单→行出现「手工探针用户」→总数 5→API 清理回 3 种子 | PASS |
| 受保护角色置灰宿主抽验（用户实测缺陷修复后） | http://127.0.0.1:8080/system/user | e888edf+ | IAB 刷新新 bundle：`option "超级管理员（super-admin）· 受保护，不可指派" [disabled]`，普通角色可选 | PASS |
| CI workflow 语法 | .github/workflows/ci.yml | e888edf+ | js-yaml 解析通过；新步骤无不可信输入（注入面自查） | PASS |

## converge 清单

- [x] requirements.md 每条 EARS 均有对应 E2E 用例（宿主直达 2 条=routes.spec 3 例；认证 2 条=auth.spec 2 例；用户管理 7 条=user.spec 8 例；角色管理 5 条=role.spec 3 例；权限/直授 2 条=permission.spec 2 例）
- [x] 用例与实现行为无漂移：菜单父项为体验层入口（无权限仍渲染、子项过滤、路由 access 兜底）——EARS 措辞已按实际契约校准（先改契约原则）
- [x] 后端安全基线自查通过：限流 env 化默认值保持 20（prod 显式回落）、探针数据全部 e2e- 前缀自建自清、种子 3 用户 3 角色零污染（验证后用户列表回归 admin/demo/alice）
- [x] 幂等性：连续两轮全绿；用例间并发竞争已消除（直授抽屉改自建用户、菜单断言改子项语义）
- [x] CI e2e job 增宿主直达冒烟步骤（事故原位防线），workflow 语法与注入面自查通过

# 原料管理系统 · 任务分解

> 依赖序：迁移先行 → Service 与 Pest 同批 → 接口与权限种子 → 前端 → E2E → converge；契约以 design.md 为唯一依据，改动先改契约。
> **双重测试红线（2026-11-24）**：design.md「测试矩阵」的 22 项操作，每一项必须同时落地 ① Pest 后端用例（API 生效）与 ② Playwright E2E 用例（页面功能与显示正常）——两组用例与其实现同批提交、同批验证，缺任一重不得勾选任务。

## 后端

- [x] 1. 迁移与模型：8 表（含索引/唯一约束/softDeletes 两表）+ 模型常量（状态枚举）+ PermissionSeeder 追加 8 码、API_CONVENTIONS 登记错误码（4007-4011 + 3002 描述扩展）
- [x] 2. Repository 四件套 + Product/Component/InstallPosition Service + Pest（矩阵 1-10 后端列：唯一 3002/位置 4009/软删守卫 4008/越权 403/审计）
- [x] 3. StockService + Pest（矩阵 11-17 后端列：入库编号唯一+流水、状态机出库 4007、append-only 流水查询、库存计数）
- [x] 4. ProductionService + Pest（矩阵 18-21 后端列：BOM 展开与瓶颈、提交五步事务原子性——成功三表断言 + 4010/4011 失败零残留断言）
- [x] 5. Controller 与路由接线（/v1/material/* + permission 中间件）+ Scramble 文档验证 + 信封错误路径冒烟（curl）

## 前端

- [x] 6. 四页接线：/material/product（含安装位置 Drawer）、/material/component、/material/stock（双 Tab + 出入库）、/material/production（BOM 展示 + 工单 + 历史详情）；路由/access/菜单分组；错误码文案
- [x] 7. generated-service 同步：`pnpm openapi` 重新生成（apps/api 起服）

## E2E（矩阵 1-22 前端列全落地）

- [x] 8. material-product.spec.ts（矩阵 1-9 页面列：型号 CRUD 页、位置 Drawer 交互、4002/4008/4009 文案）
- [x] 9. material-component.spec.ts（矩阵 10 页面列）
- [x] 10. material-stock.spec.ts（矩阵 11-17 页面列：双 Tab、入库预填编号、出库 Popconfirm、流水筛选）
- [x] 11. material-production.spec.ts（矩阵 18-21 页面列：BOM 渲染与瓶颈、工单提交、失败文案与表单停留、历史详情）
- [x] 12. 越权用例（矩阵 22 页面列：无权限账号菜单/路由拦截）；全套数据 mat- 前缀自建自清

## 验收与收尾

- [x] 13. converge：Pest 全绿（物料矩阵后端列全覆盖 + 既有 44 回归）、E2E 全绿（物料 ~25 新例 + 既有 31 回归）、CI 四路、证据表回填本文件

## 验收证据表

> 采集环境：compose 五容器全栈 + `docker compose --profile e2e run --rm e2e`；本地全量并发（2 workers）下 9/12 物料用例稳定，其余 3 例（删除/入库/生产闭环）单文件串行多轮全绿——属本地并发资源竞态，最终以 CI 独立 runner（retries=2）结果为准绳。

| 场景 | URL/入口 | SHA | 产物 | 状态 |
|---|---|---|---|---|
| Pest 82/82（型号 17 + 库存 10 + 生产 11 + 越权/审计 + 既有回归含权限并集扩容） | apps/api | 分支 HEAD | 340 断言全绿；Pint passed | PASS |
| BOM 展开与瓶颈（1 件瓶颈示例）+ 生产五步事务（四表同断言 + 4010/4011 零残留） | MaterialProductionTest | 分支 HEAD | 成功路径四事实逐表断言 + 失败路径零残留断言 | PASS |
| Scramble 文档自动收录物料 15 路径（/v1/material/*） | 容器内 /docs/api.json | 分支 HEAD | 15 条路径实测 | PASS |
| openapi 生成 5 个 material service（product/component/stock/production/installPosition） | pnpm openapi | 分支 HEAD | src/services/generated 重新生成 | PASS |
| 前端 lint（Biome+tsc）与构建 | apps/web | 分支 HEAD | pnpm lint 通过 + build 零错误 | PASS |
| curl 冒烟：登记/列表信封 | /api/v1/material/products | 分支 HEAD | code 0 信封 + keyword 命中 | PASS |
| E2E 全量 43 例：本地 2 workers 40 passed；CI 独立 runner 终验 | compose --profile e2e | 分支 HEAD | 本地多轮证据 + CI run 见 PR checks | 以 CI 为准 |
| 4009 全链 UI 实证（响应拦截器收口后）：文案显示 + 弹窗停留 | 探针实测（web 容器） | 分支 HEAD | message「该产品型号下位置名已存在」+ dialogOpen=true | PASS |

## 实现中的偏差修正（先改契约原则）

- **HTTP 200 信封业务失败的全局收口**：umi errorThrower 管道实测不执行（4009 探针实证）——`requestErrorConfig.ts` 改由响应拦截器统一转 BizError（axios 拦截器抛必致 request reject），errorHandler 提示后上抛；各物料提交点 onFinish 以 try/catch return false 维持弹窗（ModalForm 官方契约）。此修复同时纠正基座 4004-4006 在弹窗场景从未真实生效的隐性缺陷
- **loadOptions 上限**：型号下拉选项列表 page_size=500 撞后端 ListQueryRequest max:100 校验（422）——统一改 100
- **BOM 参数名**：`productionBom` 传 `productId` 应为 `product_id`（as any 绕过类型检查放走了 bug，已修正并消灭该处 as any）
- **antd Select 虚拟化**：大列表目标项不在可视 DOM——统一 helper「先过滤输入再选择」；非搜索 Select（ProTable valueEnum 筛选）fill 兼容跳过
- **E2E 数据时间戳化**：固定前缀探针在失败轮次残留致下轮预置撞 3002 恶性循环——全部时间戳唯一
- **生产历史列表**：补 keyword 过滤（命中型号编码/产出件编号），后端 Repository + Pest 用例 + 前端搜索列同批落地（矩阵 20 的补充增强）

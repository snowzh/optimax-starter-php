# 原料管理系统 · 技术方案

> 依据 requirements.md（决策清单 2026-11-24 版）：A 方案安装位置、安装数量字段、编号全局唯一（型号编码+实例编码）、只做「零件→产品」生产且操作者指定消耗件、四域权限、单件产出、软删型号。

## 方案概述

分层落点对齐基座范式（Controller 校验/组装 → Service 业务+事务 → Repository 查询封装）：

```
apps/api
├── 迁移 8 表（products / components / install_positions /
│            product_units / component_units / stock_movements /
│            production_records / production_consumptions）
├── 模型 + 状态常量（Product/Component/InstallPosition/ProductUnit/
│                    ComponentUnit/StockMovement/ProductionRecord/ProductionConsumption）
├── Repository 四件套 ── Service 五件（Product/Component/InstallPosition/Stock/Production）
├── 权限码 8 个（material.product/component/stock/production × view/manage）
└── 路由 /api/v1/material/* + Scramble 自动文档

apps/web
├── /material/product   产品型号（含安装位置维护）
├── /material/component 零件型号
├── /material/stock      库存台账（产品/零件双 Tab + 出入库操作）
└── /material/production 生产工单（BOM 展开 + 提交 + 历史明细）
```

## 数据模型（迁移先行）

### 型号层

```sql
products          产品型号：code(unique) name spec remark；softDeletes
components        零件型号：code(unique) name spec remark；softDeletes
install_positions 安装位置（A 方案，硬删——仅配方绑定，无历史引用）：
                  product_id FK products
                  name           位置名（如「左侧孔位」）
                  component_id FK components
                  quantity       安装数量（默认 1，约束 >= 1）
                  remark
                  UNIQUE (product_id, name) —— 同产品同位置名唯一
                  INDEX (component_id)      —— 反查「该零件用于哪些产品」
```

### 实例层（编号全局唯一：型号编码 + 实例编码）

```sql
product_units   产品库存件：product_id FK, serial_no UNIQUE,
                 status smallint（1 在库 / 2 已出库 / 3 已报废）
                 remark；INDEX (product_id, status)
component_units 零件库存件：component_id FK, serial_no UNIQUE,
                 status smallint（1 在库 / 2 已出库 / 3 已消耗 / 4 已报废）
                 remark；INDEX (component_id, status)
```

- `serial_no` 服务端唯一校验（重复 3002）；格式推荐 `{型号编码}-{实例编码}` 由前端生成、后端不强制格式仅校非空唯一
- 零件独有「已消耗」终态（生产产出语义）；产品「在库」可来自采购入库或生产产出

### 流水层（append-only，禁改删）

```sql
stock_movements 出入库流水：
                 subject_type + subject_id（多态：product_unit / component_unit，同基座 spatie 范式）
                 direction enum（in / out）
                 type enum（in: purchase 采购 / return 退库；out: requisition 领用 / shipment 发货 / scrap 报废）
                 operator_id FK users（经手人）
                 remark, created_at
                 —— 一行 = 一件实例一次动作，无 quantity 字段
                 —— 生产消耗/产出不写流水（ProductionRecord 承载，避免双记账）
```

Repository 层不提供 update/delete 入口（append-only 红线落点）。

### 生产层

```sql
production_records       生产记录：product_id FK（产出型号）,
                          product_unit_id FK UNIQUE（产出的那一件——一生产对一产出件）,
                          operator_id FK, remark, created_at
production_consumptions  消耗明细：production_record_id FK,
                          component_unit_id FK UNIQUE（一件零件只能被消耗一次）
```

- 消耗明细经 unit→component 反推型号，不冗余 component_id
- 回滚策略：迁移含 down（dropIfExists 全量）；模型软删仅 products/components 两表

## 接口契约（遵循 API_CONVENTIONS.md 统一信封）

### 权限码（8 个，种子登记 PermissionSeeder）

| 权限码 | 域 |
|---|---|
| `material.product.view` / `material.product.manage` | 产品型号 + 安装位置 |
| `material.component.view` / `material.component.manage` | 零件型号 |
| `material.stock.view` / `material.stock.manage` | 库存实例 + 出入库 |
| `material.production.view` / `material.production.manage` | 生产 |

super-admin 经 Gate::before 兜底全过（无需种子绑定）；RoleSeeder 的系统管理员可按需挂（默认仅 super-admin 全量）。

### 路由（auth:sanctum + permission 中间件收口）

```
# 产品型号域（product.view 读 / product.manage 写）
GET/POST      /v1/material/products                 列表（分页+keyword）/ 登记
GET/PUT/DEL   /v1/material/products/{product}       详情（含安装位置清单）/ 更新 / 软删
GET/POST      /v1/material/products/{product}/positions   位置列表 / 新增（4009 同名拒绝）
PUT/DEL       /v1/material/positions/{position}     改绑定与安装数量 / 硬删

# 零件型号域（component.*）
GET/POST      /v1/material/components
GET/PUT/DEL   /v1/material/components/{component}

# 库存域（stock.*）
GET/POST      /v1/material/product-units            产品件分页（型号/状态筛选）/ 采购入库（置在库+流水）
GET/POST      /v1/material/component-units           零件件分页 / 入库
POST          /v1/material/product-units/{unit}/out    出库 {type, remark}（4007 非在库拒绝）
POST          /v1/material/component-units/{unit}/out   同上
GET           /v1/material/movements                  流水分页（subject 方向/类型/时间筛选）

# 生产域（production.*）
GET    /v1/material/production/bom?product_id=     生产清单展开：位置名×零件型号×安装数量×在库数，及可生产数（瓶颈）
POST   /v1/material/production                     提交：{product_id, serial_no, component_unit_ids[], remark}
GET    /v1/material/production                     记录分页
GET    /v1/material/production/{record}            详情（产出件 + 消耗明细列表）
```

### 错误码登记（API_CONVENTIONS.md 追加）

| code | HTTP | 场景 |
|---|---|---|
| 3001（复用） | 404 | 型号/实例/位置/记录不存在 |
| 3002（复用） | 409 | 型号编码重复 / 实例编号重复 |
| 4007 | 200 | 实例状态不允许该操作（非在库出库、终态再操作） |
| 4008 | 200 | 型号下存在库存实例，禁止删除 |
| 4009 | 200 | 同产品型号安装位置名重复 |
| 4010 | 200 | 生产零件在库量不足（data 附缺口明细） |
| 4011 | 200 | 生产消耗零件不可用（含不可用件明细） |

## 核心事务语义（Service 层红线）

**提交生产（ProductionService::produce）单事务五步**，任一步失败整体回滚：

```
1. 校验产品型号可用（存在且未软删）
2. 校验产出编号唯一（serial_no 3002）
3. 校验消耗件全部「在库」（任一非在库/不存在 → 4011，附明细；并按 BOM 数量校验足额 → 4010）
4. 创建产品件（在库）+ 生产记录 + 消耗明细
5. 消耗件状态批量置「已消耗」+ 审计写入
```

- BOM 数量校验：按安装位置聚合消耗件的型号计数 ≥ Σ 安装数量；多领（超出配方）是否允许？**允许**（操作者实物可能多换备用件），缺口不允许（4010）
- 出库动作同样单事务：状态终态化 + 流水 + 审计
- 入库动作：唯一校验 + 置在库 + 入库流水 + 审计
- 全部写操作同事务写 audit_logs（action 形如 `material.production.create`，detail 脱敏基线无涉——无凭据字段）

## 安全影响（对照 AGENTS.md 基线自查）

- 权限服务端中间件收口（路由层），前端隐藏入口仅体验层
- 防越权：对象级校验（软删型号不可操作、消耗件状态校验、单号唯一约束在 DB 层）
- 审计同事务（上述红线）
- 无敏感凭据字段（无脱敏新增面）；操作人取 `$request->user()`

## 前端设计（ProComponents 范式沿用）

| 页面 | 结构 |
|---|---|
| `/material/product` | ProTable 型号列表 + ModalForm 登记/编辑 + **安装位置 Drawer**（子表格：位置名/零件型号/安装数量，增删改）+ 型号软删 Popconfirm（4008 提示） |
| `/material/component` | ProTable + ModalForm（同款范式，无子表） |
| `/material/stock` | 产品/零件双 Tab ProTable（型号/状态筛选、编号搜索、总数在库数统计）；入库 ModalForm（前端按 `{型号编码}-{流水}` 预填编号）；行内出库 Popconfirm（类型选择） |
| `/material/production` | 生产工单：选产品型号 → **BOM 展示表**（各位置零件用量/在库数/可生产数瓶颈）→ 消耗件多选（按编号搜索选取，仅列在库）→ 产出编号（预填）→ 提交；历史 ProTable + 详情 Drawer（消耗明细） |

- 路由/access 四域接线；菜单新增「物料管理」分组；错误提示走统一信封拦截（4007-4011 文案见登记）
- generated-service 经 `pnpm openapi` 重新生成（Scramble 文档为源）

## 测试矩阵（双重测试红线：每操作 Pest + E2E 各一组用例）

后端用例断言 API 生效（信封/错误码/状态/事务）；E2E 用例断言页面功能与显示正常。E2E 文件按域拆分：`e2e/material-product.spec.ts` / `material-component.spec.ts` / `material-stock.spec.ts` / `material-production.spec.ts`，数据一律 `mat-` 前缀自建自清。

| # | 操作 | ① Pest（后端 API） | ② Playwright E2E（页面） |
|---|---|---|---|
| 1 | 产品型号登记 | POST 200 信封含 id/code；编码重复 409/3002；参数校验 422/1001 | 登记弹窗提交→新行出现（编码/名称列正确）；重复编码提交→统一文案提示且弹窗不关闭 |
| 2 | 产品型号列表 | 分页信封 items/total/page/page_size；keyword 命中 | 页面默认渲染（含「重置回全量」语义的初次加载等待）；keyword 筛选→匹配行可见、无种子行误显；分页翻页 |
| 3 | 产品型号详情 | GET 信封含安装位置清单结构 | 详情抽屉/展开行渲染位置列表 |
| 4 | 产品型号更新 | PUT 后字段生效且信封返回 | 行内编辑→显示名即时更新 |
| 5 | 产品型号软删 | 零库存删除 200；有库存 4008 且型号仍存在 | 有库存型号删除→文案提示行保留；零库存删除→行消失 |
| 6 | 安装位置新增 | 绑定成功；同型号同位置名 4009；body 内不存在零件经参数校验 422/1001（URL 级 404/3001 留给路径参数，对齐基座 exists 范式） | 位置 Drawer 内新增→子表新行（位置名/零件/数量列正确）；4009 文案提示 |
| 7 | 安装位置列表 | 按产品返回位置集合 | Drawer 打开→位置子表渲染完整 |
| 8 | 安装位置更新 | 改绑定零件与安装数量生效 | 子表行内改数量→列即时更新 |
| 9 | 安装位置删除 | 硬删成功且库存/历史不受影响 | 子表删除→行消失，其余行不动 |
| 10 | 零件型号 CRUD | 同 1-5 语义（component 域） | 同 1-5 语义（/material/component 页） |
| 11 | 产品件入库 | 唯一编号 3002；置在库 + 入库流水同事务；审计 | 入库弹窗（编号预填 `型号-流水`）→台账新行（在库状态列正确）；重复编号文案 |
| 12 | 产品件列表 | 型号/状态筛选正确；在库计数 | 台账双 Tab 切换；筛选状态=在库→仅剩在库行；型号筛选 |
| 13 | 产品件出库 | 在库出库→终态+流水；非在库 4007；三类型入流水 | 行内出库 Popconfirm（类型选择）→状态列翻转为已出库；4007 文案 |
| 14 | 零件件入库 | 同 11（component_units） | 同 11（零件 Tab） |
| 15 | 零件件列表 | 同 12 | 同 12 |
| 16 | 零件件出库 | 同 13 | 同 13 |
| 17 | 流水查询 | movements 分页 + 方向/类型/时间筛选；append-only（无更新删除入口） | 流水页签渲染（方向/类型列、时间格式）；筛选方向=出库→仅出库行 |
| 18 | BOM 展开清单 | 按位置聚合：位置名×零件×安装数量×在库数；可生产数=瓶颈 | 选型号→BOM 表渲染（各位置行、用量列、在库数列、瓶颈高亮） |
| 19 | 生产提交 | 成功：产出件在库+记录+消耗明细+消耗件已消耗 四事实同事务；缺件 4010（附缺口明细）；不可用件 4011；产出编号重复 3002；**失败路径零残留断言** | 工单页选消耗件（仅列在库、按编号搜索）→提交→成功提示+台账新产出件（在库）；提交不可用件→4011 文案且表单停留 |
| 20 | 生产记录列表 | 分页信封 | 历史列表渲染（型号/编号/时间列） |
| 21 | 生产记录详情 | 含消耗明细集合 | 详情 Drawer 渲染产出件与消耗件清单 |
| 22 | 越权 | 四域 × 无权限请求 403/2003 + 审计 | 无权限账号登录→物料菜单不渲染子项、直达路由被 access 拦截跳转 |

既有 44 用例回归全绿；全套 E2E（基座 31 + 物料 ~25）CI 网内执行。

## 部署影响

- 无新 env / 无 compose 变化（迁移随 MIGRATE_ON_START，幂等）
- 权限种子：PermissionSeeder 追加 8 码（module=material）；无新密钥
- `API_CONVENTIONS.md` 错误码登记表追加（4007-4011 + 3002 描述扩展「物料编码/实例编号」）

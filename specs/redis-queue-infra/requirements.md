# Redis 队列基础设施与作用评估

## 背景与目标

基座当前队列/缓存驱动均为 `database`（`QUEUE_CONNECTION=database`、`CACHE_STORE=database`）。1 万级用户压测（2026-11）确认当前查询性能无瓶颈，但为后续业务（邮件、通知、导入导出、报表等耗时任务）预留队列基建，并将高频计数类负载（登录限流）从 PG 迁至 Redis。

完成后对两类角色产生价值：开发者获得开箱即用的 Redis 队列通道与 worker 进程（后续业务 Job 直接 dispatch，无需再动基建）；运维获得单 `compose up` 即含 Redis 的全栈拓扑（含健康检查与生产回退配置）。

## Redis 在 Laravel 的作用面（评估）与本项目取舍

| Laravel 能力 | 通用作用 | 本项目取舍 | 理由 |
|---|---|---|---|
| **queue 驱动** | 异步任务（邮件/通知/报表），失败重试、延迟调度 | ✅ 本期落地（redis 驱动 + supervisord worker） | 后续业务异步任务的标准通道；database 驱动在大流量下轮询 PG 有写放大 |
| **cache / RateLimiter** | 计数器与查询缓存 | ✅ 本期落地（`CACHE_STORE=redis`） | 登录限流按 IP 每分钟计数，迁至 Redis 消除每次登录一次的 PG 计数读写；基座当前**不做权限数据缓存**（无失效风险面） |
| **session** | 会话存储 | ❌ 不适用 | API-only + Sanctum token，无 session 依赖（`SESSION_DRIVER` 仅框架默认残留） |
| **广播/实时** | WebSocket 消息总线 | ❌ 暂不引入 | 无实时场景；websockets 生态引入成本高，按需再说 |
| **原子锁** | 并发互斥 | ⚪ 潜在 | 当前无并发竞态场景（最后超管保护已由 DB 事务收敛），将来批量任务去重可用 |
| **Horizon** | 队列监控面板 | ⚪ 二期 | 基座尚无真实队列任务，worker 进程级可观测（supervisord 日志）先行；Horizon 需 Dashboard 路由+权限点，随首个真实业务队列需求引入 |

**明确不做（安全基线约束）**：审计日志**不得**异步化——AGENTS.md 红线「审计日志写入与业务变更同一事务」，队列驱动只服务非审计类异步任务；权限清单/角色矩阵**暂不缓存**——「矩阵变更后角色用户权限即时生效」是已验收语义（E2E role.spec 验证），缓存需配套 tag 失效，收益低于复杂度，待出现热路径再评估。

## 用户故事

- 作为**开发者**，我希望 dispatch 的 Job 由常驻 worker 自动消费，以便异步任务开箱即用。
- 作为**运维**，我希望 compose 全栈自带带健康检查的 Redis，以便部署不依赖外部缓存服务。
- 作为**开发者**，我希望登录限流计数走 Redis 而非 PG，以便高频计数不产生数据库写放大。

## 验收标准（EARS 语法，每条可独立验证）

- 当执行 `docker compose up -d` 时，系统包含 Redis 7 服务（含 healthcheck）且 api 容器 `REDIS_HOST` 指向它，`/up` 健康信号不受影响。
- 当应用向默认队列 dispatch 一个 Job 时，常驻 `queue:work` worker 在数秒内消费完成（容器内实测）。
- 当登录请求发生时，限流计数器写入 Redis 而非 `cache` 表（Redis `MONITOR` 或键存在性实测；`LOGIN_RATE_LIMIT_PER_MIN` 语义不变）。
- 当 Redis 不可用时，队列任务在重试窗口内排队不丢失（worker 重连后消费），已认证 API 请求不因 cache 故障而 500（框架 cache 异常降级配置自查）。
- 当 Pest 运行时，队列断言（`Queue::assertPushed`）在测试环境通过，不依赖真实 Redis（测试仍走 `sync`/fake）。
- 当生产栈（compose.prod）启动时，Redis 同样就位且密码经 env 注入（不入库不入镜像）。

## 完成标准

**影响面**：`compose.yaml`/`compose.prod.yaml`（redis 服务）、`apps/api`（predis 依赖、`.env.example` REDIS_* 与驱动配置、supervisord queue:work 程序、容器入口不变）、Pest 队列冒烟用例、`DEPLOYMENT.md` 拓扑与变量清单回填。

**测试方式**：Pest（queue fake/sync 断言）+ compose 全栈冒烟（容器内 dispatch→worker 消费实测 + 限流键落 Redis 实测）+ 既有 31 例 E2E 回归全绿。

**不做什么**：不引入 Horizon（二期）；不做权限/矩阵缓存；不实现具体业务 Job（本期为基建，首个业务队列任务随其需求走 spec）；不改审计写入路径（事务内红线）。

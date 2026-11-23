# Redis 队列基础设施 · 任务分解

> 依赖序：compose 服务 → api 配置 → worker 进程 → 验证 → 文档回填；每步可独立冒烟。

- [x] 1. compose.yaml / compose.prod.yaml 新增 redis:7.4-alpine（healthcheck + env 密码注入），api 服务 REDIS_* / QUEUE_CONNECTION=redis / CACHE_STORE=redis
- [x] 2. apps/api：`composer require predis/predis`；`.env.example` 登记 REDIS_* 并切换 QUEUE_CONNECTION/CACHE_STORE 默认值
- [x] 3. api 容器 supervisord 新增 `queue:work` 常驻程序（--tries=3 --max-time 自愈）
- [x] 4. Pest 队列冒烟：Job dispatch 断言（Queue::fake，不依赖真实 Redis）+ 测试环境驱动契约锁定
- [x] 5. compose 全栈冒烟：容器内 dispatch → worker 数秒内消费实测；登录限流计数落 Redis 实测（db1 键实证）；既有 31 例 E2E 回归全绿
- [x] 6. DEPLOYMENT.md：五容器拓扑、REDIS_* 变量清单、回滚说明（env 级切回 database）
- [x] 7. converge：证据表回填本文件

## 实现中的偏差修正（先改契约原则）

- **REDIS_CLIENT 必须显式注入**：镜像内无 .env，框架 config 默认 `phpredis` 而镜像未装该扩展——compose 双环境均注入 `REDIS_CLIENT=predis`（首次启动 502 实测暴露，已修）
- **冒烟 Job 载体**：闭包 Job 无法跨进程序列化（tinker eval 无文件载体），新增 `app/Jobs/QueueSmokeJob`（基建验收用，兼作后续业务 Job 结构范本）
- **限流键在 Redis db1**：Laravel cache connection 默认 database 1，核查时勿查 db0

## 验收证据表

> 采集环境：compose 全栈五容器（redis healthy）+ 宿主 curl/容器内实测；SHA 为验证时分支 HEAD。

| 场景 | URL/入口 | SHA | 产物 | 状态 |
|---|---|---|---|---|
| 全栈五容器（redis:7.4-alpine healthy + api healthy） | docker compose ps | dev+ | api/db/redis/nginx/web 全 healthy | PASS |
| 队列 dispatch → 常驻 worker 消费 | 容器内 tinker | dev+ | `local.INFO: queue-smoke-ok {"probe":"redis-queue-infra"}`（QueueSmokeJob） | PASS |
| 登录限流计数落 Redis（db1 键对） | POST /api/v1/auth/login → redis -n 1 scan | dev+ | `laravel-cache-<hash>` + `:timer` 键出现；PG cache 表零新写入 | PASS |
| Pest 44/44（含队列派发 + 驱动契约锁定 2 新用例） | apps/api | dev+ | `vendor/bin/pest`：44 passed / 185 assertions；Pint passed | PASS |
| E2E 31 例回归（Redis-backed 栈） | compose --profile e2e | dev+ | `31 passed (37.7s)` | PASS |
| compose 双环境配置校验 | docker compose config | dev+ | 基座 + prod overlay（IMAGE_TAG=ci）均通过 | PASS |

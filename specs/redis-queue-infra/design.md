# Redis 队列基础设施 · 技术方案

## 方案概述

最小基建落地（评估见 requirements.md 作用面表）：

```
compose 全栈新增                        apps/api
┌─────────────┐   ┌──────────────┐    QUEUE_CONNECTION=redis
│ redis:7-alpine │◄──│ api (fpm+nginx │    CACHE_STORE=redis
│ healthcheck   │   │  supervisord:  │    predis/predis 驱动
└─────────────┘   │   + queue:work │
                   └──────────────┘
```

分层红线不触碰业务代码：无 Controller/Service 改动；仅配置与基建。

## 组件契约

### Redis 服务（compose）

- 镜像 `redis:7.4-alpine`（锁定 minor，禁 latest；与 PG 18.7 同策略）
- healthcheck：`redis-cli ping`
- 密码：`${REDIS_PASSWORD:?}` 生产必填；本地 compose 默认空（`--requirepass` 仅在有密码时传入）。api 侧 `REDIS_PASSWORD` env 注入，`.env.example` 登记
- 数据卷：不持久化（队列/限流缓存可重建；生产如需任务不丢可加 `--appendonly yes` 挂卷，本期默认关闭并写入 DEPLOYMENT 说明）

### Laravel 侧（apps/api）

- `predis/predis`（纯 PHP 免扩展编译，与 alpine fpm 镜像兼容；phpredis 将来需要时替换）
- `.env.example`：`REDIS_HOST=127.0.0.1` / `REDIS_PORT=6379` / `REDIS_PASSWORD=null` + `QUEUE_CONNECTION=redis` + `CACHE_STORE=redis`
- compose api environment：`REDIS_HOST=redis`、`QUEUE_CONNECTION=redis`、`CACHE_STORE=redis`
- supervisord 新程序：`php artisan queue:work redis --sleep=1 --tries=3 --max-time=3600`（`max-time` 配合 supervisord autorestart 实现平滑自愈，避免长驻进程内存漂移；日志入 stderr 既有通道）

### 失效语义与安全自查

- **限流**：`RateLimiter::for('login')` 无代码改动——驱动随 `CACHE_STORE` 切换自动落 Redis；`LOGIN_RATE_LIMIT_PER_MIN` 语义与 env 化机制不变
- **缓存故障面**：Laravel cache 读写异常默认向上抛——限流路径 `tooManyAttempts` 异常将表现为登录 500。风险接受度：Redis 与 api 同栈同生命周期，故障域一致；生产如需降级（cache 异常时跳过限流）属二期权衡，本期不引入静默吞错（对齐「不静默失败」原则，故障显性化优于放行爆破）
- **队列不丢**：worker 停止期间任务在 Redis 列表滞留，重启即消费；`--tries=3` 后进 failed jobs（database 驱动的 failed_jobs 表沿用，便于 `queue:retry`）
- **审计红线**：不引入任何异步审计路径（requirements 不做什么节）

## 接口契约

无新 HTTP 接口。队列侧首个消费者为占位验证 Job（仅基建验证用，不进业务代码目录）。

## 数据模型

无迁移。`cache`/`cache_locks` 表保留（框架默认，未来切回 database 驱动零成本）；`jobs` 表随 database 驱动退役不再写入，不删除迁移（回滚能力）。

## 部署影响（对照 DEPLOYMENT.md）

- 拓扑：四容器 → 五容器（+redis）；入口 nginx 不感知
- 环境变量清单新增：`REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`（compose 注入，`.env.example` 登记；prod `REDIS_PASSWORD` 硬校验 `${VAR:?}`）
- 回滚：`QUEUE_CONNECTION`/`CACHE_STORE` 切回 `database` 即恢复旧路径（env 级回滚，无需回滚代码）

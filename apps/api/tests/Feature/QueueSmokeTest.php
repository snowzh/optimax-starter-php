<?php

use Illuminate\Queue\CallQueuedClosure;
use Illuminate\Support\Facades\Queue;

/**
 * Redis 队列基建冒烟（spec redis-queue-infra）：
 * 真实 Redis 链路（dispatch → worker 消费）由 compose 全栈实测收口，
 * Pest 侧验证派发通道与测试环境驱动契约（不依赖外部 Redis）。
 */
it('任务派发通道可用（Queue::fake 断言）', function (): void {
    Queue::fake();

    dispatch(function (): void {
        // 基建冒烟占位：真实业务 Job 随各自需求落地
    });

    Queue::assertPushed(CallQueuedClosure::class, 1);
});

it('测试环境队列与缓存不依赖外部服务（驱动契约锁定）', function (): void {
    // 防止 phpunit.xml 驱动漂移导致 Pest 隐式依赖 Redis/PG 缓存表
    expect(config('queue.default'))->toBe('sync');
    expect(config('cache.default'))->toBe('array');
});

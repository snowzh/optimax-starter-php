<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * 队列基建冒烟 Job（spec redis-queue-infra 验收载体）：
 * compose 全栈实测 dispatch → worker 消费链路；后续业务 Job 可参考此结构。
 */
class QueueSmokeJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** @param array<string, mixed> $payload 冒烟载荷（写入日志核验消费证据） */
    public function __construct(
        public readonly array $payload = [],
    ) {}

    public function handle(): void
    {
        Log::info('queue-smoke-ok', $this->payload);
    }
}

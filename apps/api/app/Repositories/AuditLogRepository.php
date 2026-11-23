<?php

namespace App\Repositories;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Request;

/**
 * 审计日志数据访问：create 仅供 Service 在业务事务内调用。
 */
class AuditLogRepository
{
    /**
     * 写入一条审计日志。
     *
     * @param  array{user_id?: ?int, action: string, subject_type?: ?string, subject_id?: ?int,
     *     detail?: ?array<string, mixed>}  $attributes
     */
    public function create(array $attributes): AuditLog
    {
        return AuditLog::create([
            ...$attributes,
            'ip' => Request::ip(),
        ]);
    }
}

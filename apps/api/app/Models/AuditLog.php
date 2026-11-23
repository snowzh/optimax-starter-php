<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * 审计日志：由 Service 层在业务变更同一事务内写入，记录不可变（仅 created_at）。
 * detail 为脱敏后的变更快照，禁止出现 password/token/secret 类敏感键。
 */
class AuditLog extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'action',
        'subject_type',
        'subject_id',
        'detail',
        'ip',
    ];

    protected function casts(): array
    {
        return [
            'detail' => 'array',
            'created_at' => 'datetime',
        ];
    }
}

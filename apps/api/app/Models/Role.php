<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * 角色：name 为代码层唯一标识（如 super-admin），display_name 为中文名。
 * 受保护角色（is_protected）禁止删除与修改权限矩阵（见 RoleService）。
 */
#[Fillable(['name', 'display_name', 'remark', 'is_protected', 'guard_name'])]
class Role extends SpatieRole
{
    /** 超级管理员标识：Gate::before 兜底全通过，且受最后超管保护约束 */
    public const SUPER_ADMIN = 'super-admin';

    /** 与 User 模型一致，角色记录统一挂在 sanctum guard 下 */
    protected string $guard_name = 'sanctum';

    protected $casts = [
        'is_protected' => 'boolean',
    ];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Spatie\Permission\Models\Permission as SpatiePermission;

/**
 * 权限：name 为代码层唯一标识（如 system.user.view），display_name 为中文名，
 * module 用于权限矩阵按模块分组。
 */
#[Fillable(['name', 'display_name', 'module', 'sort', 'guard_name'])]
class Permission extends SpatiePermission
{
    /** 与 User 模型一致，权限记录统一挂在 sanctum guard 下 */
    protected string $guard_name = 'sanctum';
}

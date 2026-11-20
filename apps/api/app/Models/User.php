<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['username', 'name', 'password', 'status'])]
#[Hidden(['password'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles;

    /**
     * spatie 权限体系的 guard 名：与 auth:sanctum 路由守卫一致，
     * 角色/权限记录均以 guard_name = sanctum 创建与匹配。
     */
    protected string $guard_name = 'sanctum';

    /** 状态常量：1 启用 / 0 禁用 */
    public const STATUS_ENABLED = 1;

    public const STATUS_DISABLED = 0;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => 'integer',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}

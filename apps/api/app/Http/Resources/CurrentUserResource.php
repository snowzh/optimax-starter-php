<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 当前用户视图（login / auth/me 共用）：
 * roles 为角色标识数组，permissions 为有效权限并集（角色权限 ∪ 直授权限）。
 * 永不含密码与 token 字段（token 仅 login 响应单独给出一次）。
 *
 * @mixin User
 */
class CurrentUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'name' => $this->name,
            'status' => $this->status,
            'roles' => $this->getRoleNames()->values()->all(),
            'permissions' => $this->getAllPermissions()->pluck('name')->values()->all(),
        ];
    }
}

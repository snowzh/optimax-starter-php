<?php

namespace App\Http\Resources;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 角色管理条目视图：含权限矩阵码集合与用户数。
 *
 * @mixin Role
 */
class RoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'display_name' => $this->display_name,
            'remark' => $this->remark,
            'is_protected' => $this->is_protected,
            'permissions' => $this->whenLoaded(
                'permissions',
                fn () => $this->permissions->pluck('name')->values()->all(),
            ),
            'users_count' => $this->whenCounted('users', fn () => $this->users_count),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

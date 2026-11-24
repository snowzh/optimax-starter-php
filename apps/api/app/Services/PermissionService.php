<?php

namespace App\Services;

use App\Repositories\PermissionRepository;
use Illuminate\Support\Collection;

/**
 * 权限清单业务：只读分组视图，供前端权限矩阵与直授组件共用。
 */
class PermissionService
{
    /** 模块标识 → 中文名注册表（新增权限模块时同步登记） */
    public const MODULE_NAMES = [
        'user' => '用户管理',
        'role' => '角色管理',
        'permission' => '权限清单',
        // 物料管理（spec material-mgmt）：四域
        'material.product' => '产品型号',
        'material.component' => '零件型号',
        'material.stock' => '库存台账',
        'material.production' => '生产记录',
    ];

    public function __construct(
        private readonly PermissionRepository $permissions,
    ) {}

    /**
     * 按模块分组的权限清单。
     *
     * @return array<int, array{module: string, module_name: string, permissions: array<int, array{id: int, name: string, display_name: string}>}>
     */
    public function grouped(): array
    {
        return $this->permissions
            ->allOrdered()
            ->groupBy('module')
            ->map(function (Collection $items, string $module): array {
                return [
                    'module' => $module,
                    'module_name' => self::MODULE_NAMES[$module] ?? $module,
                    'permissions' => $items
                        ->map(fn ($permission) => [
                            'id' => $permission->id,
                            'name' => $permission->name,
                            'display_name' => $permission->display_name,
                        ])
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }
}

<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * 权限码注册表：新增权限码必须先在此登记（与前端 access 权限点一一对应）。
 * 权限码命名：system.<模块>.<动作>。
 */
class PermissionSeeder extends Seeder
{
    /** 权限码清单：module → [权限码 => 中文名] */
    public const PERMISSIONS = [
        'user' => [
            'system.user.view' => '查看用户',
            'system.user.manage' => '管理用户',
        ],
        'role' => [
            'system.role.view' => '查看角色',
            'system.role.manage' => '管理角色',
        ],
        'permission' => [
            'system.permission.view' => '查看权限清单',
        ],
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $module => $permissions) {
            $sort = 1;
            foreach ($permissions as $name => $displayName) {
                Permission::query()->firstOrCreate(
                    ['name' => $name, 'guard_name' => 'sanctum'],
                    ['display_name' => $displayName, 'module' => $module, 'sort' => $sort++],
                );
            }
        }
    }
}

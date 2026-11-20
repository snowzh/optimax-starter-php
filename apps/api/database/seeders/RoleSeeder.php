<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * 角色种子：super-admin 受保护（Gate::before 全通过，矩阵无需配置）；
 * system-admin 持全部权限码，viewer 仅查看类权限。
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // 超级管理员：受保护，禁止删除/改矩阵/经接口指派。
        // 种子为其全量同步权限矩阵（前端 access 依赖 permissions 并集放行），
        // Gate::before 仅作为代码层兜底；新增权限码后重跑种子即可补齐矩阵。
        $superAdmin = Role::query()->firstOrCreate(
            ['name' => 'super-admin', 'guard_name' => 'sanctum'],
            ['display_name' => '超级管理员', 'remark' => '系统内置：拥有全部权限，最后一个不可删除/降级', 'is_protected' => true],
        );
        $superAdmin->syncPermissions($this->allPermissionNames());

        // 系统管理员：持有全部权限码
        $systemAdmin = Role::query()->firstOrCreate(
            ['name' => 'system-admin', 'guard_name' => 'sanctum'],
            ['display_name' => '系统管理员', 'remark' => '拥有系统管理全部权限'],
        );
        $systemAdmin->syncPermissions($this->allPermissionNames());

        // 只读访客：仅查看类权限
        $viewer = Role::query()->firstOrCreate(
            ['name' => 'viewer', 'guard_name' => 'sanctum'],
            ['display_name' => '只读访客', 'remark' => '仅可查看系统管理页面'],
        );
        $viewer->syncPermissions($this->viewPermissionNames());
    }

    /** @return array<int, string> */
    private function allPermissionNames(): array
    {
        $names = [];
        foreach (PermissionSeeder::PERMISSIONS as $permissions) {
            $names = [...$names, ...array_keys($permissions)];
        }

        return $names;
    }

    /** @return array<int, string> */
    private function viewPermissionNames(): array
    {
        $names = [];
        foreach (PermissionSeeder::PERMISSIONS as $permissions) {
            foreach (array_keys($permissions) as $name) {
                if (str_ends_with($name, '.view')) {
                    $names[] = $name;
                }
            }
        }

        return $names;
    }
}

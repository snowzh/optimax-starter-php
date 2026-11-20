<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * 用户种子：初始密码从 env 读取（生产必须覆盖，见 DEPLOYMENT.md）。
 * admin = 超级管理员；demo = 只读访客（联调演示）；alice = 无角色（权限拒绝演示）。
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $adminPassword = env('ADMIN_INITIAL_PASSWORD', 'admin123');
        $demoPassword = env('DEMO_INITIAL_PASSWORD', 'demo123456');

        $admin = User::query()->firstOrCreate(
            ['username' => 'admin'],
            [
                'name' => '系统管理员',
                'password' => Hash::make($adminPassword),
                'status' => User::STATUS_ENABLED,
            ],
        );
        $admin->assignRole(Role::SUPER_ADMIN);

        $demo = User::query()->firstOrCreate(
            ['username' => 'demo'],
            [
                'name' => '演示用户',
                'password' => Hash::make($demoPassword),
                'status' => User::STATUS_ENABLED,
            ],
        );
        $demo->assignRole('viewer');

        User::query()->firstOrCreate(
            ['username' => 'alice'],
            [
                'name' => '爱丽丝',
                'password' => Hash::make($demoPassword),
                'status' => User::STATUS_ENABLED,
            ],
        );
    }
}

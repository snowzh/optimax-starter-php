<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     * 种子顺序固定：权限码 → 角色 → 用户 → 物料演示数据（小闭环 + 规模层）。
     */
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
            MaterialDemoSeeder::class,
            MaterialScaleSeeder::class,
        ]);
    }
}
